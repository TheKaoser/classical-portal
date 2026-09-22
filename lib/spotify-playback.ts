/**
 * In-app sequential playback, modeled on Concertmaster:
 * load the Web Playback SDK, then PUT /me/player/play with track URIs.
 * No temporary playlist is created.
 */

const TRACK_URI = /^spotify:track:[A-Za-z0-9]+$/
const DEVICE_ID = /^[A-Za-z0-9]{10,80}$/

/** Scopes Concertmaster requests for the Web Playback SDK. No playlist scopes. */
export const SPOTIFY_OAUTH_SCOPES = [
  "streaming",
  "user-modify-playback-state",
  "user-read-private",
  "user-read-email",
] as const

export const SPOTIFY_PLAYER_NAME = "Classical Portal"

export const PREMIUM_REQUIRED_MESSAGE = "Spotify Premium is required for in-app continuous play."

export type PlaybackEmbed = { kind: "track"; id: string; title: string; height: number }

export type PendingPlayback = {
  recordingId: string
  uris: string[]
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
  return SPOTIFY_OAUTH_SCOPES.join(" ")
}

export function isSpotifyTrackUri(uri: string): boolean {
  return TRACK_URI.test(uri)
}

export function isSpotifyDeviceId(value: string): boolean {
  return DEVICE_ID.test(value)
}

/** Keep valid track URIs in the order they were matched. */
export function orderedTrackUris(tracks: { uri: string }[]): string[] {
  return uniqueTrackUris(tracks.map((track) => track.uri))
}

export function uniqueTrackUris(uris: string[]): string[] {
  const unique: string[] = []
  for (const uri of uris) {
    if (isSpotifyTrackUri(uri) && !unique.includes(uri)) unique.push(uri)
  }
  return unique
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
    if (!value.recordingId || uris.length < 2) return null
    return { recordingId: value.recordingId, uris }
  } catch {
    return null
  }
}

/** Track embed used while browsing. Suppressed while Play all is using the SDK. */
export function chooseTrackEmbed(input: {
  selectedTrack: { id: string; name: string } | null
  suppress: boolean
}): PlaybackEmbed | null {
  if (input.suppress || !input.selectedTrack) return null
  return { kind: "track", id: input.selectedTrack.id, title: input.selectedTrack.name, height: 152 }
}
