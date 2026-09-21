export const PLAYLIST_NAME_PREFIX = "Classical Portal"

const TRACK_URI = /^spotify:track:[A-Za-z0-9]+$/

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
  | { ok: false; error: string; status: number }

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

/** Private playlist title, e.g. "Classical Portal · Brahms Piano Concerto no. 2". */
export function classicalPlaylistName(composerName: string, workTitle: string): string {
  const body = [composerName, workTitle]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
  const name = body ? `${PLAYLIST_NAME_PREFIX} · ${body}` : PLAYLIST_NAME_PREFIX
  return name.slice(0, 100)
}

export function classicalPlaylistDescription(playlistName: string): string {
  const text = `Private playlist so these movements play in order. ${playlistName}. Created by Classical Portal.`
  return text.replace(/\s+/g, " ").trim().slice(0, 300)
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
 * Multi-track groups play from the playlist embed once it exists, unless the
 * listener picked a single movement. Single-track groups stay on the track embed.
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
