export type SpotifyAlbumMatch = {
  id: string
  name: string
  uri: string
  url: string
  image: string | null
  artists: string
  releaseDate: string | null
  totalTracks: number
}

export type SpotifyTrackMatch = {
  id: string
  name: string
  uri: string
  url: string
  image: string | null
  artists: string
  album: string
  durationMs: number
  previewUrl: string | null
}

export type SpotifyMatches = {
  configured: boolean
  query: string
  searchUrl: string
  albums: SpotifyAlbumMatch[]
  tracks: SpotifyTrackMatch[]
}

type TokenCache = {
  accessToken: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

function spotifySearchUrl(query: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`
}

function buildWorkQuery(composerName: string, workTitle: string): string {
  const cleanedTitle = workTitle
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return `${composerName} ${cleanedTitle}`
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

type RawAlbum = {
  id: string
  name: string
  uri: string
  total_tracks: number
  release_date?: string
  images?: SpotifyImage[]
  artists?: SpotifyArtistRef[]
  external_urls?: { spotify?: string }
}

type RawTrack = {
  id: string
  name: string
  uri: string
  duration_ms: number
  preview_url: string | null
  artists?: SpotifyArtistRef[]
  album?: { name: string; images?: SpotifyImage[] }
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

export async function searchSpotifyForWork(
  composerName: string,
  workTitle: string
): Promise<SpotifyMatches> {
  const query = buildWorkQuery(composerName, workTitle)
  const searchUrl = spotifySearchUrl(query)
  const empty: SpotifyMatches = { configured: false, query, searchUrl, albums: [], tracks: [] }

  const token = await getClientCredentialsToken()
  if (!token) return empty

  const market = process.env.SPOTIFY_MARKET || "US"
  const params = new URLSearchParams({
    q: query,
    type: "album,track",
    limit: "8",
    market,
  })

  const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 600 },
  })

  if (!res.ok) {
    console.error("Spotify search failed", res.status, await res.text().catch(() => ""))
    return { ...empty, configured: true }
  }

  const data = (await res.json()) as {
    albums?: { items?: RawAlbum[] }
    tracks?: { items?: RawTrack[] }
  }

  const albums: SpotifyAlbumMatch[] = (data.albums?.items ?? [])
    .filter((album) => album?.id)
    .map((album) => ({
      id: album.id,
      name: album.name,
      uri: album.uri,
      url: album.external_urls?.spotify ?? `https://open.spotify.com/album/${album.id}`,
      image: pickImage(album.images),
      artists: artistNames(album.artists),
      releaseDate: album.release_date ?? null,
      totalTracks: album.total_tracks,
    }))

  const tracks: SpotifyTrackMatch[] = (data.tracks?.items ?? [])
    .filter((track) => track?.id)
    .map((track) => ({
      id: track.id,
      name: track.name,
      uri: track.uri,
      url: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
      image: pickImage(track.album?.images),
      artists: artistNames(track.artists),
      album: track.album?.name ?? "",
      durationMs: track.duration_ms,
      previewUrl: track.preview_url,
    }))

  return { configured: true, query, searchUrl, albums, tracks }
}

export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return ""
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
