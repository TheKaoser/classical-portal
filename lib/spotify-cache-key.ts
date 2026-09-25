/** Stable cache key for a Spotify search. Case and whitespace only — the request string stays intact. */
export function normalizeSpotifyQuery(query: string): string {
  return query.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
}

export function spotifySearchCacheKey(market: string, query: string): string {
  return `search:${market.trim().toUpperCase()}:${normalizeSpotifyQuery(query)}`
}

export function spotifyAlbumCacheKey(market: string, albumId: string): string {
  return `album:${market.trim().toUpperCase()}:${albumId.trim()}`
}
