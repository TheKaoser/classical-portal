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
  /** Quota circuit is open and nothing cached could be returned. */
  unavailable?: boolean
  /** Caller looked like a crawler, so Spotify was not called. */
  skipped?: "crawler"
}

export function isSpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET)
}

export function isSpotifyOAuthConfigured(): boolean {
  return isSpotifyConfigured()
}

export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return ""
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
