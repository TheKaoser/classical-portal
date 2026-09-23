"use client"

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { createPortal } from "react-dom"
import { Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  PLAYER_BAR_DOCK_CLASS,
  PLAYER_BAR_DOCK_STYLE,
  PLAYER_BAR_FALLBACK_HEIGHT_PX,
  PLAYER_BAR_HEIGHT_VAR,
  playerBarPaddingCss,
} from "@/lib/player-bar-layout"
import {
  PLAYBACK_LOGIN_EXPIRED_MESSAGE,
  PLAYBACK_RECONNECT_MESSAGE,
  PLAYBACK_SEEK_SYNC_MS,
  PLAYER_TRY_AGAIN_MESSAGE,
  PREMIUM_REQUIRED_MESSAGE,
  SPOTIFY_PLAYER_NAME,
  isPlayerNotReadyCode,
  playIssueRetryDelay,
  replacePlayAttempt,
  seekByKeyboard,
  seekPositionMs,
  seekRatioFromPointer,
  shouldApplyPlaybackPosition,
} from "@/lib/spotify-playback"
import {
  phaseFromPlayerPaused,
  playbackControlAction,
  playbackControlLabel,
  playbackControlShowsPause,
} from "@/lib/spotify-player-session"

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
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
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

async function readToken(onIssue: (issue: PlaybackIssue) => void, refresh = false): Promise<string> {
  const res = await fetch(refresh ? "/api/spotify/token?refresh=1" : "/api/spotify/token", { cache: "no-store" })
  const data = (await res.json().catch(() => ({}))) as {
    accessToken?: string
    premium?: boolean | null
    code?: string
    error?: string
  }
  if (data.code === "insufficient_scope" || res.status === 403) {
    onIssue({ code: "insufficient_scope", message: data.error || PLAYBACK_RECONNECT_MESSAGE })
    return ""
  }
  if (res.status === 401 || typeof data.accessToken !== "string" || !data.accessToken) {
    onIssue({ code: "not_connected", message: data.error || PLAYBACK_LOGIN_EXPIRED_MESSAGE })
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
  position: number,
  signal: AbortSignal
): Promise<{ code: string; message?: string } | null> {
  const res = await fetch("/api/spotify/play", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, uris, position }),
    signal,
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
  onRegisterTransport,
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
  onRegisterTransport?: (transport: { pause: () => void; resume: () => void }) => void
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
  const onRegisterTransportRef = useRef(onRegisterTransport)
  onIssueRef.current = onIssue
  onPhaseRef.current = onPhase
  onTrackUriRef.current = onTrackUri
  onArmRef.current = onArm
  onRegisterTransportRef.current = onRegisterTransport

  const playerRef = useRef<SpotifyPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const connectingRef = useRef<Promise<string> | null>(null)
  const readyTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const playAbortRef = useRef<AbortController | null>(null)
  const forceTokenRefreshRef = useRef(false)
  /** `closed` means Spotify already shut the dealer socket; disconnect() would log "Close received after close". */
  const socketRef = useRef<"idle" | "connecting" | "ready" | "closed">("idle")
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
    const socket = socketRef.current
    socketRef.current = "closed"
    if (!player || socket === "idle" || socket === "closed") return
    try {
      player.disconnect()
    } catch {
      // The SDK can reject disconnect after the device is already gone.
    }
  }

  function attachPlayer(): SpotifyPlayer | null {
    if (playerRef.current) return playerRef.current
    const SpotifySdk = window.Spotify
    if (!SpotifySdk) return null

    let settled = false
    let authRetried = false
    let authReported = false
    let player!: SpotifyPlayer
    const pending = new Promise<string>((resolve, reject) => {
      let readyWait = 0
      const failAuth = () => {
        // Spotify has already closed the dealer socket. disconnect() would log
        // "Close received after close".
        socketRef.current = "closed"
        if (!authReported) {
          authReported = true
          onIssueRef.current({ code: "not_connected", message: PLAYBACK_LOGIN_EXPIRED_MESSAGE })
        }
        if (settled) return
        settled = true
        window.clearTimeout(readyWait)
        reject(Object.assign(new Error("auth"), { code: "not_connected" }))
      }

      player = new SpotifySdk.Player({
        name: SPOTIFY_PLAYER_NAME,
        volume: 0.8,
        getOAuthToken: (callback) => {
          const refresh = forceTokenRefreshRef.current
          forceTokenRefreshRef.current = false
          void readToken((issue) => onIssueRef.current(issue), refresh)
            .then((token) => {
              if (playerRef.current !== player) return
              // An empty bearer token is what makes player-state return 401 and
              // the dealer WebSocket close with "Close received after close".
              // readToken already told the listener to reconnect or sign in.
              if (!token) {
                // readToken already asked the listener to reconnect or sign in.
                // Do not open the dealer socket, and do not replace that message.
                authReported = true
                authRetried = true
                socketRef.current = "closed"
                if (!settled) {
                  settled = true
                  window.clearTimeout(readyWait)
                  reject(Object.assign(new Error("auth"), { code: "not_connected" }))
                }
                try {
                  player.disconnect()
                } catch {
                  // No dealer socket was opened.
                }
                return
              }
              callback(token)
            })
            .catch(() => {
              if (playerRef.current === player) failAuth()
            })
        },
      })

      player.addListener("ready", ({ device_id }) => {
        if (playerRef.current !== player) return
        socketRef.current = "ready"
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
        if (playerRef.current !== player) return
        socketRef.current = "closed"
        if (!authRetried) {
          authRetried = true
          forceTokenRefreshRef.current = true
          socketRef.current = "connecting"
          void player.connect()
          return
        }
        failAuth()
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
        setPlaybackPhase(phaseFromPlayerPaused(state.paused))
        onTrackUriRef.current?.(track.uri)
      })

      playerRef.current = player
      readyWait = window.setTimeout(() => {
        if (settled || playerRef.current !== player) return
        settled = true
        reject(browserError("timeout"))
      }, 12_000)
      readyTimerRef.current = readyWait
      socketRef.current = "connecting"
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
    onRegisterTransportRef.current?.({
      pause: () => {
        void playerRef.current?.pause()
      },
      resume: () => {
        unlockBrowserAudio(playerRef.current)
        void playerRef.current?.resume()
      },
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

    const playAbort = replacePlayAttempt(playAbortRef.current)
    playAbortRef.current = playAbort

    async function play(list: string[]) {
      let attempt = 0
      for (;;) {
        if (playAbort.signal.aborted) return
        const deviceId = await ensurePlayer(() => !cancelled && mountedRef.current && !playAbort.signal.aborted)
        if (cancelled || !mountedRef.current || playAbort.signal.aborted) return
        const issue = await startOnDevice(deviceId, list, startPositionRef.current, playAbort.signal)
        if (cancelled || !mountedRef.current || playAbort.signal.aborted) return
        if (!issue) {
          setPlaybackPhase("playing")
          return
        }
        const retryMs = playIssueRetryDelay(issue, attempt)
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
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, retryMs)
          const onAbort = () => {
            window.clearTimeout(timer)
            reject(Object.assign(new Error("cancelled"), { code: "cancelled" }))
          }
          if (playAbort.signal.aborted) {
            onAbort()
            return
          }
          playAbort.signal.addEventListener("abort", onAbort, { once: true })
        })
      }
    }

    void play(uris).catch((error: unknown) => {
      if (cancelled || !mountedRef.current || playAbort.signal.aborted) return
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
      playAbort.abort()
    }
    // ensurePlayer closes over refs. Re-run only when the requested group changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, generation, uris.join("\n")])

  const barRef = useRef<HTMLDivElement | null>(null)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useLayoutEffect(() => {
    if (!visible) return
    const root = document.documentElement
    const previousPadding = document.body.style.paddingBottom
    const previousVar = root.style.getPropertyValue(PLAYER_BAR_HEIGHT_VAR)

    const applyHeight = (heightPx: number) => {
      const css = playerBarPaddingCss(heightPx)
      document.body.style.paddingBottom = css
      root.style.setProperty(PLAYER_BAR_HEIGHT_VAR, css)
    }

    applyHeight(PLAYER_BAR_FALLBACK_HEIGHT_PX)

    const node = barRef.current
    if (!node || typeof ResizeObserver === "undefined") {
      return () => {
        document.body.style.paddingBottom = previousPadding
        if (previousVar) root.style.setProperty(PLAYER_BAR_HEIGHT_VAR, previousVar)
        else root.style.removeProperty(PLAYER_BAR_HEIGHT_VAR)
      }
    }

    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? node.getBoundingClientRect().height
      applyHeight(height)
    })
    observer.observe(node)
    applyHeight(node.getBoundingClientRect().height)

    return () => {
      observer.disconnect()
      document.body.style.paddingBottom = previousPadding
      if (previousVar) root.style.setProperty(PLAYER_BAR_HEIGHT_VAR, previousVar)
      else root.style.removeProperty(PLAYER_BAR_HEIGHT_VAR)
    }
  }, [visible, portalReady])

  useEffect(() => {
    if (!active || phase === "connecting" || phase === "paused") return
    const id = window.setInterval(() => {
      void playerRef.current?.getCurrentState().then((state) => {
        if (!state || !mountedRef.current) return
        acceptPositionRef.current(state.position)
        setDuration(state.duration || state.track_window.current_track.duration_ms)
        setPlaybackPhase(phaseFromPlayerPaused(state.paused))
      })
    }, 500)
    return () => window.clearInterval(id)
  }, [active, phase])

  if (!visible || !portalReady) return null

  const showPause = playbackControlShowsPause(phase)
  const controlLabel = playbackControlLabel(phase)
  const trackSaved = Boolean(trackUri && savedTrackUris.includes(trackUri))
  const title = trackName || (phase === "connecting" ? "Connecting the player…" : "Classical Portal")
  const movementLabel = movement ? `Movement ${movement.index + 1} of ${movement.total}` : "Now playing"

  return createPortal(
    <div
      ref={barRef}
      role="region"
      aria-label="In-page player"
      data-player-dock="flush"
      className={PLAYER_BAR_DOCK_CLASS}
      style={PLAYER_BAR_DOCK_STYLE}
    >
      <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <Button
          type="button"
          size="icon"
          className="shrink-0 cursor-pointer disabled:pointer-events-auto disabled:cursor-pointer"
          style={{ cursor: "pointer" }}
          aria-label={controlLabel === "Connecting…" ? "Play" : controlLabel}
          disabled={phase === "connecting"}
          onClick={() => {
            unlockBrowserAudio(playerRef.current)
            const action = playbackControlAction(phase)
            if (action === "pause") {
              void playerRef.current?.pause()
              return
            }
            if (action === "resume") {
              void playerRef.current?.resume()
            }
          }}
        >
          {showPause ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</p>
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
      <p className="mx-auto w-full max-w-4xl border-t border-border px-3 py-2 text-xs text-muted-foreground sm:px-4">
        {saveTrackError ? saveTrackError : `Playing across pages. ${PREMIUM_REQUIRED_MESSAGE}`}
      </p>
    </div>,
    document.body,
  )
}
