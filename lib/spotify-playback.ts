/**
 * In-page sequential playback, modeled on Concertmaster.
 * The browser creates a Web Playback SDK player and audio stays in this page.
 * PUT /me/player/play always includes that player's device_id.
 * Playback is not transferred to the Spotify app or any other device.
 * No temporary playlist is created.
 */

const TRACK_URI = /^spotify:track:[A-Za-z0-9]+$/
const DEVICE_ID = /^[A-Za-z0-9]{10,80}$/

/** Scopes the Web Playback SDK needs. */
export const SPOTIFY_OAUTH_SCOPES = [
  "streaming",
  "user-modify-playback-state",
  "user-read-private",
  "user-read-email",
] as const

/** Save playlist. `playlist-modify-public` stays so older grants can still refresh. */
export const SPOTIFY_PLAYLIST_SCOPES = ["playlist-modify-private", "playlist-modify-public"] as const

export const SPOTIFY_PLAYER_NAME = "Classical Portal"

export const PREMIUM_REQUIRED_MESSAGE = "Spotify Premium is required for in-app continuous play."

/** Arrow keys move the playhead by this many milliseconds. */
export const SEEK_STEP_MS = 5_000

/** Shift+arrow moves the playhead by this many milliseconds. */
export const SEEK_STEP_LARGE_MS = 10_000

/**
 * Ignore SDK position reports this far from a seek we just sent.
 * The player keeps reporting the old playhead until seek finishes.
 */
export const PLAYBACK_SEEK_SYNC_TOLERANCE_MS = 1_500

/** How long to keep ignoring stale positions after player.seek. */
export const PLAYBACK_SEEK_SYNC_MS = 1_200

export type PlaybackEmbed = { kind: "track"; id: string; title: string; height: number }

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
  return [...SPOTIFY_OAUTH_SCOPES, ...SPOTIFY_PLAYLIST_SCOPES].join(" ")
}

export function isSpotifyTrackUri(uri: string): boolean {
  return TRACK_URI.test(uri)
}

export function isSpotifyDeviceId(value: string): boolean {
  return DEVICE_ID.test(value)
}

/**
 * Start playback on the Web Playback SDK instance this page created.
 * A play call without device_id would target whatever Spotify app is already active.
 */
export function inPagePlayerPlayUrl(deviceId: string): string | null {
  if (!isSpotifyDeviceId(deviceId)) return null
  return `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`
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

/**
 * Fraction 0–1 along a horizontal seek bar from a pointer's clientX.
 * Clicks past either end clamp to the start or end of the track.
 */
export function seekRatioFromPointer(clientX: number, bounds: { left: number; width: number }): number {
  const { left, width } = bounds
  if (!Number.isFinite(clientX) || !Number.isFinite(left) || !Number.isFinite(width) || width <= 0) return 0
  return Math.min(1, Math.max(0, (clientX - left) / width))
}

/**
 * Milliseconds for SpotifyPlayer.seek. `ratio` is 0–1 along the current track.
 * Returns null when there is no duration, so a click cannot seek an empty player.
 */
export function seekPositionMs(ratio: number, durationMs: number): number | null {
  if (!Number.isFinite(ratio) || !Number.isFinite(durationMs) || durationMs <= 0) return null
  const clamped = Math.min(1, Math.max(0, ratio))
  return Math.min(durationMs, Math.max(0, Math.round(clamped * durationMs)))
}

/**
 * New playhead for Home, End, and arrow keys. Null when the key is not a seek key
 * or the track has no duration.
 */
export function seekByKeyboard(input: {
  key: string
  positionMs: number
  durationMs: number
  shiftKey?: boolean
}): number | null {
  if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) return null
  const position = Number.isFinite(input.positionMs) ? input.positionMs : 0
  const step = input.shiftKey ? SEEK_STEP_LARGE_MS : SEEK_STEP_MS
  switch (input.key) {
    case "ArrowRight":
    case "ArrowUp":
      return seekPositionMs((position + step) / input.durationMs, input.durationMs)
    case "ArrowLeft":
    case "ArrowDown":
      return seekPositionMs((position - step) / input.durationMs, input.durationMs)
    case "Home":
      return 0
    case "End":
      return input.durationMs
    default:
      return null
  }
}

/**
 * Whether a position reported by the SDK should move the seek bar.
 * Scrubbing and a seek that has not landed yet keep the bar on the listener's target.
 */
export function shouldApplyPlaybackPosition(input: {
  reportedMs: number
  scrubbing: boolean
  pendingSeekMs: number | null
  nowMs: number
  pendingUntilMs: number
}): boolean {
  if (input.scrubbing) return false
  if (input.pendingSeekMs == null) return true
  if (!Number.isFinite(input.pendingUntilMs) || input.nowMs >= input.pendingUntilMs) return true
  return Math.abs(input.reportedMs - input.pendingSeekMs) <= PLAYBACK_SEEK_SYNC_TOLERANCE_MS
}

/** Track embed used while browsing. Suppressed while Play all is using the SDK. */
export function chooseTrackEmbed(input: {
  selectedTrack: { id: string; name: string } | null
  suppress: boolean
}): PlaybackEmbed | null {
  if (input.suppress || !input.selectedTrack) return null
  return { kind: "track", id: input.selectedTrack.id, title: input.selectedTrack.name, height: 152 }
}
