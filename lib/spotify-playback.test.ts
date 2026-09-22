import assert from "node:assert/strict"
import { test } from "node:test"
import {
  PREMIUM_REQUIRED_MESSAGE,
  SPOTIFY_OAUTH_SCOPES,
  chooseTrackEmbed,
  classifySpotifyPlayError,
  inPagePlayerPlayUrl,
  isSpotifyDeviceId,
  orderedTrackUris,
  parsePendingPlayback,
  spotifyOAuthScopeString,
  spotifyPlayRequest,
  spotifyPremiumState,
  uniqueTrackUris,
} from "./spotify-playback.ts"

test("oauth scopes are the Web Playback SDK set and do not include playlist modification", () => {
  assert.deepEqual(SPOTIFY_OAUTH_SCOPES, [
    "streaming",
    "user-modify-playback-state",
    "user-read-private",
    "user-read-email",
  ])
  const scope = spotifyOAuthScopeString()
  assert.equal(scope.includes("playlist-modify"), false)
  assert.match(scope, /streaming/)
  assert.match(scope, /user-modify-playback-state/)
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

test("play starts at the first movement with a track URI list and no playlist context", () => {
  const body = spotifyPlayRequest({
    uris: ["spotify:track:i", "nope", "spotify:track:i", "spotify:track:ii"],
    position: 0,
  })
  assert.deepEqual(body, {
    uris: ["spotify:track:i", "spotify:track:ii"],
    offset: { position: 0 },
  })
  assert.equal(body && "context_uri" in body, false)
})

test("play request rejects an empty list and an offset past the end", () => {
  assert.equal(spotifyPlayRequest({ uris: ["spotify:album:nope"], position: 0 }), null)
  assert.equal(
    spotifyPlayRequest({ uris: ["spotify:track:only"], position: 1 }),
    null
  )
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
  assert.equal(classifySpotifyPlayError(403, { error: { message: "Insufficient client scope" } }).code, "insufficient_scope")
  assert.equal(classifySpotifyPlayError(404, { error: { message: "Device not found" } }).code, "device_not_found")
  assert.equal(classifySpotifyPlayError(401, { error: { message: "Invalid access token" } }).code, "not_connected")
  assert.equal(classifySpotifyPlayError(500, {}).code, "playback_failed")
})

test("device ids are the Spotify player id shape", () => {
  assert.equal(isSpotifyDeviceId("58c0a166ebaa633d9d6e47cf4226830ba1704062"), true)
  assert.equal(isSpotifyDeviceId("short"), false)
  assert.equal(isSpotifyDeviceId("bad id with spaces"), false)
})

test("playback is addressed only to this page's SDK player", () => {
  const id = "58c0a166ebaa633d9d6e47cf4226830ba1704062"
  assert.equal(inPagePlayerPlayUrl(id), `https://api.spotify.com/v1/me/player/play?device_id=${id}`)
  assert.equal(inPagePlayerPlayUrl(""), null)
  assert.equal(inPagePlayerPlayUrl("not a device"), null)
  assert.equal(inPagePlayerPlayUrl(id)?.endsWith("/me/player"), false)
})

test("pending playback resumes only a real multi-track group", () => {
  const raw = JSON.stringify({
    recordingId: "album:track",
    uris: ["spotify:track:i", "nope", "spotify:track:i", "spotify:track:ii"],
  })
  assert.deepEqual(parsePendingPlayback(raw), {
    recordingId: "album:track",
    uris: ["spotify:track:i", "spotify:track:ii"],
  })
  assert.equal(parsePendingPlayback("{"), null)
  assert.equal(parsePendingPlayback(JSON.stringify({ recordingId: "r", uris: ["spotify:track:only"] })), null)
})

test("browsing uses the track embed and Play all suppresses it", () => {
  const track = { id: "t1", name: "I. Allegro" }
  assert.deepEqual(chooseTrackEmbed({ selectedTrack: track, suppress: false }), {
    kind: "track",
    id: "t1",
    title: "I. Allegro",
    height: 152,
  })
  assert.equal(chooseTrackEmbed({ selectedTrack: track, suppress: true }), null)
  assert.equal(chooseTrackEmbed({ selectedTrack: null, suppress: false }), null)
})
