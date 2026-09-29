/**
 * Track URI helpers for in-page playback.
 * The embed plays one movement URI at a time. It does not load an album:
 * an album document keeps playing later works on that album. Matching stays
 * on the server.
 */

const TRACK_URI = /^spotify:track:[A-Za-z0-9]+$/
const TRACK_URI_ID = /^spotify:track:([A-Za-z0-9]+)(?:[?#].*)?$/
const TRACK_ID = /^[A-Za-z0-9]+$/
const ALBUM_ID = /^[A-Za-z0-9]{10,32}$/

export function isSpotifyTrackUri(uri: string): boolean {
  return TRACK_URI.test(uri)
}

/**
 * Spotify album id check for catalog data. Not an embed target — loading
 * `spotify:album:…` plays every later track on that album.
 */
export function spotifyAlbumUri(albumId: string | null | undefined): string | null {
  if (!albumId || !ALBUM_ID.test(albumId)) return null
  return `spotify:album:${albumId}`
}

/**
 * Track URI from an embed `playingURI`. Spotify reports either `spotify:track:…`
 * or an open.spotify.com track URL. Anything else (album, playlist) is not a movement.
 */
export function canonicalSpotifyTrackUri(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const direct = TRACK_URI_ID.exec(trimmed)
  if (direct) return `spotify:track:${direct[1]}`
  try {
    const url = new URL(trimmed)
    const host = url.hostname.toLowerCase()
    if (host !== "spotify.com" && !host.endsWith(".spotify.com")) return null
    const parts = url.pathname.split("/").filter(Boolean)
    const trackAt = parts.lastIndexOf("track")
    const id = trackAt >= 0 ? parts[trackAt + 1] : ""
    if (id && TRACK_ID.test(id)) return `spotify:track:${id}`
  } catch {
    return null
  }
  return null
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
