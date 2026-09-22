import assert from "node:assert/strict"
import { test } from "node:test"
import {
  PREMIUM_REQUIRED_MESSAGE,
  SPOTIFY_PLAYBACK_SCOPES,
  SPOTIFY_PLAYLIST_SCOPES,
  classifySpotifyPlayError,
  isSpotifyDeviceId,
  orderedTrackUris,
  parsePendingPlayback,
  seekPositionMs,
  spotifyOAuthScopeString,
  spotifyPlayRequest,
  spotifyPremiumState,
  uniqueTrackUris,
} from "./spotify-playback.ts"

test("oauth scopes include Web Playback and private playlist save", () => {
  assert.deepEqual(SPOTIFY_PLAYBACK_SCOPES, [
    "streaming",
    "user-modify-playback-state",
    "user-read-private",
    "user-read-email",
  ])
  assert.deepEqual(SPOTIFY_PLAYLIST_SCOPES, ["playlist-modify-private", "playlist-modify-public"])
  const scope = spotifyOAuthScopeString()
  assert.match(scope, /streaming/)
  assert.match(scope, /user-modify-playback-state/)
  assert.match(scope, /playlist-modify-private/)
  assert.equal(scope.includes("playlist-modify-private"), true)
})

test("track URIs stay in movement order and drop invalid duplicates", () => {
  assert.deepEqual(
    orderedTrackUris([
      { uri: "spotify:track:second" },
      { uri: "not-a-uri" },
      { uri: "spotify:track:first" },
      { uri: "spotify:track:second" },
    ]),
    ["spotify:track:second", "spotify:track:first"]
  )
  assert.deepEqual(uniqueTrackUris(["spotify:track:a", "spotify:album:b", "spotify:track:a"]), [
    "spotify:track:a",
  ])
})

test("play starts at a movement index with a track URI list and no playlist context", () => {
  const body = spotifyPlayRequest({
    uris: ["spotify:track:i", "nope", "spotify:track:i", "spotify:track:ii", "spotify:track:iii"],
    position: 1,
  })
  assert.deepEqual(body, {
    uris: ["spotify:track:i", "spotify:track:ii", "spotify:track:iii"],
    offset: { position: 1 },
  })
  assert.equal(body && "context_uri" in body, false)
})

test("play request rejects an empty list and an offset past the end", () => {
  assert.equal(spotifyPlayRequest({ uris: ["spotify:album:nope"], position: 0 }), null)
  assert.equal(spotifyPlayRequest({ uris: ["spotify:track:only"], position: 1 }), null)
  assert.deepEqual(spotifyPlayRequest({ uris: ["spotify:track:only"] }), {
    uris: ["spotify:track:only"],
    offset: { position: 0 },
  })
})

test("only a premium product can use the in-app player", () => {
  assert.equal(spotifyPremiumState("premium"), true)
  assert.equal(spotifyPremiumState("free"), false)
  assert.equal(spotifyPremiumState("open"), false)
  assert.equal(spotifyPremiumState(null), null)
  assert.equal(spotifyPremiumState(""), null)
})

test("Spotify play errors map to premium, scope, device, and login", () => {
  assert.deepEqual(
    classifySpotifyPlayError(403, {
      error: { status: 403, message: "Player command failed: Premium required", reason: "PREMIUM_REQUIRED" },
    }),
    { code: "premium_required", message: PREMIUM_REQUIRED_MESSAGE, status: 403 }
  )
  assert.equal(
    classifySpotifyPlayError(403, { error: { message: "Insufficient client scope" } }).code,
    "insufficient_scope"
  )
  assert.equal(classifySpotifyPlayError(404, { error: { message: "Device not found" } }).code, "device_not_found")
  assert.equal(classifySpotifyPlayError(401, { error: { message: "Invalid access token" } }).code, "not_connected")
  assert.equal(classifySpotifyPlayError(500, {}).code, "playback_failed")
})

test("device ids are the Spotify player id shape", () => {
  assert.equal(isSpotifyDeviceId("58c0a166ebaa633d9d6e47cf4226830ba1704062"), true)
  assert.equal(isSpotifyDeviceId("short"), false)
  assert.equal(isSpotifyDeviceId("bad id with spaces"), false)
})

test("pending playback keeps a start position and a single movement", () => {
  const raw = JSON.stringify({
    recordingId: "album:track",
    uris: ["spotify:track:i", "nope", "spotify:track:i", "spotify:track:ii"],
    position: 1,
  })
  assert.deepEqual(parsePendingPlayback(raw), {
    recordingId: "album:track",
    uris: ["spotify:track:i", "spotify:track:ii"],
    position: 1,
  })
  assert.deepEqual(parsePendingPlayback(JSON.stringify({ recordingId: "r", uris: ["spotify:track:only"] })), {
    recordingId: "r",
    uris: ["spotify:track:only"],
    position: 0,
  })
  assert.equal(parsePendingPlayback("{"), null)
  assert.equal(parsePendingPlayback(JSON.stringify({ recordingId: "r", uris: [] })), null)
  assert.equal(
    parsePendingPlayback(JSON.stringify({ recordingId: "r", uris: ["spotify:track:only"], position: 4 }))?.position,
    0
  )
})

test("seek bar percentage maps into the track duration", () => {
  assert.equal(seekPositionMs(0, 180_000), 0)
  assert.equal(seekPositionMs(50, 180_000), 90_000)
  assert.equal(seekPositionMs(100, 180_000), 180_000)
  assert.equal(seekPositionMs(140, 180_000), 180_000)
  assert.equal(seekPositionMs(-10, 180_000), 0)
  assert.equal(seekPositionMs(10, 0), null)
  assert.equal(seekPositionMs(Number.NaN, 180_000), null)
})
