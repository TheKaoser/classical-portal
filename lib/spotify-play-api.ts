import {
  PLAYBACK_LOGIN_EXPIRED_MESSAGE,
  PLAYBACK_RECONNECT_MESSAGE,
  PLAYBACK_UPSTREAM_MESSAGE,
  PLAYER_NOT_READY_MESSAGE,
  PLAYER_TRY_AGAIN_MESSAGE,
  classifySpotifyPlayError,
  inPagePlayerPlayUrl,
  spotifyPlayRequest,
  tokenCanControlPlayback,
  uniqueTrackUris,
  type ClassifiedSpotifyPlayError,
  type SpotifyPlayBody,
  type SpotifyPlayErrorCode,
} from "./spotify-playback.ts"

/** PUT /v1/me/player — move playback onto the Web Playback SDK device. */
export const SPOTIFY_PLAYER_TRANSFER_URL = "https://api.spotify.com/v1/me/player"

/**
 * Pauses between attempts while Spotify registers the SDK device.
 * The first attempt is immediate. Later attempts cover the ready-event race
 * and Spotify's 500 from transfer when no device is active yet.
 */
export const WEB_PLAYBACK_START_RETRY_MS = [0, 350, 800, 1400, 2200] as const

export type SpotifyPlayApiBody =
  | { ok: true }
  | { error: string; code: SpotifyPlayErrorCode | "bad_request" }

export type SpotifyPlayApiResult = {
  status: number
  body: SpotifyPlayApiBody
}

type TransferBody = { device_ids: [string]; play: false }

export function spotifyTransferRequest(deviceId: string): TransferBody | null {
  const playUrl = inPagePlayerPlayUrl(deviceId)
  if (!playUrl) return null
  return { device_ids: [deviceId], play: false }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPlaybackAccepted(status: number): boolean {
  return status === 200 || status === 202 || status === 204
}

/** Never answer 404 or 500 for a player that is still connecting. */
function publicPlayStatus(status: number, code: string): number {
  if (code === "device_not_found" || code === "player_not_ready") return 409
  if (status >= 500) return 502
  return status
}

async function putSpotify(
  fetchImpl: typeof fetch,
  accessToken: string,
  url: string,
  body: TransferBody | SpotifyPlayBody
): Promise<{ status: number; payload: unknown }> {
  const res = await fetchImpl(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const payload = await res.json().catch(() => null)
  return { status: res.status, payload }
}

function failure(status: number, code: SpotifyPlayErrorCode | "bad_request", error: string): SpotifyPlayApiResult {
  return { status, body: { error, code } }
}

function failureFromClassified(classified: ClassifiedSpotifyPlayError): SpotifyPlayApiResult {
  return failure(publicPlayStatus(classified.status, classified.code), classified.code, classified.message)
}

type PlayAttempt =
  | { ok: true }
  | { ok: false; status: number; classified: ClassifiedSpotifyPlayError }

/**
 * Start the track list on this page's SDK device.
 * `PUT /me/player/play?device_id=` both activates that device and starts the URIs.
 * A preceding transfer with `play: false` returns 500 from Spotify when nothing
 * is currently active, and that 500 drops the device — so transfer runs only as a
 * fallback after "no active device", and its 5xx is not returned to the browser.
 */
async function startOnSdkDevice(
  fetchImpl: typeof fetch,
  accessToken: string,
  playUrl: string,
  playBody: SpotifyPlayBody,
  transferBody: TransferBody
): Promise<PlayAttempt> {
  let play = await putSpotify(fetchImpl, accessToken, playUrl, playBody)
  if (isPlaybackAccepted(play.status)) return { ok: true }
  if (play.status === 401) {
    return { ok: false, status: 401, classified: classifySpotifyPlayError(401, play.payload) }
  }

  let classified = classifySpotifyPlayError(play.status, play.payload)
  if (classified.code !== "device_not_found") {
    return { ok: false, status: play.status, classified }
  }

  const transfer = await putSpotify(fetchImpl, accessToken, SPOTIFY_PLAYER_TRANSFER_URL, transferBody)
  if (transfer.status === 401) {
    return { ok: false, status: 401, classified: classifySpotifyPlayError(401, transfer.payload) }
  }
  if (!isPlaybackAccepted(transfer.status)) {
    const transferClassified = classifySpotifyPlayError(transfer.status, transfer.payload)
    // Transfer 500/404 while the SDK device is still registering. Keep retrying play.
    if (transferClassified.retryable) return { ok: false, status: play.status, classified }
    return { ok: false, status: transfer.status, classified: transferClassified }
  }

  play = await putSpotify(fetchImpl, accessToken, playUrl, playBody)
  if (isPlaybackAccepted(play.status)) return { ok: true }
  if (play.status === 401) {
    return { ok: false, status: 401, classified: classifySpotifyPlayError(401, play.payload) }
  }
  classified = classifySpotifyPlayError(play.status, play.payload)
  return { ok: false, status: play.status, classified }
}

/**
 * PUT /api/spotify/play.
 * Starts the track URIs on the page's Web Playback SDK device.
 * Retries while Spotify does not know the device yet, and once after a 401 refresh.
 * Missing device_id does not call Spotify.
 */
export async function respondToSpotifyPlay(input: {
  accessToken: string | null
  body: unknown
  /** Granted OAuth scope. `null` when this session predates the scope cookie. */
  grantedScope?: string | null
  refreshAccessToken?: () => Promise<string | null>
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  retryDelaysMs?: readonly number[]
}): Promise<SpotifyPlayApiResult> {
  if (!input.accessToken) {
    return failure(401, "not_connected", "Not connected to Spotify")
  }

  if (input.grantedScope && !tokenCanControlPlayback(input.grantedScope)) {
    return failure(403, "insufficient_scope", PLAYBACK_RECONNECT_MESSAGE)
  }

  if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) {
    return failure(400, "bad_request", "Invalid JSON")
  }

  const record = input.body as Record<string, unknown>
  const deviceId = typeof record.deviceId === "string" ? record.deviceId.trim() : ""
  const position = typeof record.position === "number" ? record.position : record.position === undefined ? 0 : -1
  const uris = uniqueTrackUris(
    Array.isArray(record.uris) ? record.uris.filter((uri): uri is string => typeof uri === "string") : []
  )
  const playBody = spotifyPlayRequest({ uris, position })
  if (!playBody) {
    return failure(400, "bad_request", "At least one track is required")
  }

  const transferBody = spotifyTransferRequest(deviceId)
  const playUrl = inPagePlayerPlayUrl(deviceId)
  if (!transferBody || !playUrl) {
    return failure(409, "player_not_ready", PLAYER_NOT_READY_MESSAGE)
  }

  const fetchImpl = input.fetchImpl ?? fetch
  const sleep = input.sleep ?? defaultSleep
  const delays = input.retryDelaysMs ?? WEB_PLAYBACK_START_RETRY_MS
  let accessToken = input.accessToken
  let refreshed = false
  let sawDeviceNotReady = false
  let lastRetryable: ClassifiedSpotifyPlayError | null = null

  for (let attempt = 0; attempt < delays.length; attempt++) {
    const wait = delays[attempt] ?? 0
    if (wait > 0) await sleep(wait)

    try {
      let attemptResult = await startOnSdkDevice(fetchImpl, accessToken, playUrl, playBody, transferBody)
      if (!attemptResult.ok && attemptResult.status === 401 && !refreshed && input.refreshAccessToken) {
        refreshed = true
        const next = await input.refreshAccessToken()
        if (!next) return failure(401, "not_connected", PLAYBACK_LOGIN_EXPIRED_MESSAGE)
        accessToken = next
        attemptResult = await startOnSdkDevice(fetchImpl, accessToken, playUrl, playBody, transferBody)
      }
      if (attemptResult.ok) return { status: 200, body: { ok: true } }

      if (attemptResult.status === 401) {
        return failure(401, "not_connected", PLAYBACK_LOGIN_EXPIRED_MESSAGE)
      }
      if (!attemptResult.classified.retryable) return failureFromClassified(attemptResult.classified)
      if (
        attemptResult.classified.code === "device_not_found" ||
        attemptResult.classified.code === "player_not_ready"
      ) {
        sawDeviceNotReady = true
      }
      lastRetryable = attemptResult.classified
    } catch {
      lastRetryable = classifySpotifyPlayError(502, null)
    }
  }

  if (sawDeviceNotReady) return failure(409, "player_not_ready", PLAYER_TRY_AGAIN_MESSAGE)
  if (lastRetryable) return failureFromClassified(lastRetryable)
  return failure(502, "playback_failed", PLAYBACK_UPSTREAM_MESSAGE)
}
