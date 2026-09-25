import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import type { SpotifyMatches, SpotifyRecording } from "./spotify-model.ts"
import {
  durableMatchKind,
  durableRowFromMatch,
  isDurableRowFresh,
  resolveDurableWorkMatch,
  SPOTIFY_WORK_MATCH_NEGATIVE_TTL_MS,
  SPOTIFY_WORK_MATCH_SCHEMA_SQL,
  spotifyMatchPostgresUrl,
  type SpotifyMatchStoreDeps,
  type SqlExecutor,
} from "./spotify-match-store.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const NOW = Date.parse("2026-09-25T00:00:00.000Z")
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

const recording: SpotifyRecording = {
  id: "album-1",
  album: "Nocturnes",
  albumId: "album-1",
  image: null,
  artists: "Arthur Rubinstein",
  tracks: [],
}

type Call = { text: string; params: readonly unknown[] }

function positive(): SpotifyMatches {
  return {
    configured: true,
    oauthConfigured: false,
    query: "Frédéric Chopin op 9",
    searchUrl: "https://open.spotify.com/search/chopin",
    recordings: [recording],
  }
}

function negative(): SpotifyMatches {
  return { ...positive(), recordings: [] }
}

function isSchema(call: Call): boolean {
  return /create table/i.test(call.text)
}

function isRead(call: Call): boolean {
  return /^\s*select/i.test(call.text)
}

function mockDb(
  handler: (call: Call) => readonly Record<string, unknown>[] | Promise<readonly Record<string, unknown>[]>
): SqlExecutor & { calls: Call[] } {
  const calls: Call[] = []
  return {
    calls,
    query: async (text, params = []) => {
      const call = { text, params }
      calls.push(call)
      return handler(call)
    },
  }
}

function deps(db: SqlExecutor, market = "es"): SpotifyMatchStoreDeps {
  return {
    now: () => NOW,
    env: {
      postgresUrl: "postgres://portal.example/classical",
      market,
    },
    db,
  }
}

test("only a finished catalog search is durable", () => {
  assert.equal(durableMatchKind(positive()), "positive")
  assert.equal(durableMatchKind(negative()), "negative")
  assert.equal(durableMatchKind({ ...negative(), configured: false }), null)
  assert.equal(durableMatchKind({ ...negative(), unavailable: true }), null)
  assert.equal(durableMatchKind({ ...negative(), skipped: "crawler" }), null)
  assert.equal(durableMatchKind({ ...positive(), unavailable: true }), null)
})

test("positive rows never expire and negative rows last seven days", () => {
  assert.equal(SPOTIFY_WORK_MATCH_NEGATIVE_TTL_MS, 7 * 24 * 60 * 60 * 1000)
  const storedPositive = durableRowFromMatch("17109", "ES", positive(), NOW)
  const storedNegative = durableRowFromMatch("17109", "ES", negative(), NOW)
  assert.equal(storedPositive?.expires_at, null)
  assert.equal(storedPositive?.negative, false)
  assert.equal(storedNegative?.negative, true)
  assert.equal(storedNegative?.expires_at, new Date(NOW + SPOTIFY_WORK_MATCH_NEGATIVE_TTL_MS).toISOString())
  assert.equal(durableRowFromMatch("17109", "ES", { ...negative(), unavailable: true }, NOW), null)
  assert.equal(isDurableRowFresh(null, NOW), true)
  assert.equal(isDurableRowFresh(storedNegative?.expires_at, NOW + SPOTIFY_WORK_MATCH_NEGATIVE_TTL_MS), false)
  assert.equal(isDurableRowFresh(storedNegative?.expires_at, NOW + SPOTIFY_WORK_MATCH_NEGATIVE_TTL_MS - 1), true)
})

test("the postgres url prefers the direct connection and ignores Prisma Accelerate", () => {
  assert.equal(
    spotifyMatchPostgresUrl({
      STORAGE_CLASSICAL_POSTGRES_URL: " postgres://preferred/db ",
      STORAGE_CLASSICAL_DATABASE_URL: "postgres://fallback/db",
    }),
    "postgres://preferred/db"
  )
  assert.equal(
    spotifyMatchPostgresUrl({
      STORAGE_CLASSICAL_POSTGRES_URL: "prisma://accelerate",
      STORAGE_CLASSICAL_DATABASE_URL: "postgresql://fallback/db",
    }),
    "postgresql://fallback/db"
  )
  assert.equal(
    spotifyMatchPostgresUrl({
      STORAGE_CLASSICAL_DATABASE_URL: "prisma://accelerate",
    }),
    ""
  )
})

test("a stored positive match is reused and Spotify is not searched", async () => {
  let searches = 0
  const db = mockDb(async (call) => {
    if (isSchema(call)) return []
    assert.equal(isRead(call), true)
    assert.deepEqual(call.params, ["17109", "ES"])
    return [
      {
        recordings: [recording],
        query: "Frédéric Chopin op 9",
        search_url: "https://open.spotify.com/search/chopin",
        expires_at: null,
      },
    ]
  })
  const match = await resolveDurableWorkMatch(
    "17109",
    "Mozilla/5.0 Chrome/120",
    async () => {
      searches += 1
      throw new Error("Spotify should not be called")
    },
    deps(db)
  )
  assert.equal(searches, 0)
  assert.equal(match.recordings[0]?.album, "Nocturnes")
  assert.equal(match.query, "Frédéric Chopin op 9")
  assert.equal(db.calls.filter(isSchema).length, 1)
  assert.equal(db.calls.filter(isRead).length, 1)
})

test("an unexpired negative match is reused", async () => {
  let searches = 0
  const match = await resolveDurableWorkMatch(
    "neg-fresh",
    null,
    async () => {
      searches += 1
      return positive()
    },
    deps(
      mockDb(async (call) => {
        if (isSchema(call) || !isRead(call)) return []
        return [
          {
            recordings: [],
            query: "saved query",
            search_url: "https://open.spotify.com/search/saved",
            expires_at: new Date(NOW + 60_000).toISOString(),
          },
        ]
      })
    )
  )
  assert.equal(searches, 0)
  assert.equal(match.recordings.length, 0)
  assert.equal(match.query, "saved query")
})

test("an expired negative is searched again and stored for another seven days", async () => {
  const calls: Call[] = []
  const match = await resolveDurableWorkMatch(
    "neg-stale",
    null,
    async () => negative(),
    deps(
      mockDb(async (call) => {
        calls.push(call)
        if (!isRead(call)) return []
        return [
          {
            recordings: [],
            query: "old",
            search_url: "https://open.spotify.com/search/old",
            expires_at: "2020-01-01T00:00:00.000Z",
          },
        ]
      })
    )
  )
  const dataCalls = calls.filter((call) => !isSchema(call))
  assert.equal(match.recordings.length, 0)
  assert.equal(dataCalls.length, 2)
  assert.equal(isRead(dataCalls[0]!), true)
  const write = dataCalls[1]!
  assert.match(write.text, /on conflict \(work_id, market\)/i)
  assert.equal(write.params[0], "neg-stale")
  assert.equal(write.params[1], "ES")
  assert.equal(write.params[2], true)
  assert.equal(write.params[6], "2026-09-25T00:00:00.000Z")
  assert.equal(write.params[7], new Date(NOW + SPOTIFY_WORK_MATCH_NEGATIVE_TTL_MS).toISOString())
  assert.equal(calls.filter(isSchema).length, 1)
})

test("a positive match is upserted with no expiry", async () => {
  const saved: { params: readonly unknown[] | null } = { params: null }
  await resolveDurableWorkMatch(
    "pos-new",
    null,
    async () => positive(),
    deps(
      mockDb(async (call) => {
        if (!isRead(call) && !isSchema(call)) saved.params = call.params
        return []
      }),
      "ES"
    )
  )
  assert.ok(saved.params)
  assert.equal(saved.params[0], "pos-new")
  assert.equal(saved.params[1], "ES")
  assert.equal(saved.params[2], false)
  assert.equal(saved.params[4], "Frédéric Chopin op 9")
  assert.equal(saved.params[5], "https://open.spotify.com/search/chopin")
  assert.equal(saved.params[6], "2026-09-25T00:00:00.000Z")
  assert.equal(saved.params[7], null)
  assert.equal(JSON.parse(String(saved.params[3]))[0]?.id, "album-1")
})

test("quota, crawler, and unconfigured results are not stored", async () => {
  for (const [id, userAgent, matches] of [
    ["quota", null, { ...negative(), unavailable: true }],
    ["crawler", GOOGLEBOT, { ...negative(), skipped: "crawler" as const }],
    ["missing", null, { ...negative(), configured: false }],
  ] as const) {
    let writes = 0
    let queries = 0
    await resolveDurableWorkMatch(
      id,
      userAgent,
      async () => matches,
      deps(
        mockDb(async (call) => {
          queries += 1
          if (!isSchema(call) && !isRead(call)) writes += 1
          return []
        })
      )
    )
    assert.equal(writes, 0, id)
    if (userAgent === GOOGLEBOT) assert.equal(queries, 0, id)
  }
})

test("a store outage still returns the live search", async () => {
  const match = await resolveDurableWorkMatch(
    "outage",
    null,
    async () => positive(),
    deps({
      query: async () => {
        throw new Error("connection refused at postgres://user:secret@db.example/classical")
      },
    })
  )
  assert.equal(match.recordings.length, 1)
})

test("a failed table create is retried instead of disabling the client", async () => {
  let creates = 0
  let writes = 0
  const db = mockDb(async (call) => {
    if (isSchema(call)) {
      creates += 1
      if (creates === 1) throw new Error("timeout")
      return []
    }
    if (!isRead(call)) writes += 1
    return []
  })
  const match = await resolveDurableWorkMatch("retry", null, async () => positive(), deps(db))
  assert.equal(match.recordings.length, 1)
  assert.equal(creates, 2)
  assert.equal(writes, 1)
})

test("without a postgres url the search still runs and nothing is stored", async () => {
  let queries = 0
  const match = await resolveDurableWorkMatch("plain", null, async () => positive(), {
    now: () => NOW,
    env: {},
    db: {
      query: async () => {
        queries += 1
        return []
      },
    },
  })
  assert.equal(queries, 0)
  assert.equal(match.query, "Frédéric Chopin op 9")
})

test("the same client creates the table once", async () => {
  const db = mockDb(async () => [])
  const options = deps(db)
  await resolveDurableWorkMatch("one", null, async () => positive(), options)
  await resolveDurableWorkMatch("two", null, async () => positive(), options)
  assert.equal(db.calls.filter(isSchema).length, 1)
  assert.equal(db.calls.filter((call) => !isSchema(call) && !isRead(call)).length, 2)
})

test("the match table sql matches the store and does not use Supabase", () => {
  const sql = readFileSync(join(root, "db/spotify_work_matches.sql"), "utf8")
  const statement = sql.slice(sql.indexOf("create table if not exists")).split(";")[0]?.trim()
  assert.equal(statement, SPOTIFY_WORK_MATCH_SCHEMA_SQL)
  assert.match(sql, /primary key \(work_id, market\)/)
  assert.match(sql, /negative = false and expires_at is null/)
  assert.match(sql, /delete from public\.spotify_work_matches/)
  const store = readFileSync(join(root, "lib/spotify-match-store.ts"), "utf8")
  assert.match(store, /STORAGE_CLASSICAL_POSTGRES_URL/)
  assert.match(store, /STORAGE_CLASSICAL_DATABASE_URL/)
  assert.equal(store.includes("SUPABASE"), false)
  assert.equal(store.includes("ANON_KEY"), false)
  assert.equal(store.includes("PRISMA_DATABASE_URL"), false)
  assert.equal(store.includes("NEXT_PUBLIC_SUPABASE"), false)
  const matcher = readFileSync(join(root, "lib/work-spotify.ts"), "utf8")
  assert.match(matcher, /resolveDurableWorkMatch/)
})
