/** Shown when the Spotify token was granted before playlist-modify scopes. */
export const PLAYLIST_RECONNECT_MESSAGE = "Reconnect Spotify to allow saving playlists."

/** Shown when the Spotify token was granted before user-library scopes. */
export const LIBRARY_RECONNECT_MESSAGE = "Reconnect Spotify to allow saving liked tracks."

export type PlaylistWriteCode = "insufficient_scope" | "not_connected" | "save_failed"

const TRACK_URI = /^spotify:track:[A-Za-z0-9]+$/
const PLAYLIST_ID = /^[A-Za-z0-9]{10,40}$/

export type CachedPlaylist = {
  id: string
  url: string
}

export type PendingPlaylist = {
  name: string
  uris: string[]
  recordingId: string
}

export type PlaylistCreateResult =
  | { ok: true; playlist: CachedPlaylist }
  | { ok: false; error: string; status: number; code?: PlaylistWriteCode }

export type PlaybackEmbed =
  | { kind: "playlist"; id: string; title: string; height: number }
  | { kind: "track"; id: string; title: string; height: number }

export type PlaybackAction = { type: "none" } | { type: "embed-cached"; id: string; url: string }

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

/** Private playlist title from the work, e.g. "Brahms Piano Concerto no. 2". */
export function classicalPlaylistName(composerName: string, workTitle: string): string {
  const body = [composerName, workTitle]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
  const name = body || "Playlist"
  return name.slice(0, 100)
}

export function classicalPlaylistDescription(playlistName: string): string {
  const text = `Private playlist so these movements play in order. ${playlistName}. Created by Classical Portal.`
  return text.replace(/\s+/g, " ").trim().slice(0, 300)
}

/** Spotify track id from `spotify:track:…`, or null when the URI is invalid. */
export function spotifyTrackIdFromUri(uri: string): string | null {
  if (!isSpotifyTrackUri(uri)) return null
  return uri.slice("spotify:track:".length)
}

/** One current movement to save into Liked Songs. */
export function saveTrackRequest(input: { uri?: unknown }): { uri: string; id: string } | null {
  if (typeof input.uri !== "string" || !isSpotifyTrackUri(input.uri)) return null
  const id = spotifyTrackIdFromUri(input.uri)
  if (!id) return null
  return { uri: input.uri, id }
}

/** Save Tracks for Current User — Liked Songs, not a private playlist. */
export function spotifySaveLikedTracksUrl(): string {
  return "https://api.spotify.com/v1/me/tracks"
}

/** Check User's Saved Tracks. */
export function spotifyCheckLikedTracksUrl(ids: string[]): string | null {
  const clean = ids.filter((id) => /^[A-Za-z0-9]+$/.test(id)).slice(0, 50)
  if (clean.length === 0) return null
  return `https://api.spotify.com/v1/me/tracks/contains?ids=${encodeURIComponent(clean.join(","))}`
}

/** Liked Songs need `user-library-modify`. Older grants without it must reconnect. */
export function tokenCanSaveLikedTracks(scope: string | null | undefined): boolean {
  if (!scope) return false
  return scope.split(/\s+/).includes("user-library-modify")
}

/** Reading Liked Songs state needs `user-library-read`. */
export function tokenCanReadLikedTracks(scope: string | null | undefined): boolean {
  if (!scope) return false
  return scope.split(/\s+/).includes("user-library-read")
}

export function spotifyPlaylistCreateBody(input: { name: string; description?: string }): {
  name: string
  description: string
  public: false
} {
  return {
    name: input.name.trim().slice(0, 100),
    description: (input.description || "Created by Classical Portal").trim().slice(0, 300),
    public: false,
  }
}

/**
 * Create Playlist for the current user.
 * `POST /users/{id}/playlists` returns 403 for Development Mode apps after the
 * February 2026 Web API migration, even when the token has playlist scopes.
 */
export function spotifyCreatePlaylistUrl(): string {
  return "https://api.spotify.com/v1/me/playlists"
}

/**
 * Add Items to Playlist. `POST /playlists/{id}/tracks` is the removed name of
 * this endpoint and also returns 403 in Development Mode.
 */
export function spotifyAddPlaylistItemsUrl(playlistId: string): string | null {
  if (!PLAYLIST_ID.test(playlistId)) return null
  return `https://api.spotify.com/v1/playlists/${playlistId}/items`
}

/** Private playlists require `playlist-modify-private`. Public-only grants cannot set `public: false`. */
export function tokenCanSavePrivatePlaylist(scope: string | null | undefined): boolean {
  if (!scope) return false
  return scope.split(/\s+/).includes("playlist-modify-private")
}

function spotifyErrorMessage(payload: unknown): string {
  if (typeof payload === "string") return payload.trim()
  if (!payload || typeof payload !== "object") return ""
  const error = "error" in payload ? (payload as { error?: unknown }).error : undefined
  if (typeof error === "string") return error.trim()
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string") return message.trim()
  }
  if ("message" in payload && typeof (payload as { message?: unknown }).message === "string") {
    return (payload as { message: string }).message.trim()
  }
  return ""
}

/**
 * Map a Spotify playlist or library write failure to a body the UI can show.
 * Insufficient scope asks the listener to reconnect; other failures keep Spotify's message.
 */
export function classifySpotifyPlaylistWriteError(
  status: number,
  payload: unknown,
  fallback: string,
  reconnectMessage: string = PLAYLIST_RECONNECT_MESSAGE
): { code: PlaylistWriteCode; message: string; status: number } {
  const spotifyMessage = spotifyErrorMessage(payload).replace(/\s+/g, " ").slice(0, 180)
  if (status === 401 || /invalid access token|token expired/i.test(spotifyMessage)) {
    return { code: "not_connected", message: "Spotify login expired. Sign in again.", status: 401 }
  }
  if (/scope/i.test(spotifyMessage) || /insufficient client/i.test(spotifyMessage)) {
    return { code: "insufficient_scope", message: reconnectMessage, status: 403 }
  }
  const http = status >= 400 && status < 600 ? status : 502
  const message = spotifyMessage ? `${fallback}. Spotify said: ${spotifyMessage}.` : fallback
  return { code: "save_failed", message, status: http }
}

export function playlistCacheKey(userId: string, uris: string[]): string {
  return `${userId}\n${uris.join("\n")}`
}

export function rememberPlaylistCache(
  cache: Record<string, CachedPlaylist>,
  key: string,
  value: CachedPlaylist,
  limit = 40
): Record<string, CachedPlaylist> {
  const next = { ...cache }
  delete next[key]
  next[key] = value
  const entries = Object.entries(next)
  return Object.fromEntries(entries.slice(Math.max(0, entries.length - limit)))
}

export function sanitizePlaylistCache(value: unknown): Record<string, CachedPlaylist> {
  if (!value || typeof value !== "object") return {}
  const cache: Record<string, CachedPlaylist> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue
    const id = (entry as { id?: unknown }).id
    const url = (entry as { url?: unknown }).url
    if (typeof id === "string" && id && typeof url === "string" && url) cache[key] = { id, url }
  }
  return cache
}

export function parsePendingPlaylist(raw: string): PendingPlaylist | null {
  try {
    const value = JSON.parse(raw) as Partial<PendingPlaylist> | null
    if (!value || typeof value.name !== "string" || typeof value.recordingId !== "string") return null
    if (!Array.isArray(value.uris)) return null
    const uris = uniqueTrackUris(value.uris.filter((uri): uri is string => typeof uri === "string"))
    const name = value.name.trim()
    if (!name || uris.length < 2 || !value.recordingId) return null
    return { name: name.slice(0, 100), uris, recordingId: value.recordingId }
  } catch {
    return null
  }
}

/**
 * Playlist-vs-track embed choice kept for the playlist helpers. Playback uses
 * the Spotify iFrame API, one movement URI at a time, not these playlist embeds.
 */
export function choosePlaybackEmbed(input: {
  trackCount: number
  playlistId: string | null
  playlistTitle: string
  selectedTrack: { id: string; name: string } | null
  preferSingleTrack: boolean
}): PlaybackEmbed | null {
  const multi = input.trackCount > 1
  if (multi && input.playlistId && !input.preferSingleTrack) {
    return { kind: "playlist", id: input.playlistId, title: input.playlistTitle, height: 352 }
  }
  if (input.selectedTrack) {
    return {
      kind: "track",
      id: input.selectedTrack.id,
      title: input.selectedTrack.name,
      height: 152,
    }
  }
  return null
}

/**
 * A multi-track group embeds a playlist that already exists. Creating one is
 * Play all (or the resume after Spotify login), not a side effect of opening the page.
 */
export function nextPlaybackAction(input: {
  trackCount: number
  hasPlaylist: boolean
  cached: CachedPlaylist | null
}): PlaybackAction {
  if (input.trackCount < 2 || input.hasPlaylist) return { type: "none" }
  if (input.cached) return { type: "embed-cached", id: input.cached.id, url: input.cached.url }
  return { type: "none" }
}

const playlistCreates = new Map<string, Promise<PlaylistCreateResult>>()

/** Share one Spotify create call per track list, including across a strict-mode remount. */
export function dedupePlaylistCreate(
  key: string,
  create: () => Promise<PlaylistCreateResult>,
  inflight: Map<string, Promise<PlaylistCreateResult>> = playlistCreates
): Promise<PlaylistCreateResult> {
  const existing = inflight.get(key)
  if (existing) return existing
  const promise = create().then(
    (result) => {
      if (!result.ok) inflight.delete(key)
      return result
    },
    (error: unknown) => {
      inflight.delete(key)
      throw error
    }
  )
  inflight.set(key, promise)
  return promise
}
