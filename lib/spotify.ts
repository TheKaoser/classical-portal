import {
  buildSearchQueries,
  clusterTracks,
  fillAlbumGaps,
  parseWork,
  scoreTrack,
  type RecordingGroup,
  type ScoredTrack,
  type TrackLike,
  type WorkQuery,
} from "@/lib/spotify-match"

export type { RecordingGroup, WorkQuery }

export type SpotifyTrackMatch = {
  id: string
  name: string
  uri: string
  url: string
  image: string | null
  artists: string
  album: string
  albumId: string
  durationMs: number
  previewUrl: string | null
  trackNumber: number
  discNumber: number
}

export type SpotifyRecording = {
  id: string
  album: string
  albumId: string
  image: string | null
  artists: string
  tracks: SpotifyTrackMatch[]
}

export type SpotifyMatches = {
  configured: boolean
  oauthConfigured: boolean
  query: string
  searchUrl: string
  recordings: SpotifyRecording[]
}

type TokenCache = {
  accessToken: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

function spotifySearchUrl(query: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`
}

async function getClientCredentialsToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  })

  if (!res.ok) {
    console.error("Spotify token request failed", res.status, await res.text().catch(() => ""))
    return null
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return tokenCache.accessToken
}

type SpotifyImage = { url: string; height: number | null; width: number | null }
type SpotifyArtistRef = { name: string }

type RawTrack = {
  id: string
  name: string
  uri: string
  duration_ms: number
  preview_url: string | null
  track_number?: number
  disc_number?: number
  artists?: SpotifyArtistRef[]
  album?: {
    id?: string
    name?: string
    images?: SpotifyImage[]
    total_tracks?: number
  }
  external_urls?: { spotify?: string }
}

type RawAlbumTrack = {
  id: string
  name: string
  uri: string
  duration_ms: number
  preview_url: string | null
  track_number?: number
  disc_number?: number
  artists?: SpotifyArtistRef[]
  external_urls?: { spotify?: string }
}

function pickImage(images?: SpotifyImage[]): string | null {
  if (!images?.length) return null
  return images[images.length - 1]?.url ?? images[0]?.url ?? null
}

function artistNames(artists?: SpotifyArtistRef[]): string {
  return (artists ?? []).map((artist) => artist.name).join(", ")
}

export function isSpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET)
}

export function isSpotifyOAuthConfigured(): boolean {
  return isSpotifyConfigured()
}

function toTrackLike(track: RawTrack): TrackLike | null {
  if (!track?.id) return null
  return {
    id: track.id,
    name: track.name,
    uri: track.uri,
    url: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
    image: pickImage(track.album?.images),
    artists: artistNames(track.artists),
    album: track.album?.name ?? "",
    albumId: track.album?.id ?? "",
    durationMs: track.duration_ms,
    previewUrl: track.preview_url,
    trackNumber: track.track_number ?? 0,
    discNumber: track.disc_number ?? 1,
  }
}

async function spotifyGet<T>(token: string, path: string, revalidate = 600): Promise<T | null> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate },
  })
  if (!res.ok) {
    console.error("Spotify request failed", path, res.status, await res.text().catch(() => ""))
    return null
  }
  return (await res.json()) as T
}

async function searchTracks(token: string, query: string, market: string): Promise<RawTrack[]> {
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "50",
    market,
  })
  const data = await spotifyGet<{ tracks?: { items?: RawTrack[] } }>(token, `/search?${params.toString()}`)
  return (data?.tracks?.items ?? []).filter((item): item is RawTrack => Boolean(item?.id))
}

async function listAlbumTracks(
  token: string,
  albumId: string,
  market: string,
  totalTracks?: number
): Promise<RawAlbumTrack[]> {
  const tracks: RawAlbumTrack[] = []
  let offset = 0
  const cap = Math.min(totalTracks && totalTracks > 0 ? totalTracks : 150, 150)

  while (offset < cap) {
    const params = new URLSearchParams({
      limit: "50",
      offset: String(offset),
      market,
    })
    const data = await spotifyGet<{ items?: RawAlbumTrack[]; next?: string | null }>(
      token,
      `/albums/${albumId}/tracks?${params.toString()}`
    )
    const items = (data?.items ?? []).filter((item): item is RawAlbumTrack => Boolean(item?.id))
    tracks.push(...items)
    if (!data?.next || items.length === 0) break
    offset += 50
  }

  return tracks
}

function publicTrack(track: ScoredTrack): SpotifyTrackMatch {
  return {
    id: track.id,
    name: track.name,
    uri: track.uri ?? `spotify:track:${track.id}`,
    url: track.url ?? `https://open.spotify.com/track/${track.id}`,
    image: track.image ?? null,
    artists: track.artists,
    album: track.album,
    albumId: track.albumId ?? "",
    durationMs: track.durationMs,
    previewUrl: track.previewUrl ?? null,
    trackNumber: track.trackNumber,
    discNumber: track.discNumber,
  }
}

function publicRecording(group: RecordingGroup): SpotifyRecording {
  return {
    id: group.id,
    album: group.album,
    albumId: group.albumId,
    image: group.image,
    artists: group.artists,
    tracks: group.tracks.map(publicTrack),
  }
}

export async function searchSpotifyForWork(work: WorkQuery): Promise<SpotifyMatches> {
  const parsed = parseWork(work)
  const queries = buildSearchQueries(work, parsed)
  const query = queries[0] || `${work.composerName} ${work.title}`
  const searchUrl = spotifySearchUrl(query)
  const empty: SpotifyMatches = {
    configured: false,
    oauthConfigured: false,
    query,
    searchUrl,
    recordings: [],
  }

  const token = await getClientCredentialsToken()
  if (!token) return empty

  const market = process.env.SPOTIFY_MARKET || "US"
  const rawTracks: RawTrack[] = []
  const seen = new Set<string>()

  for (const q of queries) {
    const items = await searchTracks(token, q, market)
    for (const item of items) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      rawTracks.push(item)
    }
    const scoredSoFar = rawTracks
      .map(toTrackLike)
      .filter((track): track is TrackLike => Boolean(track))
      .map((track) => ({ ...track, score: scoreTrack(track, parsed) }))
      .filter((track) => track.score > 0)
    if (scoredSoFar.length >= 12) break
  }

  const matched: ScoredTrack[] = rawTracks
    .map(toTrackLike)
    .filter((track): track is TrackLike => Boolean(track))
    .map((track) => ({ ...track, score: scoreTrack(track, parsed) }))
    .filter((track) => track.score > 0)
    .sort((a, b) => b.score - a.score)

  const albumSeeds = new Map<string, { totalTracks?: number; image: string | null; album: string }>()
  for (const track of matched) {
    if (!track.albumId) continue
    if (!albumSeeds.has(track.albumId)) {
      albumSeeds.set(track.albumId, { image: track.image ?? null, album: track.album })
    }
  }

  const topAlbumIds = [...albumSeeds.keys()].slice(0, 6)
  const expanded: ScoredTrack[] = [...matched]

  await Promise.all(
    topAlbumIds.map(async (albumId) => {
      const meta = albumSeeds.get(albumId)
      const albumTracks = await listAlbumTracks(token, albumId, market)
      const likes: TrackLike[] = albumTracks.map((item) => ({
        id: item.id,
        name: item.name,
        uri: item.uri,
        url: item.external_urls?.spotify ?? `https://open.spotify.com/track/${item.id}`,
        image: meta?.image ?? null,
        artists: artistNames(item.artists),
        album: meta?.album ?? "",
        albumId,
        durationMs: item.duration_ms,
        previewUrl: item.preview_url,
        trackNumber: item.track_number ?? 0,
        discNumber: item.disc_number ?? 1,
      }))
      const seeds = matched.filter((track) => track.albumId === albumId)
      const scoredAlbum = likes
        .map((track) => ({ ...track, score: scoreTrack(track, parsed) }))
        .filter((track) => track.score > 0)
      const filled = fillAlbumGaps(likes, scoredAlbum.length ? scoredAlbum : seeds, parsed)
      expanded.push(...filled)
    })
  )

  const recordings = clusterTracks(expanded)
    .filter((group) => group.tracks.length > 0)
    .slice(0, 8)
    .map(publicRecording)

  return {
    configured: true,
    oauthConfigured: isSpotifyOAuthConfigured(),
    query,
    searchUrl,
    recordings,
  }
}

export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return ""
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
