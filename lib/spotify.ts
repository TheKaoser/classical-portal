import {
  buildSearchQueries,
  clusterTracks,
  fillAlbumGaps,
  hasGoodMatch,
  parseWork,
  primarySpotifySearchUrl,
  scoreTrack,
  type RecordingGroup,
  type ScoredTrack,
  type TrackLike,
  type WorkQuery,
} from "@/lib/spotify-match"
import { spotifyAlbumCacheKey, spotifySearchCacheKey } from "@/lib/spotify-cache-key"
import { publishSharedSpotifyQuota, readThroughSpotifyCache, syncSharedSpotifyQuota } from "@/lib/spotify-catalog-cache"
import { isCrawlerUserAgent } from "@/lib/crawler"
import {
  formatDuration,
  isSpotifyConfigured,
  isSpotifyOAuthConfigured,
  type SpotifyMatches,
  type SpotifyRecording,
  type SpotifyTrackMatch,
} from "@/lib/spotify-model"
import { spotifyCallsBlocked, spotifyRetryDelayMs, tripSpotifyQuota } from "@/lib/spotify-quota"

export type { RecordingGroup, WorkQuery, SpotifyMatches, SpotifyRecording, SpotifyTrackMatch }
export { formatDuration, isSpotifyConfigured, isSpotifyOAuthConfigured }

/** Cold album lookups. The best-matching albums only; each list is cached. */
const ALBUM_EXPANSION_LIMIT = 3

type TokenCache = {
  accessToken: string
  expiresAt: number
}

type TokenResult = { ok: true; token: string } | { ok: false; quota: boolean }

type SpotifyGetResult<T> = { ok: true; data: T } | { ok: false; quota: boolean }

class SpotifyUpstreamError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SpotifyUpstreamError"
  }
}

let tokenCache: TokenCache | null = null
let tokenInflight: Promise<TokenResult> | null = null

function noteQuota(header: string | null, body: string) {
  const openUntil = Date.now() + spotifyRetryDelayMs(header, body)
  tripSpotifyQuota(openUntil)
  void publishSharedSpotifyQuota(openUntil)
}

async function requestClientCredentialsToken(clientId: string, clientSecret: string): Promise<TokenResult> {
  if (spotifyCallsBlocked()) return { ok: false, quota: true }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  })

  if (res.status === 429) {
    const body = await res.text().catch(() => "")
    noteQuota(res.headers.get("retry-after"), body)
    console.error("Spotify token request failed", res.status, body)
    return { ok: false, quota: true }
  }

  if (!res.ok) {
    console.error("Spotify token request failed", res.status, await res.text().catch(() => ""))
    return { ok: false, quota: false }
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return { ok: true, token: tokenCache.accessToken }
}

async function getClientCredentialsToken(): Promise<TokenResult> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return { ok: false, quota: false }

  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return { ok: true, token: tokenCache.accessToken }
  }
  if (spotifyCallsBlocked()) return { ok: false, quota: true }
  if (tokenInflight) return tokenInflight

  tokenInflight = requestClientCredentialsToken(clientId, clientSecret).finally(() => {
    tokenInflight = null
  })
  return tokenInflight
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

async function spotifyGet<T>(token: string, path: string): Promise<SpotifyGetResult<T>> {
  if (spotifyCallsBlocked()) return { ok: false, quota: true }

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (res.status === 429) {
    const body = await res.text().catch(() => "")
    noteQuota(res.headers.get("retry-after"), body)
    console.error("Spotify request failed", path, res.status, body)
    return { ok: false, quota: true }
  }
  if (!res.ok) {
    console.error("Spotify request failed", path, res.status, await res.text().catch(() => ""))
    return { ok: false, quota: false }
  }
  return { ok: true, data: (await res.json()) as T }
}

async function loadSearch(query: string, market: string): Promise<{ value: RawTrack[]; negative: boolean } | "quota"> {
  if (spotifyCallsBlocked()) return "quota"
  const token = await getClientCredentialsToken()
  if (!token.ok) {
    if (token.quota || spotifyCallsBlocked()) return "quota"
    throw new SpotifyUpstreamError("Spotify token request failed")
  }

  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "50",
    market,
  })
  const result = await spotifyGet<{ tracks?: { items?: RawTrack[] } }>(token.token, `/search?${params.toString()}`)
  if (!result.ok) {
    if (result.quota) return "quota"
    throw new SpotifyUpstreamError("Spotify search failed")
  }
  const tracks = (result.data.tracks?.items ?? []).filter((item): item is RawTrack => Boolean(item?.id))
  return { value: tracks, negative: tracks.length === 0 }
}

async function loadAlbumTracks(
  albumId: string,
  market: string
): Promise<{ value: RawAlbumTrack[]; negative: boolean } | "quota"> {
  if (spotifyCallsBlocked()) return "quota"
  const token = await getClientCredentialsToken()
  if (!token.ok) {
    if (token.quota || spotifyCallsBlocked()) return "quota"
    throw new SpotifyUpstreamError("Spotify token request failed")
  }

  const tracks: RawAlbumTrack[] = []
  let offset = 0
  const cap = 150

  while (offset < cap) {
    if (spotifyCallsBlocked()) return "quota"
    const params = new URLSearchParams({
      limit: "50",
      offset: String(offset),
      market,
    })
    const result = await spotifyGet<{ items?: RawAlbumTrack[]; next?: string | null }>(
      token.token,
      `/albums/${albumId}/tracks?${params.toString()}`
    )
    if (!result.ok) {
      if (result.quota) return "quota"
      throw new SpotifyUpstreamError("Spotify album request failed")
    }
    const items = (result.data.items ?? []).filter((item): item is RawAlbumTrack => Boolean(item?.id))
    tracks.push(...items)
    if (!result.data.next || items.length === 0) break
    offset += 50
  }

  return { value: tracks, negative: tracks.length === 0 }
}

function cachedSearch(query: string, market: string): Promise<RawTrack[] | "quota"> {
  return readThroughSpotifyCache(spotifySearchCacheKey(market, query), () => loadSearch(query, market))
}

function cachedAlbumTracks(albumId: string, market: string): Promise<RawAlbumTrack[] | "quota"> {
  return readThroughSpotifyCache(spotifyAlbumCacheKey(market, albumId), () => loadAlbumTracks(albumId, market))
}

function positiveScores(tracks: RawTrack[], parsed: ReturnType<typeof parseWork>): number[] {
  const scores: number[] = []
  for (const raw of tracks) {
    const like = toTrackLike(raw)
    if (!like) continue
    const score = scoreTrack(like, parsed)
    if (score > 0) scores.push(score)
  }
  return scores
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

function shell(work: WorkQuery, extra: Partial<SpotifyMatches> = {}): SpotifyMatches {
  const queries = buildSearchQueries(work)
  const query = queries[0] || `${work.composerName} ${work.title}`
  return {
    configured: isSpotifyConfigured(),
    oauthConfigured: isSpotifyOAuthConfigured(),
    query,
    searchUrl: primarySpotifySearchUrl(work),
    recordings: [],
    ...extra,
  }
}

export async function searchSpotifyForWork(
  work: WorkQuery,
  options?: { userAgent?: string | null }
): Promise<SpotifyMatches> {
  const parsed = parseWork(work)
  const queries = buildSearchQueries(work, parsed)
  const ready = shell(work)

  if (isCrawlerUserAgent(options?.userAgent)) {
    return { ...ready, skipped: "crawler" }
  }
  if (!ready.configured) return ready

  await syncSharedSpotifyQuota()

  const market = process.env.SPOTIFY_MARKET || "US"
  const rawTracks: RawTrack[] = []
  const seen = new Set<string>()
  let quotaHit = false
  let upstreamFailed = false

  try {
    for (const q of queries) {
      const items = await cachedSearch(q, market)
      if (items === "quota") {
        quotaHit = true
        break
      }
      for (const item of items) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        rawTracks.push(item)
      }
      // One good query is enough. Further variants used to run until 12 scored tracks.
      if (hasGoodMatch(positiveScores(rawTracks, parsed))) break
    }
  } catch (error) {
    upstreamFailed = true
    console.error("Spotify search failed", error)
  }

  const matched: ScoredTrack[] = rawTracks
    .map(toTrackLike)
    .filter((track): track is TrackLike => Boolean(track))
    .map((track) => ({ ...track, score: scoreTrack(track, parsed) }))
    .filter((track) => track.score > 0)
    .sort((a, b) => b.score - a.score)

  const albumSeeds = new Map<string, { image: string | null; album: string }>()
  for (const track of matched) {
    if (!track.albumId) continue
    if (!albumSeeds.has(track.albumId)) {
      albumSeeds.set(track.albumId, { image: track.image ?? null, album: track.album })
    }
  }

  const topAlbumIds = [...albumSeeds.keys()].slice(0, ALBUM_EXPANSION_LIMIT)
  const expanded: ScoredTrack[] = [...matched]

  if (!quotaHit && !upstreamFailed && topAlbumIds.length > 0) {
    await Promise.all(
      topAlbumIds.map(async (albumId) => {
        try {
          const albumTracks = await cachedAlbumTracks(albumId, market)
          if (albumTracks === "quota") {
            quotaHit = true
            return
          }
          const meta = albumSeeds.get(albumId)
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
          expanded.push(...fillAlbumGaps(likes, scoredAlbum.length ? scoredAlbum : seeds, parsed))
        } catch (error) {
          console.error("Spotify album expansion failed", albumId, error)
        }
      })
    )
  }

  const recordings = clusterTracks(expanded)
    .filter((group) => group.tracks.length > 0)
    .slice(0, 8)
    .map(publicRecording)

  if ((quotaHit || upstreamFailed) && recordings.length === 0) {
    return { ...ready, configured: true, unavailable: true }
  }

  return {
    ...ready,
    configured: true,
    recordings,
  }
}
