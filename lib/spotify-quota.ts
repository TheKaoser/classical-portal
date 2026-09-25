export const SPOTIFY_RECORDINGS_UNAVAILABLE = "Recordings temporarily unavailable."

/** Honor Retry-After, but don't let a wild header disable recordings for days. */
export const SPOTIFY_QUOTA_MAX_DELAY_MS = 24 * 60 * 60 * 1000

/** QUOTA_EXCEEDED with no usable Retry-After. The app quota is exhausted, not a one-second blip. */
export const SPOTIFY_QUOTA_DEFAULT_DELAY_MS = 60 * 60 * 1000

/** Other 429s (rate limit) with no usable Retry-After. */
export const SPOTIFY_RATE_LIMIT_DEFAULT_DELAY_MS = 15 * 60 * 1000

const MIN_DELAY_MS = 1000

type QuotaGlobal = { openUntil: number }

function quotaGlobal(): QuotaGlobal {
  const g = globalThis as typeof globalThis & { __classicalPortalSpotifyQuota?: QuotaGlobal }
  if (!g.__classicalPortalSpotifyQuota) g.__classicalPortalSpotifyQuota = { openUntil: 0 }
  return g.__classicalPortalSpotifyQuota
}

export class SpotifyQuotaSignal extends Error {
  constructor() {
    super("Spotify quota exceeded")
    this.name = "SpotifyQuotaSignal"
  }
}

/** Thrown when the shared quota marker has not been published. Not cached. */
export class SpotifyQuotaUnset extends Error {
  constructor() {
    super("Spotify quota marker unset")
    this.name = "SpotifyQuotaUnset"
  }
}

export function isSpotifyQuotaSignal(error: unknown): boolean {
  return error instanceof SpotifyQuotaSignal || (error instanceof Error && error.name === "SpotifyQuotaSignal")
}

export function isSpotifyQuotaUnset(error: unknown): boolean {
  return error instanceof SpotifyQuotaUnset || (error instanceof Error && error.name === "SpotifyQuotaUnset")
}

export function spotifyErrorReason(body: string): string | null {
  try {
    const data = JSON.parse(body) as { error?: { reason?: unknown } }
    return typeof data.error?.reason === "string" ? data.error.reason : null
  } catch {
    return null
  }
}

/** Milliseconds until Retry-After, or null when the header is missing or already past. */
export function parseRetryAfterMs(header: string | null, now: number): number | null {
  if (!header) return null
  const trimmed = header.trim()
  if (!trimmed) return null
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed)
    if (!Number.isFinite(seconds) || seconds <= 0) return null
    return Math.round(seconds * 1000)
  }
  const date = Date.parse(trimmed)
  if (Number.isNaN(date)) return null
  const delta = date - now
  if (delta <= 0) return null
  return delta
}

export function spotifyRetryDelayMs(header: string | null, body: string, now = Date.now()): number {
  const parsed = parseRetryAfterMs(header, now)
  const reason = spotifyErrorReason(body)
  const delay =
    parsed ??
    (reason === "QUOTA_EXCEEDED" ? SPOTIFY_QUOTA_DEFAULT_DELAY_MS : SPOTIFY_RATE_LIMIT_DEFAULT_DELAY_MS)
  return Math.min(Math.max(delay, MIN_DELAY_MS), SPOTIFY_QUOTA_MAX_DELAY_MS)
}

/** Absolute timestamp. Later calls only extend the window. */
export function tripSpotifyQuota(openUntil: number, now = Date.now()): void {
  if (!(openUntil > now)) return
  const state = quotaGlobal()
  if (openUntil > state.openUntil) state.openUntil = openUntil
}

export function spotifyQuotaOpenUntil(now = Date.now()): number {
  const until = quotaGlobal().openUntil
  return until > now ? until : 0
}

export function spotifyCallsBlocked(now = Date.now()): boolean {
  return quotaGlobal().openUntil > now
}

export function resetSpotifyQuotaForTests(): void {
  quotaGlobal().openUntil = 0
}
