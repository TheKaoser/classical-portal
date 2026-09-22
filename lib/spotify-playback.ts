/**
 * In-app playback through the Spotify Web Playback SDK.
 * Play all sends matched track URIs to PUT /me/player/play. Saving a playlist is separate.
 */

import { orderedTrackUris, uniqueTrackUris } from "./spotify-playlist.ts"

export { orderedTrackUris, uniqueTrackUris }

const DEVICE_ID = /^[A-Za-z0-9]{10,80}$/

/** Scopes the Web Playback SDK needs. */
export const SPOTIFY_PLAYBACK_SCOPES = [
  "streaming",
  "user-modify-playback-state",
  "user-read-private",
  "user-read-email",
] as const

/** Save playlist. `playlist-modify-public` stays so older grants can still refresh. */
export const SPOTIFY_PLAYLIST_SCOPES = ["playlist-modify-private", "playlist-modify-public"] as const

export const SPOTIFY_PLAYER_NAME = "Classical Portal"

export const PREMIUM_REQUIRED_MESSAGE = "Spotify Premium is required for in-app continuous play."

export type PendingPlayback = {
  recordingId: string
  uris: string[]
  position: number
}

export type SpotifyPlayBody = {
  uris: string[]
  offset: { position: number }
}

export type SpotifyPlayErrorCode =
  | "premium_required"
  | "insufficient_scope"
  | "device_not_found"
  | "not_connected"
  | "playback_failed"

export function spotifyOAuthScopeString(): string {
  return [...SPOTIFY_PLAYBACK_SCOPES, ...SPOTIFY_PLAYLIST_SCOPES].join(" ")
}

export function isSpotifyDeviceId(value: string): boolean {
  return DEVICE_ID.test(value)
}

/**
 * Body for PUT /v1/me/player/play. `position` is the zero-based index in `uris`.
 * Returns null when the list is empty or the offset is outside that list.
 */
export function spotifyPlayRequest(input: { uris: string[]; position?: number }): SpotifyPlayBody | null {
  const uris = uniqueTrackUris(input.uris).slice(0, 100)
  if (uris.length === 0) return null
  const position = input.position ?? 0
  if (!Number.isInteger(position) || position < 0 || position >= uris.length) return null
  return { uris, offset: { position } }
}

/**
 * `null` when Spotify did not say (missing `user-read-private`).
 * Only `"premium"` can drive the Web Playback SDK. `"free"` and `"open"` cannot.
 */
export function spotifyPremiumState(product: string | null | undefined): boolean | null {
  if (!product) return null
  return product === "premium"
}

export function classifySpotifyPlayError(
  status: number,
  payload: unknown
): { code: SpotifyPlayErrorCode; message: string; status: number } {
  const error =
    payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: { message?: unknown; reason?: unknown } }).error
      : undefined
  const reason = typeof error?.reason === "string" ? error.reason : ""
  const message = typeof error?.message === "string" ? error.message : ""

  if (status === 401 || /invalid access token/i.test(message)) {
    return { code: "not_connected", message: "Spotify login expired. Sign in again.", status: 401 }
  }
  if (reason === "PREMIUM_REQUIRED" || /premium/i.test(message)) {
    return { code: "premium_required", message: PREMIUM_REQUIRED_MESSAGE, status: 403 }
  }
  if (/scope/i.test(message)) {
    return {
      code: "insufficient_scope",
      message: "Reconnect Spotify to allow in-app playback.",
      status: 403,
    }
  }
  if (status === 404 || /device not found/i.test(message)) {
    return { code: "device_not_found", message: "The in-app player is not ready yet.", status: 404 }
  }
  const http = status >= 400 && status < 600 ? status : 502
  return { code: "playback_failed", message: "Spotify could not start playback.", status: http }
}

export function parsePendingPlayback(raw: string): PendingPlayback | null {
  try {
    const value = JSON.parse(raw) as Partial<PendingPlayback> | null
    if (!value || typeof value.recordingId !== "string" || !Array.isArray(value.uris)) return null
    const uris = uniqueTrackUris(value.uris.filter((uri): uri is string => typeof uri === "string"))
    if (!value.recordingId || uris.length < 1) return null
    const requested = value.position
    const position =
      typeof requested === "number" && Number.isInteger(requested) && requested >= 0 && requested < uris.length
        ? requested
        : 0
    return { recordingId: value.recordingId, uris, position }
  } catch {
    return null
  }
}

/** Milliseconds for a seek-bar percentage. Null when there is nothing to seek. */
export function seekPositionMs(percent: number, durationMs: number): number | null {
  if (!Number.isFinite(percent) || !Number.isFinite(durationMs) || durationMs <= 0) return null
  const clamped = Math.min(100, Math.max(0, percent))
  return Math.round((clamped / 100) * durationMs)
}
