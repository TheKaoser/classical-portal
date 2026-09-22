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
