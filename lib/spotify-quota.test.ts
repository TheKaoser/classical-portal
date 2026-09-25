import assert from "node:assert/strict"
import { test, beforeEach } from "node:test"
import {
  parseRetryAfterMs,
  resetSpotifyQuotaForTests,
  spotifyCallsBlocked,
  spotifyErrorReason,
  spotifyQuotaOpenUntil,
  spotifyRetryDelayMs,
  SPOTIFY_QUOTA_DEFAULT_DELAY_MS,
  SPOTIFY_QUOTA_MAX_DELAY_MS,
  SPOTIFY_RATE_LIMIT_DEFAULT_DELAY_MS,
  tripSpotifyQuota,
} from "./spotify-quota.ts"

const NOW = Date.parse("2026-09-25T07:00:00.000Z")
const QUOTA_BODY = JSON.stringify({
  error: { status: 429, message: "Too many requests", reason: "QUOTA_EXCEEDED" },
})

beforeEach(() => {
  resetSpotifyQuotaForTests()
})

test("reads the Spotify quota reason", () => {
  assert.equal(spotifyErrorReason(QUOTA_BODY), "QUOTA_EXCEEDED")
  assert.equal(spotifyErrorReason("not json"), null)
})

test("parses Retry-After seconds and HTTP dates", () => {
  assert.equal(parseRetryAfterMs("120", NOW), 120_000)
  assert.equal(parseRetryAfterMs("0", NOW), null)
  assert.equal(parseRetryAfterMs(null, NOW), null)
  const later = new Date(NOW + 2 * 60 * 60 * 1000).toUTCString()
  assert.equal(parseRetryAfterMs(later, NOW), 2 * 60 * 60 * 1000)
  assert.equal(parseRetryAfterMs(new Date(NOW - 1000).toUTCString(), NOW), null)
})

test("QUOTA_EXCEEDED without Retry-After waits an hour", () => {
  assert.equal(spotifyRetryDelayMs(null, QUOTA_BODY, NOW), SPOTIFY_QUOTA_DEFAULT_DELAY_MS)
})

test("a plain 429 without Retry-After waits fifteen minutes", () => {
  assert.equal(spotifyRetryDelayMs(null, "{}", NOW), SPOTIFY_RATE_LIMIT_DEFAULT_DELAY_MS)
})

test("Retry-After is honored and capped at a day", () => {
  assert.equal(spotifyRetryDelayMs("90", QUOTA_BODY, NOW), 90_000)
  assert.equal(spotifyRetryDelayMs(String(60 * 60 * 48), QUOTA_BODY, NOW), SPOTIFY_QUOTA_MAX_DELAY_MS)
})

test("the circuit stays open until the deadline and then closes", () => {
  assert.equal(spotifyCallsBlocked(NOW), false)
  tripSpotifyQuota(NOW + 60_000, NOW)
  assert.equal(spotifyCallsBlocked(NOW + 1000), true)
  assert.equal(spotifyQuotaOpenUntil(NOW + 1000), NOW + 60_000)
  assert.equal(spotifyCallsBlocked(NOW + 60_000), false)
})

test("a shorter trip does not shrink the open window", () => {
  tripSpotifyQuota(NOW + 60_000, NOW)
  tripSpotifyQuota(NOW + 10_000, NOW)
  assert.equal(spotifyQuotaOpenUntil(NOW), NOW + 60_000)
})
