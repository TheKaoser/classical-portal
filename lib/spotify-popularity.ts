import cache from "../data/spotify-popularity.json"

type SpotifyPopularityCache = {
  composers?: Record<string, number>
  works?: Record<string, number>
}

const data = cache as SpotifyPopularityCache

function readScore(table: Record<string, number> | undefined, id: string): number | null {
  const value = table?.[id]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** Cached Spotify popularity for a composer, or null when the refresh script has not matched them. */
export function composerSpotifyScore(id: string): number | null {
  return readScore(data.composers, id)
}

/** Cached Spotify popularity for a work, or null when no matched recording was stored. */
export function workSpotifyScore(id: string): number | null {
  return readScore(data.works, id)
}
