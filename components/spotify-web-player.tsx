"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play, SkipBack, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PREMIUM_REQUIRED_MESSAGE, SPOTIFY_PLAYER_NAME } from "@/lib/spotify-playback"

export type PlaybackIssue = {
  code: "premium_required" | "insufficient_scope" | "not_connected" | "browser" | "playback_failed"
  message?: string
}

type Phase = "connecting" | "playing" | "paused"

let sdkPromise: Promise<void> | null = null

function browserError(message: string): Error {
  return Object.assign(new Error(message), { code: "browser" })
}

export function loadSpotifyPlaybackSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(browserError("browser"))
  if (window.Spotify) return Promise.resolve()
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      sdkPromise = null
      reject(browserError("timeout"))
    }, 15_000)
    window.onSpotifyWebPlaybackSDKReady = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    if (document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) return
    const script = document.createElement("script")
    script.src = "https://sdk.scdn.co/spotify-player.js"
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timeout)
      sdkPromise = null
      reject(browserError("script"))
    }
    document.body.appendChild(script)
  })
  return sdkPromise
}

function parkSdkIframe() {
  const iframe = document.querySelector('iframe[src="https://sdk.scdn.co/embedded/index.html"]')
  if (!(iframe instanceof HTMLIFrameElement)) return
  iframe.style.position = "absolute"
  iframe.style.top = "-1000px"
  iframe.style.left = "-1000px"
  iframe.style.border = "0"
  iframe.setAttribute("aria-hidden", "true")
}

function clock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function unlockBrowserAudio(player: SpotifyPlayer | null) {
  if (!player || typeof player.activateElement !== "function") return
  void player.activateElement()
}

async function readToken(onIssue: (issue: PlaybackIssue) => void): Promise<string> {
  const res = await fetch("/api/spotify/token", { cache: "no-store" })
  const data = (await res.json().catch(() => ({}))) as { accessToken?: string; premium?: boolean | null }
  if (res.status === 401 || typeof data.accessToken !== "string" || !data.accessToken) {
    onIssue({ code: "not_connected", message: "Spotify login expired. Sign in again." })
    return ""
  }
  if (data.premium === false) {
    onIssue({ code: "premium_required", message: PREMIUM_REQUIRED_MESSAGE })
  }
  return data.accessToken
}

async function startOnDevice(
  deviceId: string,
  uris: string[]
): Promise<{ code: string; message?: string } | null> {
  const res = await fetch("/api/spotify/play", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, uris, position: 0 }),
  })
  if (res.ok) return null
  const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string }
  return { code: data.code || "playback_failed", message: data.error }
}

export function SpotifyWebPlayer({
  uris,
  generation,
  active,
  visible,
  onArm,
  onPhase,
  onTrackUri,
  onIssue,
}: {
  uris: string[]
  generation: number
  active: boolean
  visible: boolean
  onArm: (arm: () => void) => void
  onPhase?: (phase: Phase) => void
  onTrackUri?: (uri: string | null) => void
  onIssue: (issue: PlaybackIssue) => void
}) {
  const onIssueRef = useRef(onIssue)
  const onPhaseRef = useRef(onPhase)
  const onTrackUriRef = useRef(onTrackUri)
  const onArmRef = useRef(onArm)
  onIssueRef.current = onIssue
  onPhaseRef.current = onPhase
  onTrackUriRef.current = onTrackUri
  onArmRef.current = onArm

  const playerRef = useRef<SpotifyPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const connectingRef = useRef<Promise<string> | null>(null)
  const readyTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const urisRef = useRef(uris)
  urisRef.current = uris

  const [phase, setPhase] = useState<Phase>("connecting")
  const [trackName, setTrackName] = useState("")
  const [artists, setArtists] = useState("")
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [movement, setMovement] = useState<{ index: number; total: number } | null>(null)

  function setPlaybackPhase(next: Phase) {
    setPhase(next)
    onPhaseRef.current?.(next)
  }

  function destroyPlayer() {
    if (readyTimerRef.current != null) {
      window.clearTimeout(readyTimerRef.current)
      readyTimerRef.current = null
    }
    connectingRef.current = null
    deviceIdRef.current = null
    const player = playerRef.current
    playerRef.current = null
    try {
      player?.disconnect()
    } catch {
      // The SDK can reject disconnect after the device is already gone.
    }
  }

  function attachPlayer(): SpotifyPlayer | null {
    if (playerRef.current) return playerRef.current
    const SpotifySdk = window.Spotify
    if (!SpotifySdk) return null

    let settled = false
    let player!: SpotifyPlayer
    const pending = new Promise<string>((resolve, reject) => {
      player = new SpotifySdk.Player({
        name: SPOTIFY_PLAYER_NAME,
        volume: 0.8,
        getOAuthToken: (callback) => {
          void readToken((issue) => onIssueRef.current(issue))
            .then((token) => callback(token))
            .catch(() => callback(""))
        },
      })

      let readyWait = 0
      player.addListener("ready", ({ device_id }) => {
        if (playerRef.current !== player) return
        parkSdkIframe()
        deviceIdRef.current = device_id
        if (settled) return
        settled = true
        window.clearTimeout(readyWait)
        resolve(device_id)
      })
      player.addListener("not_ready", () => {
        if (playerRef.current !== player) return
        deviceIdRef.current = null
      })
      player.addListener("initialization_error", () => {
        if (settled) return
        settled = true
        window.clearTimeout(readyWait)
        reject(browserError("initialization"))
      })
      player.addListener("authentication_error", () => {
        onIssueRef.current({ code: "not_connected", message: "Spotify login expired. Sign in again." })
        if (settled) return
        settled = true
        window.clearTimeout(readyWait)
        reject(Object.assign(new Error("auth"), { code: "not_connected" }))
      })
      player.addListener("account_error", () => {
        onIssueRef.current({ code: "premium_required", message: PREMIUM_REQUIRED_MESSAGE })
        if (settled) return
        settled = true
        window.clearTimeout(readyWait)
        reject(Object.assign(new Error("premium"), { code: "premium_required" }))
      })
      player.addListener("playback_error", ({ message }) => {
        onIssueRef.current({ code: "playback_failed", message: message || "Spotify could not start playback." })
      })
      player.addListener("player_state_changed", (state) => {
        if (!mountedRef.current) return
        if (!state) {
          onTrackUriRef.current?.(null)
          return
        }
        const track = state.track_window.current_track
        const index = urisRef.current.indexOf(track.uri)
        setTrackName(track.name)
        setArtists(track.artists.map((artist) => artist.name).join(", "))
        setPosition(state.position)
        setDuration(state.duration || track.duration_ms)
        setMovement(index >= 0 ? { index, total: urisRef.current.length } : null)
        setPlaybackPhase(state.paused ? "paused" : "playing")
        onTrackUriRef.current?.(track.uri)
      })

      playerRef.current = player
      readyWait = window.setTimeout(() => {
        if (settled || playerRef.current !== player) return
        settled = true
        reject(browserError("timeout"))
      }, 12_000)
      readyTimerRef.current = readyWait
      void player.connect()
    })

    const created = playerRef.current
    connectingRef.current = pending.catch((error: unknown) => {
      if (created && playerRef.current === created) destroyPlayer()
      throw error
    })
    return created
  }

  const attachRef = useRef(attachPlayer)
  attachRef.current = attachPlayer

  function ensurePlayer(): Promise<string> {
    return loadSpotifyPlaybackSdk().then(() => {
      attachPlayer()
      if (deviceIdRef.current) return deviceIdRef.current
      if (connectingRef.current) return connectingRef.current
      return Promise.reject(browserError("missing"))
    })
  }

  useEffect(() => {
    mountedRef.current = true
    void loadSpotifyPlaybackSdk().catch(() => {
      // Play all reports this if the script is still missing when playback starts.
    })
    onArmRef.current(() => {
      if (window.Spotify) {
        unlockBrowserAudio(attachRef.current())
        return
      }
      void loadSpotifyPlaybackSdk()
        .then(() => unlockBrowserAudio(attachRef.current()))
        .catch(() => {
          // The play attempt reports a missing SDK.
        })
    })
    return () => {
      mountedRef.current = false
      destroyPlayer()
    }
  }, [])

  useEffect(() => {
    if (active) return
    void playerRef.current?.pause()
  }, [active])

  useEffect(() => {
    if (!active || uris.length === 0) return
    let cancelled = false
    setPlaybackPhase("connecting")
    setTrackName("")
    setArtists("")
    setPosition(0)
    setDuration(0)
    setMovement(null)

    async function play(list: string[], allowDeviceRetry: boolean) {
      const deviceId = await ensurePlayer()
      if (cancelled) return
      const issue = await startOnDevice(deviceId, list)
      if (cancelled) return
      if (issue?.code === "device_not_found" && allowDeviceRetry) {
        destroyPlayer()
        await play(list, false)
        return
      }
      if (issue) {
        const code = issue.code
        if (
          code === "premium_required" ||
          code === "insufficient_scope" ||
          code === "not_connected" ||
          code === "playback_failed"
        ) {
          onIssueRef.current({ code, message: issue.message })
        } else {
          onIssueRef.current({ code: "playback_failed", message: issue.message })
        }
        return
      }
      if (mountedRef.current) setPlaybackPhase("playing")
    }

    void play(uris, true).catch((error: unknown) => {
      if (cancelled || !mountedRef.current) return
      const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : ""
      if (code === "premium_required" || code === "not_connected") return
      if (code === "browser") {
        onIssueRef.current({
          code: "browser",
          message: "This browser cannot run the in-page player. Open a movement in Spotify instead.",
        })
        return
      }
      onIssueRef.current({ code: "playback_failed", message: "Spotify could not start playback." })
    })

    return () => {
      cancelled = true
    }
    // ensurePlayer closes over refs. Re-run only when the requested group changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, generation, uris.join("\n")])

  useEffect(() => {
    if (!active || phase === "connecting" || phase === "paused") return
    const id = window.setInterval(() => {
      void playerRef.current?.getCurrentState().then((state) => {
        if (!state || !mountedRef.current) return
        setPosition(state.position)
        setDuration(state.duration || state.track_window.current_track.duration_ms)
        setPlaybackPhase(state.paused ? "paused" : "playing")
      })
    }, 500)
    return () => window.clearInterval(id)
  }, [active, phase])

  if (!visible) return null

  const percent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0
  const paused = phase !== "playing"
  const title = trackName || (phase === "connecting" ? "Connecting the player…" : "Classical Portal")
  const movementLabel = movement ? `Movement ${movement.index + 1} of ${movement.total}` : "In this page"

  return (
    <div
      role="region"
      aria-label="In-page player"
      className="overflow-hidden rounded-md border border-primary/30 bg-card shadow-sm"
    >
      <div className="flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3">
        <Button
          type="button"
          size="icon"
          className="shrink-0"
          aria-label={paused ? "Play" : "Pause"}
          disabled={phase === "connecting"}
          onClick={() => {
            unlockBrowserAudio(playerRef.current)
            void playerRef.current?.togglePlay()
          }}
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-navy">{title}</p>
            <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {duration > 0 ? `${clock(position)} / ${clock(duration)}` : movement ? `${movement.index + 1}/${movement.total}` : ""}
            </p>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {movementLabel}
            {artists ? ` · ${artists}` : phase === "connecting" ? "" : ` · ${SPOTIFY_PLAYER_NAME}`}
          </p>
          <Progress value={percent} aria-label="Playback position" className="mt-1.5 h-1" />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label="Previous movement"
          disabled={phase === "connecting"}
          onClick={() => void playerRef.current?.previousTrack()}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label="Next movement"
          disabled={phase === "connecting"}
          onClick={() => void playerRef.current?.nextTrack()}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
      <p className="border-t border-primary/10 px-3 py-1.5 text-xs text-muted-foreground">
        Playing in this page. {PREMIUM_REQUIRED_MESSAGE}
      </p>
    </div>
  )
}
