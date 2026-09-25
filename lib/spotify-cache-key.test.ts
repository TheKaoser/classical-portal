import assert from "node:assert/strict"
import { test } from "node:test"
import { normalizeSpotifyQuery, spotifyAlbumCacheKey, spotifySearchCacheKey } from "./spotify-cache-key.ts"
import {
  clearSpotifyMemoryForTests,
  readSpotifyMemory,
  SPOTIFY_NEGATIVE_TTL_MS,
  SPOTIFY_POSITIVE_TTL_MS,
  writeSpotifyMemory,
} from "./spotify-memory-cache.ts"

test("search cache keys ignore case and extra whitespace", () => {
  assert.equal(normalizeSpotifyQuery("  Frédéric   Chopin  op 9 "), "frédéric chopin op 9")
  assert.equal(
    spotifySearchCacheKey("es", "Frédéric Chopin op 9"),
    spotifySearchCacheKey("ES", "frédéric  chopin op 9")
  )
  assert.notEqual(
    spotifySearchCacheKey("ES", "Frédéric Chopin op 9"),
    spotifySearchCacheKey("US", "Frédéric Chopin op 9")
  )
})

test("album cache keys include the market", () => {
  assert.equal(spotifyAlbumCacheKey("us", "abc"), "album:US:abc")
})

test("positive matches outlive empty searches", () => {
  assert.equal(SPOTIFY_POSITIVE_TTL_MS, 14 * 24 * 60 * 60 * 1000)
  assert.equal(SPOTIFY_NEGATIVE_TTL_MS, 6 * 60 * 60 * 1000)
  assert.ok(SPOTIFY_POSITIVE_TTL_MS > SPOTIFY_NEGATIVE_TTL_MS)
})

test("memory cache expires negatives sooner than positives", () => {
  clearSpotifyMemoryForTests()
  const now = 1_000_000
  writeSpotifyMemory("pos", ["track"], false, now, now)
  writeSpotifyMemory("neg", [], true, now, now)
  assert.deepEqual(readSpotifyMemory("pos", now + SPOTIFY_NEGATIVE_TTL_MS)?.value, ["track"])
  assert.equal(readSpotifyMemory("neg", now + SPOTIFY_NEGATIVE_TTL_MS), null)
  assert.equal(readSpotifyMemory("pos", now + SPOTIFY_POSITIVE_TTL_MS), null)
})
