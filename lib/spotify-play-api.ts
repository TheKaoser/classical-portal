import {
  PLAYER_NOT_READY_MESSAGE,
  PLAYER_TRY_AGAIN_MESSAGE,
  classifySpotifyPlayError,
  inPagePlayerPlayUrl,
  spotifyPlayRequest,
  uniqueTrackUris,
  type SpotifyPlayBody,
  type SpotifyPlayErrorCode,
} from "./spotify-playback.ts"

/** PUT /v1/me/player — move playback onto the Web Playback SDK device. */
export const SPOTIFY_PLAYER_TRANSFER_URL = "https://api.spotify.com/v1/me/player"

/**
 * Pauses between attempts while Spotify registers the SDK device.
 * The first attempt is immediate. Later attempts cover the ready-event race.
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

/** Never answer 404 for a player that is still connecting. That status looks like a missing route. */
function publicPlayStatus(status: number, code: string): number {
  if (code === "device_not_found" || code === "player_not_ready") return 409
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

/**
 * PUT /api/spotify/play.
 * Transfers playback onto the page's Web Playback SDK device, then starts the track URIs.
 * Retries when Spotify does not know the device yet. Missing device_id does not call Spotify.
 */
export async function respondToSpotifyPlay(input: {
  accessToken: string | null
  body: unknown
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  retryDelaysMs?: readonly number[]
}): Promise<SpotifyPlayApiResult> {
  if (!input.accessToken) {
    return failure(401, "not_connected", "Not connected to Spotify")
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
  const accessToken = input.accessToken

  for (let attempt = 0; attempt < delays.length; attempt++) {
    const wait = delays[attempt] ?? 0
    if (wait > 0) await sleep(wait)

    try {
      const transfer = await putSpotify(fetchImpl, accessToken, SPOTIFY_PLAYER_TRANSFER_URL, transferBody)
      if (!isPlaybackAccepted(transfer.status)) {
        const classified = classifySpotifyPlayError(transfer.status, transfer.payload)
        if (classified.code !== "device_not_found") {
          return failure(publicPlayStatus(classified.status, classified.code), classified.code, classified.message)
        }
        continue
      }

      const play = await putSpotify(fetchImpl, accessToken, playUrl, playBody)
      if (isPlaybackAccepted(play.status)) {
        return { status: 200, body: { ok: true } }
      }

      const classified = classifySpotifyPlayError(play.status, play.payload)
      if (classified.code !== "device_not_found") {
        return failure(publicPlayStatus(classified.status, classified.code), classified.code, classified.message)
      }
    } catch {
      return failure(502, "playback_failed", "Spotify could not start playback.")
    }
  }

  return failure(409, "player_not_ready", PLAYER_TRY_AGAIN_MESSAGE)
}
