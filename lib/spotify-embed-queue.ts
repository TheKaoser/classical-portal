/**
 * Movement queue for the Spotify iFrame API embed.
 * The embed plays one URI at a time. This queue loads the next movement when
 * playback_update says the current track has ended, and stops after the last.
 */

/** Paused this close to the duration counts as the end of the track. */
export const EMBED_END_NEAR_MS = 1_500

/** A finished track often pauses rewound to the start. */
export const EMBED_END_REWIND_MS = 1_000

/**
 * The end state must hold this long while the tab is visible. A one-frame
 * pause at the tail is not treated as the track finishing.
 * Background tabs freeze timers, so a hidden tab does not wait on this.
 */
export const EMBED_END_DEBOUNCE_MS = 400

/**
 * Playing into the last moments counts as the end even when the embed never
 * flips `isPaused`. Small enough that a mid-phrase pause is not the end.
 */
export const EMBED_END_REACHED_MS = 100

/**
 * After play() is issued, wait this long for an unpaused playback_update.
 * Safari (and other autoplay blocks) leave the embed paused; the UI then asks
 * for a tap instead of advancing the queue.
 */
export const EMBED_AUTOPLAY_GRACE_MS = 2_000

export const SPOTIFY_EMBED_HEIGHT_PX = 152

export const EMBED_PLAYER_LOAD_FAILED = "The Spotify player could not be loaded."

/** iFrame API `playback_update` payload. Position and duration are milliseconds. */
export type EmbedPlaybackUpdate = {
  playingURI?: string
  isPaused: boolean
  isBuffering?: boolean
  duration: number
  position: number
}

export type EmbedTransport = {
  loadUri: (uri: string) => void
  play: () => void
  pause: () => void
  resume: () => void
}

export type EmbedQueuePhase = "connecting" | "playing" | "paused"

export type CancelTimer = () => void

export type MovementQueueOptions = {
  now?: () => number
  schedule?: (callback: () => void, delayMs: number) => CancelTimer
  /** True when this tab is in the background. Timers there do not run promptly. */
  hidden?: () => boolean
  /** Fired when the tab goes to the background, so a pending end can flush. */
  subscribeHidden?: (listener: () => void) => CancelTimer
  onPhase?: (phase: EmbedQueuePhase) => void
  onTrack?: (uri: string) => void
  onWorkEnded?: (uri: string) => void
  onNeedsGesture?: (needed: boolean) => void
  onUserTransport?: () => void
}

export type MovementQueue = {
  start: (uris: readonly string[], index: number) => void
  pause: () => void
  resume: () => void
  /** Skip to the next movement, or end the work on the last one. */
  next: () => void
  /** Restart the previous movement, or the current one when already on the first. */
  previous: () => void
  /** Call when play() or resume() has actually been issued to the controller. */
  notePlayDispatched: () => void
  onPlaybackUpdate: (update: EmbedPlaybackUpdate) => void
  destroy: () => void
}

type PlayingSample = {
  positionMs: number
  durationMs: number
  atMs: number
}

/**
 * Spotify's iFrame API only documents `dark` as a theme override.
 * Light pages omit it and keep the embed default.
 */
export function spotifyEmbedTheme(isDark: boolean): "dark" | undefined {
  return isDark ? "dark" : undefined
}

export function playbackUpdateIsNearEnd(positionMs: number, durationMs: number): boolean {
  if (!(durationMs > EMBED_END_NEAR_MS) || !(positionMs > 0)) return false
  return positionMs >= durationMs - EMBED_END_NEAR_MS
}

export function playbackUpdateReachedDuration(positionMs: number, durationMs: number): boolean {
  if (!(durationMs > EMBED_END_REACHED_MS) || !(positionMs > 0)) return false
  return positionMs >= durationMs - EMBED_END_REACHED_MS
}

export function playbackUpdateIsRewoundEnd(positionMs: number, reachedNearEnd: boolean): boolean {
  return reachedNearEnd && positionMs >= 0 && positionMs <= EMBED_END_REWIND_MS
}

function defaultSchedule(callback: () => void, delayMs: number): CancelTimer {
  const id = setTimeout(callback, delayMs)
  return () => clearTimeout(id)
}

export function createMovementQueue(transport: EmbedTransport, options: MovementQueueOptions = {}): MovementQueue {
  const now = options.now ?? (() => Date.now())
  const schedule = options.schedule ?? defaultSchedule
  const hidden = options.hidden ?? (() => typeof document !== "undefined" && document.hidden)

  let uris: string[] = []
  let index = 0
  let userPaused = false
  let sawPlaying = false
  /** Heard this load actually moving, so a stale end update cannot skip again. */
  let playedIntoTrack = false
  let reachedNearEnd = false
  let candidateAt: number | null = null
  let playIssuedAt: number | null = null
  let advancedFor: string | null = null
  let lastPlaying: PlayingSample | null = null
  let lastUpdate: EmbedPlaybackUpdate | null = null
  let cancelEnd: CancelTimer | null = null
  let cancelHidden: CancelTimer | null = null
  let cancelGesture: CancelTimer | null = null
  let destroyed = false

  function clearEndTimer() {
    cancelEnd?.()
    cancelEnd = null
    cancelHidden?.()
    cancelHidden = null
  }

  function clearGestureTimer() {
    cancelGesture?.()
    cancelGesture = null
  }

  function resetProgress() {
    sawPlaying = false
    playedIntoTrack = false
    reachedNearEnd = false
    candidateAt = null
    playIssuedAt = null
    advancedFor = null
    lastPlaying = null
    lastUpdate = null
    clearEndTimer()
    clearGestureTimer()
  }

  function currentUri(): string | null {
    return uris[index] ?? null
  }

  function looksEnded(update: EmbedPlaybackUpdate): boolean {
    if (update.isPaused !== true || update.isBuffering) return false
    return (
      playbackUpdateIsNearEnd(update.position, update.duration) ||
      playbackUpdateIsRewoundEnd(update.position, reachedNearEnd)
    )
  }

  function advance() {
    const uri = currentUri()
    if (!uri || advancedFor === uri) return
    advancedFor = uri
    candidateAt = null
    clearEndTimer()
    const nextIndex = index + 1
    if (nextIndex >= uris.length) {
      options.onPhase?.("paused")
      options.onWorkEnded?.(uri)
      return
    }
    index = nextIndex
    const nextUri = uris[index]
    resetProgress()
    options.onTrack?.(nextUri)
    options.onPhase?.("connecting")
    options.onNeedsGesture?.(false)
    transport.loadUri(nextUri)
    transport.play()
  }

  function confirmEnd(force: boolean) {
    if (destroyed || userPaused || candidateAt == null) return
    if (!force && now() - candidateAt < EMBED_END_DEBOUNCE_MS) return
    const update = lastUpdate
    const uri = currentUri()
    if (!update || !uri || !sawPlaying || !looksEnded(update)) return
    advance()
  }

  function armEnd() {
    clearEndTimer()
    const startedAt = candidateAt
    cancelEnd = schedule(() => {
      cancelEnd = null
      if (candidateAt !== startedAt) return
      confirmEnd(false)
    }, EMBED_END_DEBOUNCE_MS)
    if (options.subscribeHidden) {
      cancelHidden = options.subscribeHidden(() => {
        if (candidateAt !== startedAt) return
        confirmEnd(true)
      })
    }
  }

  function loadCurrent() {
    const uri = currentUri()
    if (!uri) return
    resetProgress()
    options.onNeedsGesture?.(false)
    options.onTrack?.(uri)
    options.onPhase?.("connecting")
    transport.loadUri(uri)
    transport.play()
  }

  function noteNearEndFromEstimate(update: EmbedPlaybackUpdate) {
    if (update.isBuffering) return
    if (playbackUpdateIsNearEnd(update.position, update.duration)) {
      reachedNearEnd = true
      return
    }
    const previous = lastPlaying
    if (!previous) return
    const elapsed = Math.max(0, now() - previous.atMs)
    const estimated = previous.positionMs + elapsed
    if (playbackUpdateIsNearEnd(estimated, previous.durationMs)) reachedNearEnd = true
  }

  return {
    start(nextUris, startIndex) {
      if (destroyed) return
      uris = nextUris.filter((uri) => uri.length > 0)
      if (uris.length === 0) return
      const bounded = Number.isInteger(startIndex) && startIndex >= 0 && startIndex < uris.length ? startIndex : 0
      index = bounded
      userPaused = false
      resetProgress()
      const uri = uris[index]
      options.onNeedsGesture?.(false)
      options.onTrack?.(uri)
      options.onPhase?.("connecting")
      transport.loadUri(uri)
      transport.play()
    },
    next() {
      if (destroyed) return
      const uri = currentUri()
      if (!uri) return
      userPaused = false
      candidateAt = null
      clearEndTimer()
      const nextIndex = index + 1
      if (nextIndex >= uris.length) {
        options.onPhase?.("paused")
        options.onWorkEnded?.(uri)
        return
      }
      index = nextIndex
      loadCurrent()
    },
    previous() {
      if (destroyed) return
      if (uris.length === 0) return
      userPaused = false
      candidateAt = null
      clearEndTimer()
      if (index > 0) index -= 1
      loadCurrent()
    },
    pause() {
      if (destroyed) return
      userPaused = true
      candidateAt = null
      clearEndTimer()
      clearGestureTimer()
      options.onNeedsGesture?.(false)
      options.onUserTransport?.()
      options.onPhase?.("paused")
      transport.pause()
    },
    resume() {
      if (destroyed) return
      userPaused = false
      reachedNearEnd = false
      candidateAt = null
      lastPlaying = null
      clearEndTimer()
      options.onNeedsGesture?.(false)
      options.onUserTransport?.()
      options.onPhase?.("connecting")
      transport.resume()
    },
    notePlayDispatched() {
      if (destroyed || userPaused) return
      sawPlaying = false
      playIssuedAt = now()
      clearGestureTimer()
      const issuedAt = playIssuedAt
      cancelGesture = schedule(() => {
        cancelGesture = null
        if (destroyed || userPaused || sawPlaying || playIssuedAt !== issuedAt) return
        options.onNeedsGesture?.(true)
        options.onPhase?.("paused")
      }, EMBED_AUTOPLAY_GRACE_MS)
    },
    onPlaybackUpdate(update) {
      if (destroyed || !update || typeof update.isPaused !== "boolean") return
      const uri = currentUri()
      if (!uri) return
      if (update.playingURI && update.playingURI !== uri) return
      lastUpdate = update

      if (!update.isPaused && !update.isBuffering) {
        sawPlaying = true
        playIssuedAt = null
        clearGestureTimer()
        options.onNeedsGesture?.(false)
        options.onPhase?.("playing")
        const near = playbackUpdateIsNearEnd(update.position, update.duration)
        const reached = playbackUpdateReachedDuration(update.position, update.duration)
        if (near) reachedNearEnd = true
        else reachedNearEnd = false
        if (!near && !reached && update.position > 500) playedIntoTrack = true
        candidateAt = null
        clearEndTimer()
        lastPlaying = { positionMs: update.position, durationMs: update.duration, atMs: now() }
        // Finish in this message. A timer would not run while the tab is hidden,
        // and the embed often stays "playing" with position at the duration.
        if (playedIntoTrack && (reached || (hidden() && near))) advance()
        return
      }

      if (!update.isPaused) return

      if (sawPlaying) options.onPhase?.("paused")
      if (userPaused || update.isBuffering || !sawPlaying) {
        candidateAt = null
        clearEndTimer()
        return
      }

      noteNearEndFromEstimate(update)
      if (playbackUpdateIsNearEnd(update.position, update.duration)) reachedNearEnd = true
      if (!looksEnded(update)) {
        candidateAt = null
        clearEndTimer()
        return
      }
      if (hidden() || playbackUpdateReachedDuration(update.position, update.duration)) {
        advance()
        return
      }
      if (candidateAt == null) {
        candidateAt = now()
        armEnd()
      }
    },
    destroy() {
      destroyed = true
      clearEndTimer()
      clearGestureTimer()
    },
  }
}
