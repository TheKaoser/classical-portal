"use client"

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  PLAYBACK_SEEK_SYNC_MS,
  PLAYER_TRY_AGAIN_MESSAGE,
  PREMIUM_REQUIRED_MESSAGE,
  SPOTIFY_PLAYER_NAME,
  isPlayerNotReadyCode,
  playbackDeviceRetryDelay,
  seekByKeyboard,
  seekPositionMs,
  seekRatioFromPointer,
  shouldApplyPlaybackPosition,
} from "@/lib/spotify-playback"

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

const SEEK_DRAG_INTERVAL_MS = 150

function PlaybackSeekBar({
  position,
  duration,
  disabled,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: {
  position: number
  duration: number
  disabled: boolean
  onScrubStart: (positionMs: number) => void
  onScrub: (positionMs: number) => void
  onScrubEnd: (positionMs: number) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const latestRef = useRef(position)
  const percent = duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0

  function positionFromClientX(clientX: number): number | null {
    const bar = barRef.current
    if (!bar || disabled) return null
    const rect = bar.getBoundingClientRect()
    return seekPositionMs(seekRatioFromPointer(clientX, { left: rect.left, width: rect.width }), duration)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const next = positionFromClientX(event.clientX)
    if (next == null) return
    event.preventDefault()
    draggingRef.current = true
    latestRef.current = next
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus()
    onScrubStart(next)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const next = positionFromClientX(event.clientX)
    if (next == null) return
    latestRef.current = next
    onScrub(next)
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const next = positionFromClientX(event.clientX) ?? latestRef.current
    onScrubEnd(next)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    const next = seekByKeyboard({
      key: event.key,
      positionMs: position,
      durationMs: duration,
      shiftKey: event.shiftKey,
    })
    if (next == null) return
    event.preventDefault()
    onScrubEnd(next)
  }

  return (
    <div
      ref={barRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Seek"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, Math.round(duration))}
      aria-valuenow={Math.max(0, Math.round(Math.min(position, duration)))}
      aria-valuetext={duration > 0 ? `${clock(position)} of ${clock(duration)}` : "Not playing"}
      aria-disabled={disabled}
      className="relative mt-1.5 flex h-6 w-full cursor-pointer touch-none items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ cursor: "pointer" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onKeyDown={onKeyDown}
    >
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-primary/20">
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      {!disabled && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-sm"
          style={{ left: `${percent}%` }}
        />
      )}
    </div>
  )
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
  uris: string[],
  position: number
): Promise<{ code: string; message?: string } | null> {
  const res = await fetch("/api/spotify/play", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, uris, position }),
  })
  if (res.ok) return null
  const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string }
  const code = data.code || (res.status === 404 ? "player_not_ready" : "playback_failed")
  return { code, message: data.error }
}

export function SpotifyWebPlayer({
  uris,
  startPosition = 0,
  generation,
  active,
  visible,
  onArm,
  onPhase,
  onTrackUri,
  onIssue,
  savedTrackUris = [],
  onSaveTrack,
}: {
  uris: string[]
  startPosition?: number
  generation: number
  active: boolean
  visible: boolean
  onArm: (arm: () => void) => void
  onPhase?: (phase: Phase) => void
  onTrackUri?: (uri: string | null) => void
  onIssue: (issue: PlaybackIssue) => void
  savedTrackUris?: string[]
  onSaveTrack?: (uri: string) => Promise<{ ok: true } | { ok: false; message: string }>
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
  const startPositionRef = useRef(startPosition)
  urisRef.current = uris
  startPositionRef.current = startPosition
  const scrubbingRef = useRef(false)
  const pendingSeekRef = useRef<{ positionMs: number; untilMs: number } | null>(null)
  const lastSeekAtRef = useRef(0)
  const acceptPositionRef = useRef<(reportedMs: number) => void>(() => {})

  const [phase, setPhase] = useState<Phase>("connecting")
  const [trackName, setTrackName] = useState("")
  const [trackUri, setTrackUri] = useState("")
  const [artists, setArtists] = useState("")
  const [savingTrack, setSavingTrack] = useState(false)
  const [saveTrackError, setSaveTrackError] = useState<string | null>(null)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [movement, setMovement] = useState<{ index: number; total: number } | null>(null)

  function acceptReportedPosition(reportedMs: number) {
    const pending = pendingSeekRef.current
    const apply = shouldApplyPlaybackPosition({
      reportedMs,
      scrubbing: scrubbingRef.current,
      pendingSeekMs: pending?.positionMs ?? null,
      nowMs: Date.now(),
      pendingUntilMs: pending?.untilMs ?? 0,
    })
    if (!apply) return
    pendingSeekRef.current = null
    setPosition(reportedMs)
  }
  acceptPositionRef.current = acceptReportedPosition

  function requestSeek(positionMs: number, immediate: boolean) {
    setPosition(positionMs)
    pendingSeekRef.current = { positionMs, untilMs: Date.now() + PLAYBACK_SEEK_SYNC_MS }
    const now = Date.now()
    if (!immediate && now - lastSeekAtRef.current < SEEK_DRAG_INTERVAL_MS) return
    lastSeekAtRef.current = now
    const player = playerRef.current
    if (!player) return
    void player.seek(positionMs).catch(() => {
      // The bar stays on the requested position until the next SDK state event.
    })
  }

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
        setTrackUri(track.uri)
        setTrackName(track.name)
        setArtists(track.artists.map((artist) => artist.name).join(", "))
        acceptPositionRef.current(state.position)
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

  function ensurePlayer(isActive: () => boolean = () => true): Promise<string> {
    return loadSpotifyPlaybackSdk().then(async () => {
      attachPlayer()
      if (!isActive()) throw Object.assign(new Error("cancelled"), { code: "cancelled" })
      if (!deviceIdRef.current && !connectingRef.current) throw browserError("missing")

      const pending = connectingRef.current
      if (pending && !deviceIdRef.current) {
        try {
          await pending
        } catch (error) {
          if (deviceIdRef.current) return deviceIdRef.current
          throw error
        }
      }

      // ready can fire before Spotify lists the device, and not_ready can clear the id.
      // Hold the play request here until the SDK reports a device_id again.
      const deadline = Date.now() + 12_000
      while (isActive()) {
        if (deviceIdRef.current) return deviceIdRef.current
        if (Date.now() >= deadline) break
        await new Promise((resolve) => window.setTimeout(resolve, 100))
      }
      if (!isActive()) throw Object.assign(new Error("cancelled"), { code: "cancelled" })
      if (deviceIdRef.current) return deviceIdRef.current
      throw Object.assign(new Error(PLAYER_TRY_AGAIN_MESSAGE), { code: "player_not_ready" })
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
    scrubbingRef.current = false
    pendingSeekRef.current = null
    setPlaybackPhase("connecting")
    setTrackName("")
    setTrackUri("")
    setSaveTrackError(null)
    setArtists("")
    setPosition(0)
    setDuration(0)
    setMovement(null)

    async function play(list: string[]) {
      let attempt = 0
      for (;;) {
        const deviceId = await ensurePlayer(() => !cancelled && mountedRef.current)
        if (cancelled || !mountedRef.current) return
        const issue = await startOnDevice(deviceId, list, startPositionRef.current)
        if (cancelled || !mountedRef.current) return
        if (!issue) {
          setPlaybackPhase("playing")
          return
        }
        const retryMs = isPlayerNotReadyCode(issue.code) ? playbackDeviceRetryDelay(attempt) : null
        if (retryMs == null) {
          const code = issue.code
          if (isPlayerNotReadyCode(code)) {
            onIssueRef.current({ code: "playback_failed", message: issue.message || PLAYER_TRY_AGAIN_MESSAGE })
            return
          }
          if (
            code === "premium_required" ||
            code === "insufficient_scope" ||
            code === "not_connected" ||
            code === "playback_failed"
          ) {
            onIssueRef.current({ code, message: issue.message })
          } else {
            onIssueRef.current({ code: "playback_failed", message: issue.message || "Spotify could not start playback." })
          }
          return
        }
        attempt += 1
        await new Promise((resolve) => window.setTimeout(resolve, retryMs))
      }
    }

    void play(uris).catch((error: unknown) => {
      if (cancelled || !mountedRef.current) return
      const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : ""
      if (code === "cancelled" || code === "premium_required" || code === "not_connected") return
      if (isPlayerNotReadyCode(code)) {
        onIssueRef.current({ code: "playback_failed", message: PLAYER_TRY_AGAIN_MESSAGE })
        return
      }
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
    if (!visible) return
    const previous = document.body.style.paddingBottom
    document.body.style.paddingBottom = "8.5rem"
    return () => {
      document.body.style.paddingBottom = previous
    }
  }, [visible])

  useEffect(() => {
    if (!active || phase === "connecting" || phase === "paused") return
    const id = window.setInterval(() => {
      void playerRef.current?.getCurrentState().then((state) => {
        if (!state || !mountedRef.current) return
        acceptPositionRef.current(state.position)
        setDuration(state.duration || state.track_window.current_track.duration_ms)
        setPlaybackPhase(state.paused ? "paused" : "playing")
      })
    }, 500)
    return () => window.clearInterval(id)
  }, [active, phase])

  if (!visible) return null

  const paused = phase !== "playing"
  const trackSaved = Boolean(trackUri && savedTrackUris.includes(trackUri))
  const title = trackName || (phase === "connecting" ? "Connecting the player…" : "Classical Portal")
  const movementLabel = movement ? `Movement ${movement.index + 1} of ${movement.total}` : "In this page"

  return (
    <div
      role="region"
      aria-label="In-page player"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/30 bg-card/95 shadow-[0_-10px_30px_rgba(41,50,62,0.14)] backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3">
        <Button
          type="button"
          size="icon"
          className="shrink-0 cursor-pointer disabled:pointer-events-auto disabled:cursor-pointer"
          style={{ cursor: "pointer" }}
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
          <PlaybackSeekBar
            position={position}
            duration={duration}
            disabled={phase === "connecting" || duration <= 0}
            onScrubStart={(positionMs) => {
              scrubbingRef.current = true
              requestSeek(positionMs, true)
            }}
            onScrub={(positionMs) => {
              requestSeek(positionMs, false)
            }}
            onScrubEnd={(positionMs) => {
              requestSeek(positionMs, true)
              scrubbingRef.current = false
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 cursor-pointer disabled:pointer-events-auto disabled:cursor-pointer"
          style={{ cursor: "pointer" }}
          aria-label="Save track"
          aria-pressed={trackSaved}
          disabled={!trackUri || phase === "connecting" || savingTrack || trackSaved || !onSaveTrack}
          onClick={() => {
            if (!trackUri || !onSaveTrack) return
            setSavingTrack(true)
            setSaveTrackError(null)
            void onSaveTrack(trackUri).then((result) => {
              if (!mountedRef.current) return
              setSavingTrack(false)
              if (!result.ok) setSaveTrackError(result.message)
            })
          }}
        >
          {savingTrack ? "Saving…" : trackSaved ? "Saved" : "Save track"}
        </Button>
      </div>
      <p className="mx-auto max-w-4xl border-t border-primary/10 px-3 py-1.5 text-xs text-muted-foreground">
        {saveTrackError ? saveTrackError : `Playing in this page. ${PREMIUM_REQUIRED_MESSAGE}`}
      </p>
    </div>
  )
}
