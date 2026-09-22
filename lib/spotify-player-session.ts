/**
 * Layout-level Spotify playback session helpers.
 * The Web Playback SDK player lives in a root provider so client navigations
 * do not unmount it or clear an active play request.
 */

/** True while the shared player has a queued/playing URI list. */
export function isPlaybackSessionActive(playRequest: { uris: string[] } | null): boolean {
  return Boolean(playRequest && playRequest.uris.length > 0)
}

/**
 * Album row accent while browsing. The playing album stays highlighted even
 * after leaving its work page; a selected album on another page still accents
 * when a different recording is already playing.
 */
export function isAlbumRowActive(input: {
  recordingId: string
  selected: boolean
  playRequestRecordingId: string | null
}): boolean {
  const playingThis = input.playRequestRecordingId === input.recordingId
  return playingThis || (input.selected && input.playRequestRecordingId !== input.recordingId)
}
