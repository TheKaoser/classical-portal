/**
 * Track URI helpers for in-page playback.
 * The embed plays these URIs one movement at a time. Matching stays on the server.
 */

const TRACK_URI = /^spotify:track:[A-Za-z0-9]+$/

export function isSpotifyTrackUri(uri: string): boolean {
  return TRACK_URI.test(uri)
}

/** Keep valid track URIs in the order they were matched. */
export function orderedTrackUris(tracks: { uri: string }[]): string[] {
  return uniqueTrackUris(tracks.map((track) => track.uri))
}

export function uniqueTrackUris(uris: string[]): string[] {
  const unique: string[] = []
  for (const uri of uris) {
    if (isSpotifyTrackUri(uri) && !unique.includes(uri)) unique.push(uri)
  }
  return unique
}
