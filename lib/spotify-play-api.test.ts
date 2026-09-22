import assert from "node:assert/strict"
import { test } from "node:test"
import { PLAYER_NOT_READY_MESSAGE, PLAYER_TRY_AGAIN_MESSAGE, PREMIUM_REQUIRED_MESSAGE } from "./spotify-playback.ts"
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

test("play API transfers playback onto the Web Playback device, then starts the track URIs", async () => {
  const { fetchImpl, calls } = recordingFetch(() => new Response(null, { status: 204 }))
  const result = await respondToSpotifyPlay({
    accessToken: "user-token",
    body: { deviceId: DEVICE_ID, uris: [...URIS, "not-a-uri", URIS[0]], position: 0 },
    fetchImpl,
    sleep: async () => {},
    retryDelaysMs: [0],
  })

  assert.deepEqual(result, { status: 200, body: { ok: true } })
  assert.equal(calls.length, 2)
  assert.equal(calls[0]?.method, "PUT")
  assert.equal(calls[0]?.url, SPOTIFY_PLAYER_TRANSFER_URL)
  assert.equal(calls[0]?.authorization, "Bearer user-token")
  assert.deepEqual(calls[0]?.body, { device_ids: [DEVICE_ID], play: false })
  assert.equal(calls[1]?.method, "PUT")
  assert.equal(calls[1]?.url, `https://api.spotify.com/v1/me/player/play?device_id=${DEVICE_ID}`)
  assert.equal(calls[1]?.authorization, "Bearer user-token")
  assert.deepEqual(calls[1]?.body, {
    uris: URIS,
    offset: { position: 0 },
  })
  assert.equal(spotifyTransferRequest(DEVICE_ID)?.play, false)
  assert.equal(spotifyTransferRequest(""), null)
})

test("play API retries while Spotify does not know the SDK device and does not return 404", async () => {
  let playAttempts = 0
  const sleeps: number[] = []
  const { fetchImpl, calls } = recordingFetch((call) => {
    if (call.url === SPOTIFY_PLAYER_TRANSFER_URL && calls.filter((item) => item.url === SPOTIFY_PLAYER_TRANSFER_URL).length === 1) {
      return jsonResponse(404, { error: { status: 404, message: "Device not found" } })
    }
    if (call.url.includes("/me/player/play")) {
      playAttempts += 1
      if (playAttempts === 1) {
        return jsonResponse(404, { error: { status: 404, message: "Player command failed: No active device found", reason: "NO_ACTIVE_DEVICE" } })
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
  assert.deepEqual(sleeps, [25, 25])
  assert.equal(playAttempts, 2)
  assert.equal(calls.filter((call) => call.url === SPOTIFY_PLAYER_TRANSFER_URL).length, 3)
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
  assert.equal(calls.length, 2)
  assert.equal(calls.some((call) => call.url.includes("/me/player/play")), false)
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
  assert.equal(expired.body.code, "not_connected")
})
