/**
 * In-page sequential playback, modeled on Concertmaster.
 * The browser creates a Web Playback SDK player and audio stays in this page.
 * Playback starts on that player's device_id (`PUT /me/player/play?device_id=`).
 * It is not sent to the Spotify app or any other device.
 * No temporary playlist is created.
 */

const TRACK_URI = /^spotify:track:[A-Za-z0-9]+$/
const DEVICE_ID = /^[A-Za-z0-9]{10,80}$/

/**
 * Scopes the Web Playback SDK needs.
 * `user-read-playback-state` is required for the SDK's player-state calls.
 * Without it Spotify answers those with 401 and the dealer socket closes.
 */
export const SPOTIFY_OAUTH_SCOPES = [
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-private",
  "user-read-email",
] as const

/** Scopes that must be on the token before in-page play can start. */
export const SPOTIFY_PLAYBACK_CONTROL_SCOPES = [
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
] as const

/** Save playlist. `playlist-modify-public` stays so older grants can still refresh. */
export const SPOTIFY_PLAYLIST_SCOPES = ["playlist-modify-private", "playlist-modify-public"] as const

/** Save track → Liked Songs. Read scope shows whether the current movement is already liked. */
export const SPOTIFY_LIBRARY_SCOPES = ["user-library-modify", "user-library-read"] as const

export const SPOTIFY_PLAYER_NAME = "Classical Portal"

export const PREMIUM_REQUIRED_MESSAGE = "Spotify Premium is required for in-app continuous play."

/** Shown while the Web Playback SDK device is not registered with Spotify yet. */
export const PLAYER_NOT_READY_MESSAGE = "The in-app player is still connecting."

/** Shown after play has waited and the SDK device is still not registered. */
export const PLAYER_TRY_AGAIN_MESSAGE = "The in-app player is still connecting. Try Play again."

/** Shown when the granted token cannot drive the Web Playback SDK. */
export const PLAYBACK_RECONNECT_MESSAGE = "Reconnect Spotify to allow in-app playback."

/** Shown when Spotify rejects the access token. Refresh is attempted before this. */
export const PLAYBACK_LOGIN_EXPIRED_MESSAGE = "Spotify login expired. Sign in again."

/** Shown for a Spotify 5xx that survived retries. Never surfaced as an empty 500. */
export const PLAYBACK_UPSTREAM_MESSAGE = "Spotify could not start playback. Try again."

/**
 * Refresh an access token this long before the cookie expiry.
 * The Web Playback SDK holds the token for the dealer socket, so a 30s skew
 * hands it a token Spotify is about to reject with 401.
 */
export const ACCESS_TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000

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
  | "player_not_ready"
  | "not_connected"
  | "playback_failed"

export type ClassifiedSpotifyPlayError = {
  code: SpotifyPlayErrorCode
  message: string
  status: number
  /** Transient device or Spotify failures. The play route retries these. */
  retryable: boolean
}

export function spotifyOAuthScopeString(): string {
  return [...SPOTIFY_OAUTH_SCOPES, ...SPOTIFY_PLAYLIST_SCOPES, ...SPOTIFY_LIBRARY_SCOPES].join(" ")
}

/** True when this grant can connect the Web Playback SDK and start playback. */
export function tokenCanControlPlayback(scope: string | null | undefined): boolean {
  if (!scope?.trim()) return false
  const granted = new Set(scope.split(/\s+/).filter(Boolean))
  return SPOTIFY_PLAYBACK_CONTROL_SCOPES.every((item) => granted.has(item))
}

/**
 * Whether the stored access token should be exchanged before it is given to
 * Spotify or the Web Playback SDK. `force` covers a Spotify 401 for a token
 * whose cookie expiry has not been reached yet.
 */
export function accessTokenNeedsRefresh(input: {
  hasAccessToken: boolean
  expiresAtMs: number
  nowMs: number
  force?: boolean
}): boolean {
  if (input.force || !input.hasAccessToken) return true
  if (!Number.isFinite(input.expiresAtMs) || input.expiresAtMs <= 0) return true
  return input.nowMs >= input.expiresAtMs - ACCESS_TOKEN_REFRESH_SKEW_MS
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

/** The SDK can report ready before Spotify will accept playback on that device. */
export function isPlayerNotReadyCode(code: string | undefined): boolean {
  return code === "device_not_found" || code === "player_not_ready"
}

/**
 * Wait before another PUT /api/spotify/play while the page stays on "Connecting…".
 * Null means the listener should press Play again instead of looping forever.
 */
export function playbackDeviceRetryDelay(attempt: number): number | null {
  const delays = [800, 1600]
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= delays.length) return null
  return delays[attempt]
}

/**
 * Client retry delay for one play response.
 * The server already waits out device registration, so its final
 * "try again" message is shown instead of firing another play request.
 */
export function playIssueRetryDelay(
  issue: { code?: string; message?: string },
  attempt: number
): number | null {
  if (!isPlayerNotReadyCode(issue.code)) return null
  if (issue.message === PLAYER_TRY_AGAIN_MESSAGE) return null
  return playbackDeviceRetryDelay(attempt)
}

/** Cancel the previous play command so two PUTs cannot race into a 409. */
export function replacePlayAttempt(current: AbortController | null): AbortController {
  current?.abort()
  return new AbortController()
}

/**
 * `null` when Spotify did not say (missing `user-read-private`).
 * Only `"premium"` can drive the Web Playback SDK. `"free"` and `"open"` cannot.
 */
export function spotifyPremiumState(product: string | null | undefined): boolean | null {
  if (!product) return null
  return product === "premium"
}

export function classifySpotifyPlayError(status: number, payload: unknown): ClassifiedSpotifyPlayError {
  const error =
    payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: { message?: unknown; reason?: unknown } }).error
      : undefined
  const reason = typeof error?.reason === "string" ? error.reason : ""
  const message = typeof error?.message === "string" ? error.message : ""

  if (/scope/i.test(message) || /permissions missing/i.test(message)) {
    return {
      code: "insufficient_scope",
      message: PLAYBACK_RECONNECT_MESSAGE,
      status: 403,
      retryable: false,
    }
  }
  if (status === 401 || /invalid access token|token expired/i.test(message)) {
    return { code: "not_connected", message: PLAYBACK_LOGIN_EXPIRED_MESSAGE, status: 401, retryable: false }
  }
  if (reason === "PREMIUM_REQUIRED" || /premium required/i.test(message)) {
    return { code: "premium_required", message: PREMIUM_REQUIRED_MESSAGE, status: 403, retryable: false }
  }
  if (
    status === 404 ||
    reason === "NO_ACTIVE_DEVICE" ||
    /device not found/i.test(message) ||
    /no active device/i.test(message)
  ) {
    // 409, not 404: a 404 on our own /api/spotify/play looks like a missing route.
    return { code: "device_not_found", message: PLAYER_NOT_READY_MESSAGE, status: 409, retryable: true }
  }
  // Spotify returns 409 when a second play starts while the first is still applying,
  // and 403 "Restriction violated" when the Web Playback device is not active yet.
  if (status === 409 || status === 429 || /restriction violated/i.test(message)) {
    return { code: "player_not_ready", message: PLAYER_NOT_READY_MESSAGE, status: 409, retryable: true }
  }
  // PUT /me/player often returns 500 when no device is active. Retry; never pass 500 through.
  if (status >= 500 || status === 0) {
    return { code: "playback_failed", message: PLAYBACK_UPSTREAM_MESSAGE, status: 502, retryable: true }
  }
  const http = status >= 400 && status < 600 ? status : 502
  return { code: "playback_failed", message: PLAYBACK_UPSTREAM_MESSAGE, status: http, retryable: false }
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
