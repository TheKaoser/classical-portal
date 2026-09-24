/**
 * Layout-level Spotify playback session helpers.
 * The Web Playback SDK player lives in a root provider so client navigations
 * do not unmount it or clear an active play request.
 */

/** SDK-driven phase from `player_state_changed` (plus connecting/idle). */
export type PlaybackControlPhase = "idle" | "connecting" | "playing" | "paused"

/** True while the shared player has a queued/playing URI list. */
export function isPlaybackSessionActive(playRequest: { uris: string[] } | null): boolean {
  return Boolean(playRequest && playRequest.uris.length > 0)
}

/**
 * Map Web Playback SDK `state.paused` onto the control phase used by the
 * floating bar and album Play button.
 */
export function phaseFromPlayerPaused(paused: boolean): "playing" | "paused" {
  return paused ? "paused" : "playing"
}

/**
 * The SDK has no track-ended event. A finished context pauses on the last
 * track and usually rewinds the playhead to 0. Samples this close to the
 * duration still count as having reached the end.
 */
export const PLAYBACK_END_REACHED_SLACK_MS = 2_000

/** Paused this close to the duration, after the playhead had reached the end. */
export const PLAYBACK_END_PARKED_MS = 1_500

/** A natural completion often reports the finished track at this position. */
export const PLAYBACK_END_REWIND_MS = 1_000

/**
 * Still-playing samples inside this window mean the playhead is sitting on
 * the end. Wider than a poll step so the tail is not cut off early.
 */
export const PLAYBACK_END_STUCK_MS = 300

/** Last playing sample for one track, used to tell a natural end from a pause. */
export type PlaybackProgress = {
  uri: string
  positionMs: number
  durationMs: number
  paused: boolean
  atMs: number
}

/**
 * True when the Web Playback SDK state change is the current context finishing
 * on its own. A listener pause keeps the playhead where they stopped; the SDK
 * does not rewind that pause to 0. `userPaused` covers a pause in the last
 * moments, which would otherwise look like the ending.
 */
export function playbackNaturalEnd(input: {
  previous: PlaybackProgress | null
  next: { paused: boolean; positionMs: number; durationMs: number; uri: string }
  nowMs: number
  userPaused: boolean
  isLastInContext: boolean
}): boolean {
  if (input.userPaused || !input.isLastInContext) return false
  const previous = input.previous
  const next = input.next
  if (!previous || !next.uri || previous.uri !== next.uri || previous.positionMs <= 0) return false
  const duration = next.durationMs > 0 ? next.durationMs : previous.durationMs
  if (duration <= 0) return false

  const atStuckEnd = (positionMs: number) => positionMs >= duration - PLAYBACK_END_STUCK_MS
  if (!previous.paused && !next.paused && atStuckEnd(previous.positionMs) && atStuckEnd(next.positionMs)) {
    return true
  }

  if (!next.paused || previous.paused) return false
  const elapsed = Math.max(0, input.nowMs - previous.atMs)
  const estimated = previous.positionMs + elapsed
  if (estimated < duration - PLAYBACK_END_REACHED_SLACK_MS) return false
  const rewound = next.positionMs <= PLAYBACK_END_REWIND_MS && next.positionMs + 500 < previous.positionMs
  const parked = next.positionMs >= duration - PLAYBACK_END_PARKED_MS && next.positionMs > PLAYBACK_END_REWIND_MS
  return rewound || parked
}

/** Label for the shared play/pause control. */
export function playbackControlLabel(phase: PlaybackControlPhase): "Play" | "Pause" | "Connecting…" {
  if (phase === "connecting") return "Connecting…"
  if (phase === "playing") return "Pause"
  return "Play"
}

/** True when the control should show Pause (music is actively playing). */
export function playbackControlShowsPause(phase: PlaybackControlPhase): boolean {
  return phase === "playing"
}

/**
 * Click intent for an already-armed session. Start/restart stays outside this —
 * callers begin a new play request when the session is idle or for another album.
 */
export function playbackControlAction(phase: PlaybackControlPhase): "pause" | "resume" | "none" {
  if (phase === "playing") return "pause"
  if (phase === "paused") return "resume"
  return "none"
}

/**
 * Album-row Play shares the provider phase when this recording is the active
 * session; otherwise it starts that album from the first movement.
 */
export function albumPlaybackControl(input: {
  recordingId: string
  playRequestRecordingId: string | null
  playerPhase: PlaybackControlPhase
}): {
  label: "Play" | "Pause" | "Connecting…"
  action: "start" | "pause" | "resume" | "none"
  pressed: boolean
} {
  const isThis = input.playRequestRecordingId === input.recordingId
  if (!isThis) {
    return { label: "Play", action: "start", pressed: false }
  }
  if (input.playerPhase === "connecting") {
    return { label: "Connecting…", action: "none", pressed: false }
  }
  if (input.playerPhase === "playing") {
    return { label: "Pause", action: "pause", pressed: true }
  }
  if (input.playerPhase === "paused") {
    return { label: "Play", action: "resume", pressed: false }
  }
  return { label: "Play", action: "start", pressed: false }
}

/**
 * Album row blue/playing accent. Only the recording that owns the global
 * play request is highlighted — expanding or selecting an album to browse
 * movements must not reuse the playing color.
 */
export function isAlbumRowActive(input: {
  recordingId: string
  playRequestRecordingId: string | null
}): boolean {
  return input.playRequestRecordingId === input.recordingId
}
