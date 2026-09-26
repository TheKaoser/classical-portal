/**
 * Movement queue for the Spotify iFrame API embed.
 *
 * Chrome will not start playback of a newly navigated embed document while the
 * tab is hidden. Movements of one recording therefore stay inside a single
 * album document (`spotify:album:…`) when playback starts at the first track
 * and that album actually opens on that track. The album advances itself;
 * playback_update is followed, and no further loadUri runs until the work ends.
 * The next work is a different album, so that handoff is requested immediately
 * but does not become audible until the tab is visible again.
 *
 * The embed reports `playingURI` on each playback_update (about once a second)
 * and again on playback_started when the track changes. At the end of a track
 * it first reports `position === duration` for the old URI, still playing, and
 * only then the next URI. A pause issued on that duration tick is ignored —
 * the next album track is already queued — so the last movement is paused
 * while it is still the current URI, a fraction of a second before duration.
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

/**
 * Album `playback_update` events arrive about once a second (observed ~1060ms).
 * While the tab is hidden, timers are clamped or frozen, so the last movement
 * is paused on the update that falls inside this window of the duration.
 */
export const EMBED_ALBUM_UPDATE_GAP_MS = 1_200

/**
 * Pause this long before the last movement's duration. A pause any closer,
 * including on the `position === duration` tick, does not stick: the embed
 * has already committed to the next album track.
 */
export const EMBED_ALBUM_END_LEAD_MS = 400

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
  /**
   * `contextUri` is an album URI. It is used only when starting at the first
   * track, so the embed can advance movements without navigating.
   */
  start: (uris: readonly string[], index: number, contextUri?: string | null) => void
  pause: () => void
  resume: () => void
  /** Skip to the next movement, or end the work on the last one. */
  next: () => void
  /** Restart the previous movement, or the current one when already on the first. */
  previous: () => void
  /** Call when play() or resume() has actually been issued to the controller. */
  notePlayDispatched: () => void
  /** Re-issue play when the tab becomes visible and this load never started. */
  nudgeIfWaiting: () => void
  /** `playback_started` URI, which can arrive without a full playback_update. */
  notePlayingUri: (uri: string) => void
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
  let cancelBoundary: CancelTimer | null = null
  let destroyed = false
  /** Album document is loading, accepted, or not in use. */
  let contextMode: "off" | "pending" | "accepted" = "off"
  /** Saw the new album document (empty URI) so a leftover update is not the album. */
  let contextArmed = false
  /** The work already ended inside an album document. Further unpaused updates are paused. */
  let albumEnded = false
  /** Last track URI the embed reported. An update that omits playingURI keeps it. */
  let reportedUri: string | null = null
  let release: () => void = () => {}

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

  function clearBoundary() {
    cancelBoundary?.()
    cancelBoundary = null
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
    reportedUri = null
    clearEndTimer()
    clearGestureTimer()
    clearBoundary()
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

  function leaveContext() {
    contextMode = "off"
    contextArmed = false
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

  /**
   * Stop the album document. Always pauses: a pause issued on the duration
   * tick is ignored, so a later update for the next track must pause again.
   * `onWorkEnded` runs once. Returns true so the caller stops handling this update.
   * The callback may start the next work and clear `albumEnded`.
   */
  function stopAlbum(): boolean {
    clearBoundary()
    transport.pause()
    if (albumEnded) return true
    const uri = currentUri()
    albumEnded = true
    if (!uri) return true
    advancedFor = uri
    candidateAt = null
    clearEndTimer()
    leaveContext()
    options.onPhase?.("paused")
    options.onWorkEnded?.(uri)
    return true
  }

  /** Track URI from this update. An album URI is not a track. */
  function trackUri(update: EmbedPlaybackUpdate): string {
    const uri = update.playingURI ?? ""
    if (!uri || uri.startsWith("spotify:album:")) return ""
    return uri
  }

  function adoptIndex(next: number) {
    if (uris[next] == null || next === index) return
    index = next
    playedIntoTrack = false
    reachedNearEnd = false
    candidateAt = null
    advancedFor = null
    lastPlaying = null
    clearEndTimer()
    clearBoundary()
    options.onTrack?.(uris[index])
  }

  /**
   * The playhead jumped back to the start after sitting in the last update
   * gap of the previous track. That is the album advancing when `playingURI`
   * was omitted.
   */
  function boundaryRewind(update: EmbedPlaybackUpdate): boolean {
    const previous = lastPlaying
    if (!previous || update.isBuffering || !(update.duration > 0)) return false
    if (!(previous.durationMs > EMBED_ALBUM_UPDATE_GAP_MS)) return false
    if (!(update.position >= 0 && update.position <= EMBED_END_REWIND_MS)) return false
    if (!(update.position < previous.positionMs)) return false
    return previous.positionMs >= previous.durationMs - EMBED_ALBUM_UPDATE_GAP_MS
  }

  /**
   * Pause the last movement while it is still the current URI.
   * Returns true when the work was stopped in this call.
   */
  function armAlbumBoundary(update: EmbedPlaybackUpdate): boolean {
    if (userPaused || albumEnded) return false
    if (!(update.duration > EMBED_ALBUM_END_LEAD_MS) || !(update.position > 0)) {
      clearBoundary()
      return false
    }
    const remaining = update.duration - update.position
    if (remaining <= 0) {
      // position === duration still carries the old URI, and pause does not stick.
      clearBoundary()
      return false
    }
    if (hidden() || remaining <= EMBED_ALBUM_END_LEAD_MS) {
      if (remaining <= EMBED_ALBUM_UPDATE_GAP_MS) return stopAlbum()
      clearBoundary()
      return false
    }
    const delay = remaining - EMBED_ALBUM_END_LEAD_MS
    clearBoundary()
    const armedIndex = index
    cancelBoundary = schedule(() => {
      cancelBoundary = null
      if (destroyed || userPaused || albumEnded || index !== armedIndex) return
      stopAlbum()
    }, delay)
    return false
  }

  function confirmEnd(force: boolean) {
    if (destroyed || userPaused || candidateAt == null) return
    if (!force && now() - candidateAt < EMBED_END_DEBOUNCE_MS) return
    const update = lastUpdate
    const uri = currentUri()
    if (!update || !uri || !sawPlaying || !looksEnded(update)) return
    release()
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
    albumEnded = false
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
    start(nextUris, startIndex, contextUri) {
      if (destroyed) return
      uris = nextUris.filter((uri) => uri.length > 0)
      if (uris.length === 0) return
      const bounded = Number.isInteger(startIndex) && startIndex >= 0 && startIndex < uris.length ? startIndex : 0
      index = bounded
      userPaused = false
      albumEnded = false
      leaveContext()
      resetProgress()
      const uri = uris[index]
      const album = bounded === 0 && typeof contextUri === "string" && contextUri.length > 0 ? contextUri : null
      options.onNeedsGesture?.(false)
      options.onTrack?.(uri)
      options.onPhase?.("connecting")
      if (album && album !== uri) {
        contextMode = "pending"
        contextArmed = false
        transport.loadUri(album)
      } else {
        transport.loadUri(uri)
      }
      transport.play()
    },
    next() {
      if (destroyed) return
      const uri = currentUri()
      if (!uri) return
      userPaused = false
      candidateAt = null
      clearEndTimer()
      clearBoundary()
      const nextIndex = index + 1
      if (nextIndex >= uris.length) {
        if (contextMode !== "off") stopAlbum()
        else {
          options.onPhase?.("paused")
          options.onWorkEnded?.(uri)
        }
        return
      }
      leaveContext()
      albumEnded = false
      index = nextIndex
      loadCurrent()
    },
    previous() {
      if (destroyed) return
      if (uris.length === 0) return
      userPaused = false
      candidateAt = null
      clearEndTimer()
      clearBoundary()
      leaveContext()
      albumEnded = false
      if (index > 0) index -= 1
      loadCurrent()
    },
    pause() {
      if (destroyed) return
      userPaused = true
      candidateAt = null
      clearEndTimer()
      clearGestureTimer()
      clearBoundary()
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
      clearBoundary()
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
    nudgeIfWaiting() {
      if (destroyed || userPaused || sawPlaying || albumEnded) return
      transport.play()
    },
    notePlayingUri(uri: string) {
      if (destroyed || !uri || uri.startsWith("spotify:album:")) return
      this.onPlaybackUpdate({
        playingURI: uri,
        isPaused: false,
        isBuffering: true,
        duration: 0,
        position: 0,
      })
    },
    onPlaybackUpdate(update) {
      if (destroyed || !update || typeof update.isPaused !== "boolean") return
      if (albumEnded) {
        // The duration-tick pause is dropped. Pause again until the embed is paused
        // or the next work replaces this queue.
        if (!update.isPaused) transport.pause()
        return
      }
      if (contextMode === "pending") {
        const playing = trackUri(update)
        if (!playing) {
          contextArmed = true
          return
        }
        if (playing === uris[0]) {
          contextMode = "accepted"
          reportedUri = playing
        } else if (contextArmed) {
          leaveContext()
          loadCurrent()
          return
        } else {
          return
        }
      }
      if (contextMode === "accepted") {
        const playing = trackUri(update)
        if (playing) reportedUri = playing
        if (playing) {
          const at = uris.indexOf(playing)
          if (at < 0) {
            stopAlbum()
            return
          }
          if (at !== index) adoptIndex(at)
        } else if (boundaryRewind(update)) {
          const nextIndex = index + 1
          if (nextIndex >= uris.length) {
            stopAlbum()
            return
          }
          adoptIndex(nextIndex)
        }

        if (update.isBuffering) return

        const onLast = index >= uris.length - 1
        if (!update.isPaused) {
          clearGestureTimer()
          if (onLast) {
            if (armAlbumBoundary(update)) return
          } else {
            clearBoundary()
          }
          sawPlaying = true
          playIssuedAt = null
          options.onNeedsGesture?.(false)
          options.onPhase?.("playing")
          if (update.position > 500) playedIntoTrack = true
          lastPlaying = { positionMs: update.position, durationMs: update.duration, atMs: now() }
          return
        }

        if (sawPlaying && !userPaused) options.onPhase?.("paused")
        if (!onLast || userPaused) {
          clearBoundary()
          return
        }
        release = stopAlbum
      } else {
        const uri = currentUri()
        if (!uri) return
        if (update.playingURI && update.playingURI !== uri && !update.playingURI.startsWith("spotify:album:")) return
        release = advance
      }
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
        // The last 1.5s is not the end: navigating that early cuts the track,
        // and the next document will not start until the tab is visible.
        if (playedIntoTrack && reached) release()
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
        release()
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
      clearBoundary()
    },
  }
}
