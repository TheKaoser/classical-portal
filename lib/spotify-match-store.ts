import { isCrawlerUserAgent } from "./crawler.ts"
import {
  isSpotifyConfigured,
  isSpotifyOAuthConfigured,
  type SpotifyMatches,
  type SpotifyRecording,
} from "./spotify-model.ts"

/** Empty catalog searches are retried after this. Positive matches do not expire. */
export const SPOTIFY_WORK_MATCH_NEGATIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const TABLE = "spotify_work_matches"
const REQUEST_TIMEOUT_MS = 5_000

export type SpotifyMatchStoreDeps = {
  fetch?: typeof fetch
  now?: () => number
  env?: {
    supabaseUrl?: string
    serviceRoleKey?: string
    market?: string
  }
}

type StoreConfig = {
  url: string
  key: string
  market: string
}

type MatchRow = {
  recordings: SpotifyRecording[]
  query: string
  search_url: string
  expires_at: string | null
  negative?: boolean
}

const inflight = new Map<string, Promise<SpotifyMatches>>()
let unconfiguredWarned = false
let tableWarned = false

/** Market used for both the Spotify request and the durable row. */
export function spotifyMatchMarket(deps?: SpotifyMatchStoreDeps): string {
  const fromDeps = deps?.env
  const raw = (fromDeps ? fromDeps.market : process.env.SPOTIFY_MARKET) ?? "US"
  const market = raw.trim().toUpperCase()
  return market || "US"
}

/**
 * A completed catalog search may be stored. Quota failures, crawler skips,
 * and "credentials missing" are not results.
 */
export function durableMatchKind(matches: SpotifyMatches): "positive" | "negative" | null {
  if (!matches.configured || matches.unavailable || matches.skipped) return null
  return matches.recordings.length > 0 ? "positive" : "negative"
}

export function durableRowFromMatch(
  workId: string,
  market: string,
  matches: SpotifyMatches,
  now: number
): {
  work_id: string
  market: string
  negative: boolean
  recordings: SpotifyRecording[]
  query: string
  search_url: string
  stored_at: string
  expires_at: string | null
} | null {
  const kind = durableMatchKind(matches)
  if (!kind) return null
  return {
    work_id: workId,
    market,
    negative: kind === "negative",
    recordings: matches.recordings,
    query: matches.query,
    search_url: matches.searchUrl,
    stored_at: new Date(now).toISOString(),
    expires_at:
      kind === "negative" ? new Date(now + SPOTIFY_WORK_MATCH_NEGATIVE_TTL_MS).toISOString() : null,
  }
}

/** Null expires_at is a permanent positive. A past expires_at is a miss. */
export function isDurableRowFresh(expiresAt: string | null | undefined, now: number): boolean {
  if (!expiresAt) return true
  const exp = Date.parse(expiresAt)
  if (Number.isNaN(exp)) return false
  return exp > now
}

function storeConfig(deps?: SpotifyMatchStoreDeps): StoreConfig | null {
  const fromDeps = deps?.env
  const url = ((fromDeps ? fromDeps.supabaseUrl : process.env.NEXT_PUBLIC_SUPABASE_URL) ?? "")
    .trim()
    .replace(/\/$/, "")
  const key = ((fromDeps ? fromDeps.serviceRoleKey : process.env.SUPABASE_SERVICE_ROLE_KEY) ?? "").trim()
  if (!url || !key) return null
  return { url, key, market: spotifyMatchMarket(deps) }
}

function noteUnconfigured(): void {
  if (unconfiguredWarned) return
  unconfiguredWarned = true
  console.warn(
    "Spotify work matches are not stored durably. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and run supabase/spotify_work_matches.sql."
  )
}

function noteStoreFailure(status: number, detail: string): void {
  if (status === 404 && !tableWarned) {
    tableWarned = true
    console.warn(
      "Spotify work-match table is missing. Run supabase/spotify_work_matches.sql in the Supabase SQL editor."
    )
    return
  }
  console.error("Spotify work-match store request failed", status, detail.slice(0, 300))
}

function authHeaders(key: string): Headers {
  const headers = new Headers()
  headers.set("apikey", key)
  headers.set("Authorization", `Bearer ${key}`)
  headers.set("Accept", "application/json")
  return headers
}

async function storeFetch(url: string, init: RequestInit, deps?: SpotifyMatchStoreDeps): Promise<Response> {
  const fetchImpl = deps?.fetch ?? fetch
  return fetchImpl(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

function matchesFromRow(row: MatchRow, now: number): SpotifyMatches | null {
  if (!isDurableRowFresh(row.expires_at, now)) return null
  if (!Array.isArray(row.recordings)) return null
  return {
    configured: isSpotifyConfigured(),
    oauthConfigured: isSpotifyOAuthConfigured(),
    query: typeof row.query === "string" ? row.query : "",
    searchUrl: typeof row.search_url === "string" ? row.search_url : "",
    recordings: row.recordings,
  }
}

/** Read a non-expired work match. Failures are misses so playback can still search. */
export async function readDurableWorkMatch(
  workId: string,
  deps?: SpotifyMatchStoreDeps
): Promise<SpotifyMatches | null> {
  const config = storeConfig(deps)
  if (!config) {
    noteUnconfigured()
    return null
  }
  const url = new URL(`${config.url}/rest/v1/${TABLE}`)
  url.searchParams.set("work_id", `eq.${workId}`)
  url.searchParams.set("market", `eq.${config.market}`)
  url.searchParams.set("select", "recordings,query,search_url,expires_at")
  url.searchParams.set("limit", "1")
  try {
    const response = await storeFetch(url.toString(), { method: "GET", headers: authHeaders(config.key) }, deps)
    if (!response.ok) {
      noteStoreFailure(response.status, await response.text().catch(() => ""))
      return null
    }
    const payload: unknown = await response.json()
    if (!Array.isArray(payload) || payload.length === 0) return null
    const row = payload[0] as MatchRow
    return matchesFromRow(row, deps?.now?.() ?? Date.now())
  } catch (error) {
    console.error(
      "Spotify work-match store read failed",
      error instanceof Error ? error.message : "request failed"
    )
    return null
  }
}

/** Upsert a finished search. Positive rows have no expires_at. Negatives expire in 7 days. */
export async function writeDurableWorkMatch(
  workId: string,
  matches: SpotifyMatches,
  deps?: SpotifyMatchStoreDeps
): Promise<void> {
  const now = deps?.now?.() ?? Date.now()
  const config = storeConfig(deps)
  if (!config) {
    if (durableMatchKind(matches)) noteUnconfigured()
    return
  }
  const row = durableRowFromMatch(workId, config.market, matches, now)
  if (!row) return
  const url = new URL(`${config.url}/rest/v1/${TABLE}`)
  url.searchParams.set("on_conflict", "work_id,market")
  const headers = authHeaders(config.key)
  headers.set("Content-Type", "application/json")
  headers.set("Prefer", "resolution=merge-duplicates,return=minimal")
  try {
    const response = await storeFetch(
      url.toString(),
      { method: "POST", headers, body: JSON.stringify(row) },
      deps
    )
    if (!response.ok) {
      noteStoreFailure(response.status, await response.text().catch(() => ""))
    }
  } catch (error) {
    console.error(
      "Spotify work-match store write failed",
      error instanceof Error ? error.message : "request failed"
    )
  }
}

async function resolveOnce(
  workId: string,
  userAgent: string | null | undefined,
  search: () => Promise<SpotifyMatches>,
  deps?: SpotifyMatchStoreDeps
): Promise<SpotifyMatches> {
  if (!isCrawlerUserAgent(userAgent)) {
    const cached = await readDurableWorkMatch(workId, deps)
    if (cached) return cached
  }
  const matches = await search()
  if (!isCrawlerUserAgent(userAgent)) {
    await writeDurableWorkMatch(workId, matches, deps)
  }
  return matches
}

/**
 * Return the stored match for this work and market, or search once and store it.
 * Crawlers never touch the table. Custom deps skip the in-process single-flight map.
 */
export function resolveDurableWorkMatch(
  workId: string,
  userAgent: string | null | undefined,
  search: () => Promise<SpotifyMatches>,
  deps?: SpotifyMatchStoreDeps
): Promise<SpotifyMatches> {
  if (deps || isCrawlerUserAgent(userAgent)) return resolveOnce(workId, userAgent, search, deps)
  const flightKey = `${spotifyMatchMarket()}:${workId}`
  const existing = inflight.get(flightKey)
  if (existing) return existing
  const promise = resolveOnce(workId, userAgent, search).finally(() => {
    if (inflight.get(flightKey) === promise) inflight.delete(flightKey)
  })
  inflight.set(flightKey, promise)
  return promise
}
