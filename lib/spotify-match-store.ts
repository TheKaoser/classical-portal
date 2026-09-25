import postgres from "postgres"
import { isCrawlerUserAgent } from "./crawler.ts"
import {
  isSpotifyConfigured,
  isSpotifyOAuthConfigured,
  type SpotifyMatches,
  type SpotifyRecording,
} from "./spotify-model.ts"

/** Empty catalog searches are retried after this. Positive matches do not expire. */
export const SPOTIFY_WORK_MATCH_NEGATIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const REQUEST_TIMEOUT_SECONDS = 5

/**
 * Reference copy: db/spotify_work_matches.sql.
 * Run once per database client. CREATE TABLE IF NOT EXISTS is idempotent.
 */
export const SPOTIFY_WORK_MATCH_SCHEMA_SQL = `create table if not exists public.spotify_work_matches (
  work_id text not null,
  market text not null,
  negative boolean not null,
  recordings jsonb not null,
  query text not null default '',
  search_url text not null default '',
  stored_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint spotify_work_matches_pkey primary key (work_id, market),
  constraint spotify_work_matches_expiry_ck check (
    (negative = false and expires_at is null)
    or (negative = true and expires_at is not null)
  )
)`

const READ_SQL = `select recordings, query, search_url, expires_at
from public.spotify_work_matches
where work_id = $1 and market = $2
limit 1`

const WRITE_SQL = `insert into public.spotify_work_matches (
  work_id, market, negative, recordings, query, search_url, stored_at, expires_at
) values (
  $1, $2, $3, $4::jsonb, $5, $6, $7::timestamptz, $8::timestamptz
)
on conflict (work_id, market) do update set
  negative = excluded.negative,
  recordings = excluded.recordings,
  query = excluded.query,
  search_url = excluded.search_url,
  stored_at = excluded.stored_at,
  expires_at = excluded.expires_at`

export type SqlQuery = (text: string, params?: readonly unknown[]) => Promise<readonly Record<string, unknown>[]>

export type SqlExecutor = {
  query: SqlQuery
}

export type SpotifyMatchStoreDeps = {
  /** Injected database. Used only when a postgres:// URL is configured. */
  db?: SqlExecutor
  now?: () => number
  env?: {
    postgresUrl?: string
    market?: string
  }
}

type StoreConfig = {
  market: string
  db: SqlExecutor
}

type MatchRow = {
  recordings: SpotifyRecording[]
  query: string
  search_url: string
  expires_at: string | null
}

type PostgresEnv = {
  STORAGE_CLASSICAL_POSTGRES_URL?: string
  STORAGE_CLASSICAL_DATABASE_URL?: string
  [key: string]: string | undefined
}

const inflight = new Map<string, Promise<SpotifyMatches>>()
const schemaReady = new WeakMap<SqlExecutor, Promise<void>>()
const executors = new Map<string, SqlExecutor>()
let unconfiguredWarned = false

/** Market used for both the Spotify request and the durable row. */
export function spotifyMatchMarket(deps?: SpotifyMatchStoreDeps): string {
  const fromDeps = deps?.env
  const raw = (fromDeps ? fromDeps.market : process.env.SPOTIFY_MARKET) ?? "US"
  const market = raw.trim().toUpperCase()
  return market || "US"
}

/**
 * Direct postgres URL for the durable cache.
 * Prefers STORAGE_CLASSICAL_POSTGRES_URL, then STORAGE_CLASSICAL_DATABASE_URL.
 * Prisma Accelerate (prisma://) and any other scheme are ignored.
 */
export function spotifyMatchPostgresUrl(env: PostgresEnv = process.env): string {
  return (
    postgresUrlFrom(env.STORAGE_CLASSICAL_POSTGRES_URL) ||
    postgresUrlFrom(env.STORAGE_CLASSICAL_DATABASE_URL)
  )
}

function postgresUrlFrom(value: string | undefined): string {
  const url = (value ?? "").trim()
  if (!/^postgres(ql)?:\/\//i.test(url)) return ""
  return url
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

function configuredPostgresUrl(deps?: SpotifyMatchStoreDeps): string {
  if (deps?.env) return postgresUrlFrom(deps.env.postgresUrl)
  return spotifyMatchPostgresUrl()
}

function openStore(deps?: SpotifyMatchStoreDeps): StoreConfig | "unconfigured" | "unavailable" {
  const url = configuredPostgresUrl(deps)
  if (!url) return "unconfigured"
  if (deps?.db) return { market: spotifyMatchMarket(deps), db: deps.db }
  try {
    return { market: spotifyMatchMarket(deps), db: getExecutor(url) }
  } catch (error) {
    console.error("Spotify work-match store client failed", safeError(error))
    return "unavailable"
  }
}

function getExecutor(url: string): SqlExecutor {
  const existing = executors.get(url)
  if (existing) return existing
  const sql = postgres(url, clientOptions(url))
  const executor: SqlExecutor = {
    query: async (text, params = []) => {
      const rows = await sql.unsafe(text, params as never[])
      return rows as readonly Record<string, unknown>[]
    },
  }
  executors.set(url, executor)
  return executor
}

function clientOptions(url: string): postgres.Options<Record<string, postgres.PostgresType>> {
  const options: postgres.Options<Record<string, postgres.PostgresType>> = {
    max: 1,
    idle_timeout: 20,
    connect_timeout: REQUEST_TIMEOUT_SECONDS,
    max_lifetime: 60 * 30,
    prepare: false,
    fetch_types: false,
    onnotice: () => {},
    connection: {
      statement_timeout: REQUEST_TIMEOUT_SECONDS * 1000,
    },
  }
  if (remoteHostRequiresSsl(url)) options.ssl = "require"
  return options
}

function remoteHostRequiresSsl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.searchParams.get("sslmode")) return false
    const host = parsed.hostname
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1"
  } catch {
    return false
  }
}

function noteUnconfigured(): void {
  if (unconfiguredWarned) return
  unconfiguredWarned = true
  console.warn(
    "Spotify work matches are not stored durably. Set STORAGE_CLASSICAL_POSTGRES_URL or STORAGE_CLASSICAL_DATABASE_URL (postgres://). Searches still use the Next.js data cache."
  )
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "request failed"
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]").slice(0, 300)
}

function ensureSchema(db: SqlExecutor): Promise<void> {
  const existing = schemaReady.get(db)
  if (existing) return existing
  const pending = db
    .query(SPOTIFY_WORK_MATCH_SCHEMA_SQL)
    .then(() => undefined)
    .catch((error: unknown) => {
      if (schemaReady.get(db) === pending) schemaReady.delete(db)
      throw error
    })
  schemaReady.set(db, pending)
  return pending
}

function asIsoTimestamp(value: unknown): string | null | undefined {
  if (value == null) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
  }
  if (typeof value === "string") return value
  return undefined
}

function recordingsFromColumn(value: unknown): SpotifyRecording[] | null {
  let parsed = value
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return null
    }
  }
  return Array.isArray(parsed) ? (parsed as SpotifyRecording[]) : null
}

function matchesFromRow(row: Record<string, unknown>, now: number): SpotifyMatches | null {
  const expiresAt = asIsoTimestamp(row.expires_at)
  if (expiresAt === undefined) return null
  if (!isDurableRowFresh(expiresAt, now)) return null
  const recordings = recordingsFromColumn(row.recordings)
  if (!recordings) return null
  return {
    configured: isSpotifyConfigured(),
    oauthConfigured: isSpotifyOAuthConfigured(),
    query: typeof row.query === "string" ? row.query : "",
    searchUrl: typeof row.search_url === "string" ? row.search_url : "",
    recordings,
  }
}

/** Read a non-expired work match. Failures are misses so playback can still search. */
export async function readDurableWorkMatch(
  workId: string,
  deps?: SpotifyMatchStoreDeps
): Promise<SpotifyMatches | null> {
  const config = openStore(deps)
  if (config === "unconfigured") {
    noteUnconfigured()
    return null
  }
  if (config === "unavailable") return null
  try {
    await ensureSchema(config.db)
    const rows = await config.db.query(READ_SQL, [workId, config.market])
    const row = rows[0]
    if (!row) return null
    return matchesFromRow(row, deps?.now?.() ?? Date.now())
  } catch (error) {
    console.error("Spotify work-match store read failed", safeError(error))
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
  const config = openStore(deps)
  if (config === "unconfigured" || config === "unavailable") {
    if (config === "unconfigured" && durableMatchKind(matches)) noteUnconfigured()
    return
  }
  const row = durableRowFromMatch(workId, config.market, matches, now)
  if (!row) return
  try {
    await ensureSchema(config.db)
    await config.db.query(WRITE_SQL, [
      row.work_id,
      row.market,
      row.negative,
      JSON.stringify(row.recordings),
      row.query,
      row.search_url,
      row.stored_at,
      row.expires_at,
    ])
  } catch (error) {
    console.error("Spotify work-match store write failed", safeError(error))
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
 * With no Postgres URL, search() still runs and the Next.js data cache inside it applies.
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
