import assert from "node:assert/strict"
import { test } from "node:test"
import {
  PLAYBACK_LOGIN_EXPIRED_MESSAGE,
  PLAYBACK_RECONNECT_MESSAGE,
  PLAYBACK_UPSTREAM_MESSAGE,
  PLAYER_NOT_READY_MESSAGE,
  PLAYER_TRY_AGAIN_MESSAGE,
  PREMIUM_REQUIRED_MESSAGE,
} from "./spotify-playback.ts"
import { SPOTIFY_PLAYER_TRANSFER_URL, respondToSpotifyPlay, spotifyTransferRequest } from "./spotify-play-api.ts"

const DEVICE_ID = "58c0a166ebaa633d9d6e47cf4226830ba1704062"
const URIS = ["spotify:track:movementI", "spotify:track:movementII"]

type Call = {
  url: string
  method: string
  body: unknown
  authorization: string | null
}

function jsonResponse(status: number, body: unknown): Response {
  return Response.json(body, { status })
}

function recordingFetch(respond: (call: Call, index: number) => Response): {
  fetchImpl: typeof fetch
  calls: Call[]
} {
  const calls: Call[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const headers = new Headers(init?.headers)
    const call: Call = {
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      authorization: headers.get("authorization"),
    }
    calls.push(call)
    return respond(call, calls.length - 1)
  }
  return { fetchImpl, calls }
}

test("play API starts the track URIs on the Web Playback device without a prior transfer", async () => {
  const { fetchImpl, calls } = recordingFetch(() => new Response(null, { status: 204 }))
  const result = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: { deviceId: DEVICE_ID, uris: [...URIS, "not-a-uri", URIS[0]], position: 0 },
    fetchImpl,
    sleep: async () => {},
    retryDelaysMs: [0],
  })

  assert.deepEqual(result, { status: 200, body: { ok: true } })
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.method, "PUT")
  assert.equal(calls[0]?.url, `https://api.spotify.com/v1/me/player/play?device_id=${DEVICE_ID}`)
  assert.equal(calls[0]?.authorization, "Bearer user-token")
  assert.deepEqual(calls[0]?.body, {
    uris: URIS,
    offset: { position: 0 },
  })
  assert.equal(calls.some((call) => call.url === SPOTIFY_PLAYER_TRANSFER_URL), false)
  assert.equal(spotifyTransferRequest(DEVICE_ID)?.play, false)
  assert.equal(spotifyTransferRequest(""), null)
})

test("play API transfers only after no active device, then starts the tracks", async () => {
  let plays = 0
  const { fetchImpl, calls } = recordingFetch((call) => {
    if (call.url.includes("/me/player/play")) {
      plays += 1
      if (plays === 1) {
        return jsonResponse(404, {
          error: { status: 404, message: "Player command failed: No active device found", reason: "NO_ACTIVE_DEVICE" },
        })
      }
    }
    return new Response(null, { status: 204 })
  })

  const result = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: { deviceId: DEVICE_ID, uris: URIS, position: 1 },
    fetchImpl,
    sleep: async () => {
      throw new Error("a successful transfer should not wait for another attempt")
    },
    retryDelaysMs: [0, 25],
  })

  assert.deepEqual(result, { status: 200, body: { ok: true } })
  assert.equal(plays, 2)
  assert.equal(calls[0]?.url.includes("/me/player/play"), true)
  assert.equal(calls[1]?.url, SPOTIFY_PLAYER_TRANSFER_URL)
  assert.deepEqual(calls[1]?.body, { device_ids: [DEVICE_ID], play: false })
  assert.deepEqual(calls[2]?.body, { uris: URIS, offset: { position: 1 } })
})

test("play API retries while Spotify does not know the SDK device and does not return 404", async () => {
  let playAttempts = 0
  const sleeps: number[] = []
  const { fetchImpl, calls } = recordingFetch((call) => {
    if (call.url === SPOTIFY_PLAYER_TRANSFER_URL) {
      return jsonResponse(404, { error: { status: 404, message: "Device not found" } })
    }
    if (call.url.includes("/me/player/play")) {
      playAttempts += 1
      if (playAttempts === 1) {
        return jsonResponse(404, {
          error: { status: 404, message: "Player command failed: No active device found", reason: "NO_ACTIVE_DEVICE" },
        })
      }
    }
    return new Response(null, { status: 204 })
  })

  const result = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: { deviceId: DEVICE_ID, uris: URIS, position: 1 },
    fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    retryDelaysMs: [0, 25, 25],
  })

  assert.deepEqual(result, { status: 200, body: { ok: true } })
  assert.equal(result.status === 404, false)
  assert.deepEqual(sleeps, [25])
  assert.equal(playAttempts, 2)
  assert.equal(calls.filter((call) => call.url === SPOTIFY_PLAYER_TRANSFER_URL).length, 1)
  assert.deepEqual(calls.at(-1)?.body, { uris: URIS, offset: { position: 1 } })
})

test("play API gives up with 409 when the device never registers", async () => {
  const { fetchImpl, calls } = recordingFetch(() =>
    jsonResponse(404, { error: { status: 404, message: "Device not found" } })
  )
  const result = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: { deviceId: DEVICE_ID, uris: ["spotify:track:only"] },
    fetchImpl,
    sleep: async () => {},
    retryDelaysMs: [0, 5],
  })

  assert.equal(result.status, 409)
  assert.deepEqual(result.body, { error: PLAYER_TRY_AGAIN_MESSAGE, code: "player_not_ready" })
  assert.equal(calls.filter((call) => call.url.includes("/me/player/play")).length, 2)
  assert.equal(calls.filter((call) => call.url === SPOTIFY_PLAYER_TRANSFER_URL).length, 2)
})

test("a transfer 500 while no device is active is ignored and play is retried", async () => {
  let plays = 0
  const { fetchImpl, calls } = recordingFetch((call) => {
    if (call.url === SPOTIFY_PLAYER_TRANSFER_URL) {
      return jsonResponse(500, { error: { status: 500, message: "Internal Server Error" } })
    }
    plays += 1
    if (plays === 1) return jsonResponse(404, { error: { status: 404, message: "Device not found" } })
    return new Response(null, { status: 204 })
  })
  const result = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: { deviceId: DEVICE_ID, uris: URIS },
    fetchImpl,
    sleep: async () => {},
    retryDelaysMs: [0, 5],
  })

  assert.deepEqual(result, { status: 200, body: { ok: true } })
  assert.equal(calls.some((call) => call.url === SPOTIFY_PLAYER_TRANSFER_URL), true)
  assert.equal(calls.some((call) => call.url.includes("/me/player/play")), true)
  assert.equal(result.status === 500, false)
})

test("Spotify 500 from an inactive device is retried and never returned as 500", async () => {
  let attempts = 0
  const { fetchImpl, calls } = recordingFetch(() => {
    attempts += 1
    if (attempts === 1) return jsonResponse(500, { error: { status: 500, message: "Internal Server Error" } })
    return new Response(null, { status: 204 })
  })
  const result = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: { deviceId: DEVICE_ID, uris: URIS },
    fetchImpl,
    sleep: async () => {},
    retryDelaysMs: [0, 5],
  })

  assert.deepEqual(result, { status: 200, body: { ok: true } })
  assert.equal(calls.length, 2)
  assert.equal(calls.every((call) => call.url.includes("/me/player/play")), true)
  assert.equal(result.status === 500, false)
})

test("repeated Spotify 500s become a clear 502", async () => {
  const { fetchImpl } = recordingFetch(() => jsonResponse(500, { error: { status: 500, message: "Internal Server Error" } }))
  const result = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: { deviceId: DEVICE_ID, uris: URIS },
    fetchImpl,
    sleep: async () => {},
    retryDelaysMs: [0, 5],
  })

  assert.equal(result.status, 502)
  assert.deepEqual(result.body, { error: PLAYBACK_UPSTREAM_MESSAGE, code: "playback_failed" })
})

test("a Spotify 401 refreshes the access token once and retries play", async () => {
  let plays = 0
  const { fetchImpl, calls } = recordingFetch(() => {
    plays += 1
    if (plays === 1) return jsonResponse(401, { error: { status: 401, message: "The access token expired" } })
    return new Response(null, { status: 204 })
  })
  let refreshes = 0
  const result = await respondToSpotifyPlay({
    accessToken: "stale-token",
    body: { deviceId: DEVICE_ID, uris: URIS },
    fetchImpl,
    sleep: async () => {
      throw new Error("token refresh retries immediately")
    },
    retryDelaysMs: [0, 500],
    refreshAccessToken: async () => {
      refreshes += 1
      return "fresh-token"
    },
  })

  assert.deepEqual(result, { status: 200, body: { ok: true } })
  assert.equal(refreshes, 1)
  assert.equal(calls[0]?.authorization, "Bearer stale-token")
  assert.equal(calls[1]?.authorization, "Bearer fresh-token")
})

test("a missing playback scope asks the listener to reconnect and does not call Spotify", async () => {
  let called = false
  const result = await respondToSpotifyPlay({
    accessToken: "user-token",
    grantedScope: "streaming user-modify-playback-state user-read-email",
    body: { deviceId: DEVICE_ID, uris: URIS },
    fetchImpl: async () => {
      called = true
      return new Response(null, { status: 204 })
    },
  })

  assert.equal(called, false)
  assert.deepEqual(result, {
    status: 403,
    body: { error: PLAYBACK_RECONNECT_MESSAGE, code: "insufficient_scope" },
  })
})

test("missing device id is retryable and does not call Spotify", async () => {
  let called = false
  const result = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: { deviceId: "", uris: URIS },
    fetchImpl: async () => {
      called = true
      return new Response(null, { status: 204 })
    },
    sleep: async () => {},
  })

  assert.equal(called, false)
  assert.equal(result.status, 409)
  assert.deepEqual(result.body, { error: PLAYER_NOT_READY_MESSAGE, code: "player_not_ready" })
})

test("play API rejects a logged-out listener and a request with no tracks", async () => {
  const loggedOut = await respondToSpotifyPlay({
    accessToken: null,
    body: { deviceId: DEVICE_ID, uris: URIS },
    fetchImpl: async () => {
      throw new Error("Spotify should not be called")
    },
  })
  assert.deepEqual(loggedOut, {
    status: 401,
    body: { error: "Not connected to Spotify", code: "not_connected" },
  })

  const noTracks = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: { deviceId: DEVICE_ID, uris: ["spotify:album:nope"], position: 0 },
    fetchImpl: async () => {
      throw new Error("Spotify should not be called")
    },
  })
  assert.equal(noTracks.status, 400)
  assert.equal(noTracks.body.code, "bad_request")

  const invalid = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: null,
    fetchImpl: async () => {
      throw new Error("Spotify should not be called")
    },
  })
  assert.deepEqual(invalid, { status: 400, body: { error: "Invalid JSON", code: "bad_request" } })
})

test("premium and login errors are returned immediately", async () => {
  const { fetchImpl, calls } = recordingFetch(() =>
    jsonResponse(403, {
      error: { status: 403, message: "Player command failed: Premium required", reason: "PREMIUM_REQUIRED" },
    })
  )
  const premium = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: { deviceId: DEVICE_ID, uris: URIS },
    fetchImpl,
    sleep: async () => {
      throw new Error("premium errors are not retried")
    },
    retryDelaysMs: [0, 500],
  })
  assert.deepEqual(premium, {
    status: 403,
    body: { error: PREMIUM_REQUIRED_MESSAGE, code: "premium_required" },
  })
  assert.equal(calls.length, 1)

  const { fetchImpl: authFetch } = recordingFetch(() =>
    jsonResponse(401, { error: { status: 401, message: "Invalid access token" } })
  )
  const expired = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: { deviceId: DEVICE_ID, uris: URIS },
    fetchImpl: authFetch,
    sleep: async () => {},
    retryDelaysMs: [0, 500],
  })
  assert.equal(expired.status, 401)
  assert.equal("error" in expired.body && expired.body.error, PLAYBACK_LOGIN_EXPIRED_MESSAGE)
  assert.equal("code" in expired.body && expired.body.code, "not_connected")
})
