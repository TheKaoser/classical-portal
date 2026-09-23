import assert from "node:assert/strict"
import { test } from "node:test"
import {
  PLAYER_NOT_READY_MESSAGE,
  PREMIUM_REQUIRED_MESSAGE,
  SPOTIFY_OAUTH_SCOPES,
  PLAYBACK_SEEK_SYNC_TOLERANCE_MS,
  chooseTrackEmbed,
  classifySpotifyPlayError,
  inPagePlayerPlayUrl,
  ACCESS_TOKEN_REFRESH_SKEW_MS,
  PLAYBACK_RECONNECT_MESSAGE,
  PLAYBACK_UPSTREAM_MESSAGE,
  PLAYER_TRY_AGAIN_MESSAGE,
  accessTokenNeedsRefresh,
  isPlayerNotReadyCode,
  isSpotifyDeviceId,
  orderedTrackUris,
  playIssueRetryDelay,
  playbackDeviceRetryDelay,
  parsePendingPlayback,
  replacePlayAttempt,
  seekByKeyboard,
  seekPositionMs,
  seekRatioFromPointer,
  shouldApplyPlaybackPosition,
  spotifyOAuthScopeString,
  spotifyPlayRequest,
  spotifyPremiumState,
  tokenCanControlPlayback,
  uniqueTrackUris,
} from "./spotify-playback.ts"

test("oauth scopes include the Web Playback SDK set, private playlist save, and Liked Songs", () => {
  assert.deepEqual(SPOTIFY_OAUTH_SCOPES, [
    "streaming",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-private",
    "user-read-email",
  ])
  const scope = spotifyOAuthScopeString()
  assert.match(scope, /streaming/)
  assert.match(scope, /user-modify-playback-state/)
  assert.match(scope, /playlist-modify-private/)
  assert.match(scope, /playlist-modify-public/)
  assert.match(scope, /user-library-modify/)
  assert.match(scope, /user-library-read/)
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
    { code: "premium_required", message: PREMIUM_REQUIRED_MESSAGE, status: 403, retryable: false }
  )
  assert.equal(classifySpotifyPlayError(403, { error: { message: "Insufficient client scope" } }).code, "insufficient_scope")
  const device = classifySpotifyPlayError(404, { error: { message: "Device not found" } })
  assert.equal(device.code, "device_not_found")
  assert.equal(device.status, 409)
  assert.equal(device.retryable, true)
  assert.equal(device.message, PLAYER_NOT_READY_MESSAGE)
  assert.equal(
    classifySpotifyPlayError(404, { error: { message: "Player command failed: No active device found", reason: "NO_ACTIVE_DEVICE" } }).code,
    "device_not_found"
  )
  assert.equal(classifySpotifyPlayError(401, { error: { message: "Invalid access token" } }).code, "not_connected")
  assert.equal(classifySpotifyPlayError(401, { error: { message: "Permissions missing" } }).code, "insufficient_scope")
  const upstream = classifySpotifyPlayError(500, { error: { status: 500, message: "Internal Server Error" } })
  assert.equal(upstream.code, "playback_failed")
  assert.equal(upstream.status, 502)
  assert.equal(upstream.retryable, true)
  assert.equal(upstream.message, PLAYBACK_UPSTREAM_MESSAGE)
  const conflict = classifySpotifyPlayError(409, { error: { status: 409, message: "Conflict" } })
  assert.equal(conflict.code, "player_not_ready")
  assert.equal(conflict.retryable, true)
  const restricted = classifySpotifyPlayError(403, { error: { status: 403, message: "Restriction violated" } })
  assert.equal(restricted.code, "player_not_ready")
  assert.equal(restricted.retryable, true)
})

test("playback control needs the Web Playback scopes, and a nearly expired token is refreshed", () => {
  const full = "streaming user-read-playback-state user-modify-playback-state user-read-email"
  assert.equal(tokenCanControlPlayback(full), true)
  assert.equal(tokenCanControlPlayback("streaming user-modify-playback-state user-read-email"), false)
  assert.equal(tokenCanControlPlayback(null), false)
  assert.equal(tokenCanControlPlayback(""), false)
  assert.equal(
    classifySpotifyPlayError(403, { error: { message: "Insufficient client scope" } }).message,
    PLAYBACK_RECONNECT_MESSAGE
  )

  const now = 1_000_000
  assert.equal(
    accessTokenNeedsRefresh({ hasAccessToken: true, expiresAtMs: now + ACCESS_TOKEN_REFRESH_SKEW_MS + 1, nowMs: now }),
    false
  )
  assert.equal(
    accessTokenNeedsRefresh({ hasAccessToken: true, expiresAtMs: now + ACCESS_TOKEN_REFRESH_SKEW_MS, nowMs: now }),
    true
  )
  assert.equal(
    accessTokenNeedsRefresh({
      hasAccessToken: true,
      expiresAtMs: now + 60 * 60 * 1000,
      nowMs: now,
      force: true,
    }),
    true
  )
  assert.equal(accessTokenNeedsRefresh({ hasAccessToken: false, expiresAtMs: now + 60_000, nowMs: now }), true)
})

test("the page retries a connecting player once, and a newer play cancels the previous request", () => {
  assert.equal(playIssueRetryDelay({ code: "player_not_ready", message: "The in-app player is still connecting." }, 0), 800)
  assert.equal(playIssueRetryDelay({ code: "player_not_ready", message: PLAYER_TRY_AGAIN_MESSAGE }, 0), null)
  assert.equal(playIssueRetryDelay({ code: "playback_failed", message: PLAYBACK_UPSTREAM_MESSAGE }, 0), null)
  assert.equal(playIssueRetryDelay({ code: "premium_required" }, 0), null)

  let aborted = false
  const first = new AbortController()
  first.signal.addEventListener("abort", () => {
    aborted = true
  })
  const second = replacePlayAttempt(first)
  assert.equal(aborted, true)
  assert.equal(second.signal.aborted, false)
  assert.equal(first === second, false)
})

test("a player that is still connecting is retried, then the listener can press Play again", () => {
  assert.equal(isPlayerNotReadyCode("device_not_found"), true)
  assert.equal(isPlayerNotReadyCode("player_not_ready"), true)
  assert.equal(isPlayerNotReadyCode("premium_required"), false)
  assert.equal(isPlayerNotReadyCode(undefined), false)
  assert.equal(playbackDeviceRetryDelay(0), 800)
  assert.equal(playbackDeviceRetryDelay(1), 1600)
  assert.equal(playbackDeviceRetryDelay(2), null)
  assert.equal(playbackDeviceRetryDelay(-1), null)
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
    position: 0,
  })
  assert.deepEqual(
    parsePendingPlayback(JSON.stringify({ recordingId: "album:track", uris: ["spotify:track:i", "spotify:track:ii"], position: 1 })),
    {
      recordingId: "album:track",
      uris: ["spotify:track:i", "spotify:track:ii"],
      position: 1,
    }
  )
  assert.deepEqual(parsePendingPlayback(JSON.stringify({ recordingId: "r", uris: ["spotify:track:only"] })), {
    recordingId: "r",
    uris: ["spotify:track:only"],
    position: 0,
  })
  assert.equal(parsePendingPlayback("{"), null)
  assert.equal(parsePendingPlayback(JSON.stringify({ recordingId: "r", uris: [] })), null)
})

test("a click on the seek bar maps to a position in the current track", () => {
  assert.equal(seekRatioFromPointer(0, { left: 0, width: 200 }), 0)
  assert.equal(seekRatioFromPointer(100, { left: 0, width: 200 }), 0.5)
  assert.equal(seekRatioFromPointer(200, { left: 0, width: 200 }), 1)
  assert.equal(seekRatioFromPointer(40, { left: 20, width: 100 }), 0.2)
  assert.equal(seekRatioFromPointer(-20, { left: 0, width: 200 }), 0)
  assert.equal(seekRatioFromPointer(500, { left: 0, width: 200 }), 1)
  assert.equal(seekRatioFromPointer(50, { left: 10, width: 0 }), 0)

  assert.equal(seekPositionMs(0, 180_000), 0)
  assert.equal(seekPositionMs(0.5, 180_000), 90_000)
  assert.equal(seekPositionMs(1, 180_000), 180_000)
  assert.equal(seekPositionMs(1.4, 180_000), 180_000)
  assert.equal(seekPositionMs(-0.2, 180_000), 0)
  assert.equal(seekPositionMs(0.333, 10_000), 3_330)
  assert.equal(seekPositionMs(0.5, 0), null)
  assert.equal(seekPositionMs(Number.NaN, 180_000), null)
})

test("keyboard seek stays inside the current track", () => {
  assert.equal(seekByKeyboard({ key: "ArrowRight", positionMs: 10_000, durationMs: 180_000 }), 15_000)
  assert.equal(seekByKeyboard({ key: "ArrowUp", positionMs: 10_000, durationMs: 180_000 }), 15_000)
  assert.equal(seekByKeyboard({ key: "ArrowLeft", positionMs: 10_000, durationMs: 180_000 }), 5_000)
  assert.equal(seekByKeyboard({ key: "ArrowDown", positionMs: 10_000, durationMs: 180_000 }), 5_000)
  assert.equal(seekByKeyboard({ key: "ArrowLeft", positionMs: 1_000, durationMs: 180_000 }), 0)
  assert.equal(
    seekByKeyboard({ key: "ArrowRight", positionMs: 178_000, durationMs: 180_000, shiftKey: true }),
    180_000
  )
  assert.equal(seekByKeyboard({ key: "Home", positionMs: 40_000, durationMs: 180_000 }), 0)
  assert.equal(seekByKeyboard({ key: "End", positionMs: 40_000, durationMs: 180_000 }), 180_000)
  assert.equal(seekByKeyboard({ key: " ", positionMs: 40_000, durationMs: 180_000 }), null)
  assert.equal(seekByKeyboard({ key: "ArrowRight", positionMs: 0, durationMs: 0 }), null)
})

test("the seek bar keeps a scrub target until the SDK reports it", () => {
  const pendingUntilMs = 5_000
  assert.equal(
    shouldApplyPlaybackPosition({
      reportedMs: 10_000,
      scrubbing: true,
      pendingSeekMs: 90_000,
      nowMs: 100,
      pendingUntilMs,
    }),
    false
  )
  assert.equal(
    shouldApplyPlaybackPosition({
      reportedMs: 12_000,
      scrubbing: false,
      pendingSeekMs: 90_000,
      nowMs: 100,
      pendingUntilMs,
    }),
    false
  )
  assert.equal(
    shouldApplyPlaybackPosition({
      reportedMs: 90_000 - PLAYBACK_SEEK_SYNC_TOLERANCE_MS,
      scrubbing: false,
      pendingSeekMs: 90_000,
      nowMs: 100,
      pendingUntilMs,
    }),
    true
  )
  assert.equal(
    shouldApplyPlaybackPosition({
      reportedMs: 12_000,
      scrubbing: false,
      pendingSeekMs: 90_000,
      nowMs: pendingUntilMs,
      pendingUntilMs,
    }),
    true
  )
  assert.equal(
    shouldApplyPlaybackPosition({
      reportedMs: 12_000,
      scrubbing: false,
      pendingSeekMs: null,
      nowMs: 0,
      pendingUntilMs: 0,
    }),
    true
  )
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
