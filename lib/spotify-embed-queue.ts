/**
 * Movement queue for the Spotify iFrame API embed.
 *
 * The iFrame API can load one entity at a time (`loadUri` / `loadEntity`).
 * It has no queue method. Loading `spotify:album:…` puts the rest of the album
 * in the embed, so after this work's last movement Spotify keeps playing later
 * tracks. Pausing just before that boundary does not stick: the next album
 * track is already committed, and a logged-in session may not report the
 * track URI the pause logic was watching.
 *
 * Each movement is therefore its own track document. When that document
 * finishes, the next movement URI is loaded. The work then stops, or the
 * page starts the next queued work.
 *
 * Chrome does not start a new embed document in a hidden tab. `loadUri`
 * navigates the iframe (`iframe.src`), and that is a new media document, so
 * autoplay is blocked until the tab is in the foreground. A later `play()`
 * on the document that was rejected while hidden does not reliably start
 * when the tab returns. Album playback used to avoid this because Spotify
 * advanced inside one document, and that also played past the work.
 *
 * Automatic advance therefore does not navigate while the tab is hidden. The
 * current document can finish in the background. The next movement is
 * recorded (the highlight follows it) and loaded from `nudgeIfWaiting` once
 * the tab is visible. A direct next, previous, or resume still tries
 * immediately, and if that load is never heard it is loaded again on return.
 * Nothing here loads an album, so playback cannot continue into later works.
 *
 * The embed reports `playingURI` on `playback_update` (about once a second)
 * and on `playback_started` when the track changes. That URI is a track URI
 * or an open.spotify.com track URL. While it stays inside this work, the
 * matching movement is the current one. Any other track leaves the work.
 */

import { canonicalSpotifyTrackUri } from "./spotify-playback.ts"

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
 * Safari (and other autoplay blocks) leave the embed paused. The queue does
 * not skip ahead; the embed stays loaded and the next visibility or play
 * control starts it.
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
  onUserTransport?: () => void
}

export type MovementQueue = {
  /** Load `uris[index]` and play it. Later movements load as each one ends. */
  start: (uris: readonly string[], index: number) => void
  pause: () => void
  resume: () => void
  /** Skip to the next movement, or end the work on the last one. */
  next: () => void
  /** Restart the previous movement, or the current one when already on the first. */
  previous: () => void
  /** Call when play() or resume() has actually been issued to the controller. */
  notePlayDispatched: () => void
  /**
   * The tab is visible again, or the window regained focus.
   * Loads a movement that was held while hidden, reloads a hidden `loadUri`
   * that never became audible, or re-issues play when a visible load is
   * still waiting.
   */
  nudgeIfWaiting: () => void
  /** The tab's visibility changed. A backgrounded playhead may end unseen. */
  notePageHidden: (isHidden: boolean) => void
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
  let destroyed = false
  /** The embed has reported this load's track URI, so a different URI is a real change. */
  let heardTrack = false
  /** This work already finished. Further unpaused updates are paused again. */
  let workEnded = false
  /** The embed left our track, so resume must reload the movement instead of continuing it. */
  let needsReload = false
  /**
   * Next movement (or next work's first movement) chosen while hidden.
   * The embed document is left in place until the tab can start a new one.
   */
  let awaitingVisible: string | null = null
  /** `loadUri` ran while hidden and this movement has not been heard playing. */
  let unheardHiddenLoad = false
  /** Playback had started when the tab went to the background. */
  let leftWhilePlaying = false
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

  function resetProgress() {
    sawPlaying = false
    playedIntoTrack = false
    reachedNearEnd = false
    candidateAt = null
    playIssuedAt = null
    advancedFor = null
    lastPlaying = null
    lastUpdate = null
    heardTrack = false
    unheardHiddenLoad = false
    leftWhilePlaying = false
    clearEndTimer()
    clearGestureTimer()
  }

  function currentUri(): string | null {
    return uris[index] ?? null
  }

  function looksEnded(update: EmbedPlaybackUpdate): boolean {
    if (update.isPaused !== true || update.isBuffering) return false
    if (
      playbackUpdateIsNearEnd(update.position, update.duration) ||
      playbackUpdateIsRewoundEnd(update.position, reachedNearEnd)
    ) {
      return true
    }
    // A frozen background tab often delivers only the rewound playhead, after
    // the near-end samples were dropped. A visible scrub to the start does not
    // take this path: `leftWhilePlaying` is set only from a backgrounded tab.
    return (hidden() || leftWhilePlaying) && playedIntoTrack && update.position <= EMBED_END_REWIND_MS
  }

  /**
   * The current movement is over. On the last one, pause so a collection
   * document cannot continue, and tell the page the work ended. Otherwise
   * load the next movement.
   */
  function advance() {
    const uri = currentUri()
    if (!uri || advancedFor === uri || workEnded) return
    advancedFor = uri
    candidateAt = null
    clearEndTimer()
    const nextIndex = index + 1
    if (nextIndex >= uris.length) {
      finishWork()
      return
    }
    index = nextIndex
    loadCurrent(false)
  }

  function finishWork() {
    awaitingVisible = null
    unheardHiddenLoad = false
    transport.pause()
    if (workEnded) return
    const uri = currentUri()
    workEnded = true
    if (!uri) return
    advancedFor = uri
    candidateAt = null
    clearEndTimer()
    options.onPhase?.("paused")
    options.onWorkEnded?.(uri)
  }

  function stopOutside() {
    needsReload = true
    finishWork()
  }

  /**
   * Remember `uri` and keep the current embed document. Navigating now would
   * be a new media document, which Chrome will not start in a hidden tab.
   */
  function holdForVisible(uri: string) {
    resetProgress()
    awaitingVisible = uri
    unheardHiddenLoad = false
    workEnded = false
    needsReload = false
    options.onTrack?.(uri)
    options.onPhase?.("paused")
    transport.pause()
  }

  function beginAudible(uri: string) {
    const inBackground = hidden()
    awaitingVisible = null
    workEnded = false
    needsReload = false
    resetProgress()
    unheardHiddenLoad = inBackground
    options.onTrack?.(uri)
    options.onPhase?.("connecting")
    transport.loadUri(uri)
    transport.play()
  }

  function loadCurrent(force: boolean) {
    const uri = currentUri()
    if (!uri) return
    if (!force && hidden()) {
      holdForVisible(uri)
      return
    }
    beginAudible(uri)
  }

  /** This playhead is the movement we loaded, and it is actually moving. */
  function confirmsLoadedTrack(update: EmbedPlaybackUpdate, reported: string | null, uri: string): boolean {
    if (update.isPaused || update.isBuffering) return false
    if (reported !== uri) return false
    return !playbackUpdateReachedDuration(update.position, update.duration)
  }

  /**
   * Spotify moved to another track. Stay on a movement of this work by loading
   * that track alone. Any other track ends the work.
   */
  function followReported(reported: string) {
    const at = uris.indexOf(reported)
    if (at < 0) {
      stopOutside()
      return
    }
    if (at === index) return
    index = at
    loadCurrent(false)
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
      workEnded = false
      needsReload = false
      awaitingVisible = null
      loadCurrent(false)
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
        finishWork()
        return
      }
      workEnded = false
      needsReload = false
      index = nextIndex
      loadCurrent(true)
    },
    previous() {
      if (destroyed) return
      if (uris.length === 0) return
      userPaused = false
      candidateAt = null
      clearEndTimer()
      workEnded = false
      needsReload = false
      if (index > 0) index -= 1
      loadCurrent(true)
    },
    pause() {
      if (destroyed) return
      userPaused = true
      unheardHiddenLoad = false
      candidateAt = null
      clearEndTimer()
      clearGestureTimer()
      options.onUserTransport?.()
      options.onPhase?.("paused")
      transport.pause()
    },
    resume() {
      if (destroyed) return
      const reload = needsReload || awaitingVisible != null || unheardHiddenLoad
      userPaused = false
      workEnded = false
      needsReload = false
      reachedNearEnd = false
      candidateAt = null
      lastPlaying = null
      clearEndTimer()
      options.onUserTransport?.()
      if (reload) {
        loadCurrent(true)
        return
      }
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
        options.onPhase?.("paused")
      }, EMBED_AUTOPLAY_GRACE_MS)
    },
    notePageHidden(isHidden) {
      if (destroyed) return
      if (isHidden && (sawPlaying || playedIntoTrack)) leftWhilePlaying = true
    },
    nudgeIfWaiting() {
      if (destroyed || userPaused || workEnded || hidden()) return
      if (awaitingVisible || unheardHiddenLoad) {
        loadCurrent(true)
        return
      }
      if (sawPlaying) return
      transport.play()
    },
    notePlayingUri(uri: string) {
      if (destroyed || !uri || uri.startsWith("spotify:album:")) return
      const track = canonicalSpotifyTrackUri(uri)
      if (!track) return
      this.onPlaybackUpdate({
        playingURI: track,
        isPaused: false,
        isBuffering: true,
        duration: 0,
        position: 0,
      })
    },
    onPlaybackUpdate(update) {
      if (destroyed || !update || typeof update.isPaused !== "boolean") return
      if (workEnded) {
        if (!update.isPaused) transport.pause()
        return
      }
      if (awaitingVisible) {
        // Still the previous document. Starting the held movement replaces it
        // once the tab can actually play a new one.
        if (!hidden() && !userPaused) loadCurrent(true)
        return
      }
      const uri = currentUri()
      if (!uri) return
      release = advance

      const reported = canonicalSpotifyTrackUri(update.playingURI)
      if (reported && reported !== uri) {
        // Until this load has been heard, a different URI is the previous document.
        if (!heardTrack || userPaused) return
        followReported(reported)
        return
      }
      if (reported === uri) heardTrack = true
      // A missing or album URI does not name a movement. Position still advances
      // the queue, which is what keeps the highlight moving when Spotify omits
      // the track id.

      lastUpdate = update

      if (!update.isPaused && !update.isBuffering) {
        sawPlaying = true
        playIssuedAt = null
        clearGestureTimer()
        options.onPhase?.("playing")
        const near = playbackUpdateIsNearEnd(update.position, update.duration)
        const reached = playbackUpdateReachedDuration(update.position, update.duration)
        if (near) reachedNearEnd = true
        else reachedNearEnd = false
        if (!near && !reached && update.position > 500) playedIntoTrack = true
        if (confirmsLoadedTrack(update, reported, uri)) unheardHiddenLoad = false
        if (hidden() && playedIntoTrack) leftWhilePlaying = true
        if (!hidden() && playedIntoTrack && !near && !reached) leftWhilePlaying = false
        candidateAt = null
        clearEndTimer()
        lastPlaying = { positionMs: update.position, durationMs: update.duration, atMs: now() }
        // Finish in this message. A timer would not run while the tab is hidden,
        // and the embed often stays "playing" with position at the duration.
        // The last 1.5s is not the end: navigating that early cuts the track.
        // While hidden, release records the next movement and does not navigate.
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
      if (hidden() || leftWhilePlaying || playbackUpdateReachedDuration(update.position, update.duration)) {
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
    },
  }
}
