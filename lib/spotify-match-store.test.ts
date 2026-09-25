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
  type SpotifyMatchStoreDeps,
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

function deps(
  fetchImpl: typeof fetch,
  market = "es"
): SpotifyMatchStoreDeps {
  return {
    now: () => NOW,
    env: {
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "service-role",
      market,
    },
    fetch: fetchImpl,
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

test("a stored positive match is reused and Spotify is not searched", async () => {
  let searches = 0
  const match = await resolveDurableWorkMatch(
    "17109",
    "Mozilla/5.0 Chrome/120",
    async () => {
      searches += 1
      throw new Error("Spotify should not be called")
    },
    deps(async (input, init) => {
      const url = new URL(String(input))
      assert.equal(url.pathname, "/rest/v1/spotify_work_matches")
      assert.equal(url.searchParams.get("work_id"), "eq.17109")
      assert.equal(url.searchParams.get("market"), "eq.ES")
      assert.equal(init?.method ?? "GET", "GET")
      const headers = new Headers(init?.headers)
      assert.equal(headers.get("apikey"), "service-role")
      assert.equal(headers.get("authorization"), "Bearer service-role")
      return Response.json([
        {
          recordings: [recording],
          query: "Frédéric Chopin op 9",
          search_url: "https://open.spotify.com/search/chopin",
          expires_at: null,
        },
      ])
    })
  )
  assert.equal(searches, 0)
  assert.equal(match.recordings[0]?.album, "Nocturnes")
  assert.equal(match.query, "Frédéric Chopin op 9")
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
    deps(async () =>
      Response.json([
        {
          recordings: [],
          query: "saved query",
          search_url: "https://open.spotify.com/search/saved",
          expires_at: new Date(NOW + 60_000).toISOString(),
        },
      ])
    )
  )
  assert.equal(searches, 0)
  assert.equal(match.recordings.length, 0)
  assert.equal(match.query, "saved query")
})

test("an expired negative is searched again and stored for another seven days", async () => {
  const calls: { method: string; body: Record<string, unknown> | null }[] = []
  const match = await resolveDurableWorkMatch(
    "neg-stale",
    null,
    async () => negative(),
    deps(async (input, init) => {
      const method = init?.method ?? "GET"
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
      calls.push({ method, body })
      if (method === "GET") {
        return Response.json([
          {
            recordings: [],
            query: "old",
            search_url: "https://open.spotify.com/search/old",
            expires_at: "2020-01-01T00:00:00.000Z",
          },
        ])
      }
      const url = new URL(String(input))
      assert.equal(url.searchParams.get("on_conflict"), "work_id,market")
      const headers = new Headers(init?.headers)
      assert.equal(headers.get("prefer"), "resolution=merge-duplicates,return=minimal")
      return new Response(null, { status: 201 })
    })
  )
  assert.equal(match.recordings.length, 0)
  assert.equal(calls.length, 2)
  assert.equal(calls[1]?.method, "POST")
  assert.equal(calls[1]?.body?.negative, true)
  assert.equal(calls[1]?.body?.expires_at, new Date(NOW + SPOTIFY_WORK_MATCH_NEGATIVE_TTL_MS).toISOString())
  assert.equal(calls[1]?.body?.market, "ES")
})

test("a positive match is upserted with no expiry", async () => {
  const saved: { body: Record<string, unknown> | null } = { body: null }
  await resolveDurableWorkMatch(
    "pos-new",
    null,
    async () => positive(),
    deps(async (_input, init) => {
      if ((init?.method ?? "GET") === "GET") return Response.json([])
      saved.body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(null, { status: 201 })
    }, "ES")
  )
  assert.equal(saved.body?.work_id, "pos-new")
  assert.equal(saved.body?.negative, false)
  assert.equal(saved.body?.expires_at, null)
  assert.equal(saved.body?.stored_at, "2026-09-25T00:00:00.000Z")
  assert.equal((saved.body?.recordings as SpotifyRecording[])[0]?.id, "album-1")
})

test("quota, crawler, and unconfigured results are not stored", async () => {
  for (const [id, userAgent, matches] of [
    ["quota", null, { ...negative(), unavailable: true }],
    ["crawler", GOOGLEBOT, { ...negative(), skipped: "crawler" as const }],
    ["missing", null, { ...negative(), configured: false }],
  ] as const) {
    let writes = 0
    let fetches = 0
    await resolveDurableWorkMatch(
      id,
      userAgent,
      async () => matches,
      deps(async (_input, init) => {
        fetches += 1
        if ((init?.method ?? "GET") === "POST") writes += 1
        return Response.json([])
      })
    )
    assert.equal(writes, 0, id)
    if (userAgent === GOOGLEBOT) assert.equal(fetches, 0, id)
  }
})

test("a store outage still returns the live search", async () => {
  const match = await resolveDurableWorkMatch(
    "outage",
    null,
    async () => positive(),
    deps(async (_input, init) => {
      if ((init?.method ?? "GET") === "GET") return new Response("no", { status: 500 })
      return new Response("no", { status: 500 })
    })
  )
  assert.equal(match.recordings.length, 1)
})

test("without Supabase credentials the search still runs and nothing is stored", async () => {
  let fetches = 0
  const match = await resolveDurableWorkMatch("plain", null, async () => positive(), {
    now: () => NOW,
    env: {},
    fetch: async () => {
      fetches += 1
      return Response.json([])
    },
  })
  assert.equal(fetches, 0)
  assert.equal(match.query, "Frédéric Chopin op 9")
})

test("the match table is locked to the service role", () => {
  const sql = readFileSync(join(root, "supabase/spotify_work_matches.sql"), "utf8")
  assert.match(sql, /primary key \(work_id, market\)/)
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on table public\.spotify_work_matches from public, anon, authenticated/)
  assert.match(sql, /grant select, insert, update, delete on table public\.spotify_work_matches to service_role/)
  assert.match(sql, /negative = false and expires_at is null/)
  const store = readFileSync(join(root, "lib/spotify-match-store.ts"), "utf8")
  assert.match(store, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.equal(store.includes("ANON_KEY"), false)
  const matcher = readFileSync(join(root, "lib/work-spotify.ts"), "utf8")
  assert.match(matcher, /resolveDurableWorkMatch/)
})
