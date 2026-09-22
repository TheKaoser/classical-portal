/**
 * Rebuild data/spotify-popularity.json from the Spotify Web API.
 *
 * Uses client credentials (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in the
 * environment or .env.local). Pages read the JSON file and do not call Spotify.
 *
 *   node --experimental-strip-types scripts/refresh-spotify-popularity.ts
 *   node --experimental-strip-types scripts/refresh-spotify-popularity.ts --refresh
 *   node --experimental-strip-types scripts/refresh-spotify-popularity.ts --composer=145
 *   node --experimental-strip-types scripts/refresh-spotify-popularity.ts --limit=20
 *
 * Composers already listed in completedComposers are skipped unless --refresh
 * or --composer is used. A run can be interrupted and started again.
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { openOpusEpochNames } from "../lib/epochs.ts"
import {
  collectWorkPopularities,
  pickComposerArtist,
  spotifyImportance,
  type ArtistCandidate,
  type RankedTrack,
  type RankedWork,
} from "../lib/spotify-rank.ts"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(ROOT, "data/spotify-popularity.json")
const OPEN_OPUS = "https://api.openopus.org"
const TRACK_PAGE_SIZE = 50
const TRACK_PAGES = 4

type Cache = {
  source: string
  generatedAt: string | null
  market: string
  completedComposers: string[]
  composers: Record<string, number>
  works: Record<string, number>
}

type Composer = {
  id: string
  name: string
  complete_name: string
}

type ApiWork = {
  id?: string
  title?: string
  subtitle?: string
  genre?: string
  catalogue?: string
  catalogue_number?: string
  additional_number?: string
}

const SOURCE =
  "Spotify Web API client credentials. Composer score is the max of the matched artist's popularity and the highest popularity of tracks matched to that composer's works. Work score is the max popularity (0-100) of Spotify tracks assigned to the work; album popularity is included when the search payload has it. Ids missing from composers or works were not matched and sort after every scored row. Refresh with: node --experimental-strip-types scripts/refresh-spotify-popularity.ts"

function loadEnvFile(path: string) {
  let text = ""
  try {
    text = readFileSync(path, "utf8")
  } catch {
    return
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === "") process.env[key] = value
  }
}

function argValue(flag: string): string | null {
  const prefix = `${flag}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let nextRequestAt = 0

async function pace() {
  const wait = nextRequestAt - Date.now()
  if (wait > 0) await sleep(wait)
  nextRequestAt = Date.now() + 120
}

type Token = { accessToken: string; expiresAt: number }
let token: Token | null = null

async function getToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt - 60_000) return token.accessToken
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET (environment or .env.local) before refreshing Spotify popularity."
    )
  }
  await pace()
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Spotify token request failed (${res.status}) ${body.slice(0, 180)}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in: number }
  token = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return token.accessToken
}

async function spotifyGet<T>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const access = await getToken()
    await pace()
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${access}` },
    })
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after") || "1")
      const wait = (Number.isFinite(retry) && retry > 0 ? retry : 1) * 1000 + 250
      console.warn(`Spotify rate limit, waiting ${wait}ms`)
      await sleep(wait)
      continue
    }
    if (res.status === 401 && attempt < 3) {
      token = null
      continue
    }
    if (res.status >= 500) {
      await sleep(400 * (attempt + 1))
      continue
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`Spotify ${res.status} ${path.split("?")[0]} ${body.slice(0, 180)}`)
    }
    return (await res.json()) as T
  }
  throw new Error(`Spotify request failed after retries: ${path.split("?")[0]}`)
}

async function openOpusGet<T>(path: string): Promise<T> {
  const url = `${OPEN_OPUS}${path}`
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } })
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return (await res.json()) as T
    } catch (error) {
      lastError = error
      await sleep(400 * (attempt + 1))
    }
  }
  throw lastError
}

function searchPath(type: "artist" | "track", query: string, offset = 0, limit = 10): string {
  const params = new URLSearchParams({
    q: query,
    type,
    limit: String(limit),
    offset: String(offset),
    market: process.env.SPOTIFY_MARKET || "US",
  })
  return `/search?${params.toString()}`
}

function loadCache(): Cache {
  try {
    const parsed = JSON.parse(readFileSync(OUT, "utf8")) as Partial<Cache>
    return {
      source: SOURCE,
      generatedAt: parsed.generatedAt ?? null,
      market: process.env.SPOTIFY_MARKET || parsed.market || "US",
      completedComposers: Array.isArray(parsed.completedComposers)
        ? parsed.completedComposers.map(String)
        : [],
      composers: parsed.composers && typeof parsed.composers === "object" ? parsed.composers : {},
      works: parsed.works && typeof parsed.works === "object" ? parsed.works : {},
    }
  } catch {
    return {
      source: SOURCE,
      generatedAt: null,
      market: process.env.SPOTIFY_MARKET || "US",
      completedComposers: [],
      composers: {},
      works: {},
    }
  }
}

function orderedRecord(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  )
}

function writeCache(cache: Cache) {
  const body: Cache = {
    ...cache,
    source: SOURCE,
    completedComposers: [...cache.completedComposers].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    ),
    composers: orderedRecord(cache.composers),
    works: orderedRecord(cache.works),
  }
  const tmp = `${OUT}.tmp`
  writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`)
  renameSync(tmp, OUT)
}

async function listComposers(): Promise<Composer[]> {
  const byId = new Map<string, Composer>()
  const paths = [
    ...openOpusEpochNames().map((name) => `/composer/list/epoch/${encodeURIComponent(name)}.json`),
    "/composer/list/pop.json",
  ]
  for (const path of paths) {
    const data = await openOpusGet<{ composers?: Composer[] }>(path)
    for (const composer of data.composers ?? []) {
      if (!composer?.id) continue
      byId.set(String(composer.id), {
        id: String(composer.id),
        name: composer.name,
        complete_name: composer.complete_name || composer.name,
      })
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.complete_name.localeCompare(b.complete_name) || a.id.localeCompare(b.id, undefined, { numeric: true })
  )
}

async function listWorks(composerId: string): Promise<RankedWork[]> {
  const data = await openOpusGet<{ works?: ApiWork[] }>(
    `/work/list/composer/${encodeURIComponent(composerId)}/genre/all.json`
  )
  const works: RankedWork[] = []
  for (const work of data.works ?? []) {
    const title = (work.title ?? "").trim()
    if (!work.id || !title) continue
    works.push({
      id: String(work.id),
      title,
      subtitle: work.subtitle?.trim() || "",
      genre: work.genre,
      catalogue: work.catalogue,
      catalogueNumber: work.catalogue_number,
      additionalNumber: work.additional_number,
    })
  }
  return works
}

async function searchArtists(query: string): Promise<ArtistCandidate[]> {
  const data = await spotifyGet<{ artists?: { items?: Array<ArtistCandidate | null> } }>(
    searchPath("artist", query, 0, 10)
  )
  return (data.artists?.items ?? []).filter((artist): artist is ArtistCandidate => Boolean(artist?.id && artist?.name))
}

async function searchTracks(query: string): Promise<RankedTrack[]> {
  const tracks: RankedTrack[] = []
  const seen = new Set<string>()
  for (let page = 0; page < TRACK_PAGES; page += 1) {
    const data = await spotifyGet<{
      tracks?: {
        items?: Array<{
          id?: string
          name?: string
          popularity?: number
          artists?: Array<{ name?: string } | null>
          album?: { name?: string; popularity?: number } | null
        } | null>
      }
    }>(searchPath("track", query, page * TRACK_PAGE_SIZE, TRACK_PAGE_SIZE))
    const items = (data.tracks?.items ?? []).filter((item): item is NonNullable<typeof item> => Boolean(item?.id))
    for (const item of items) {
      if (!item.id || seen.has(item.id)) continue
      seen.add(item.id)
      tracks.push({
        name: item.name ?? "",
        artists: (item.artists ?? [])
          .map((artist) => artist?.name ?? "")
          .filter(Boolean)
          .join(", "),
        album: item.album?.name ?? "",
        popularity: item.popularity ?? Number.NaN,
        albumPopularity: item.album?.popularity,
      })
    }
    if (items.length < TRACK_PAGE_SIZE) break
  }
  return tracks
}

async function scoreComposer(composer: Composer, cache: Cache) {
  const works = await listWorks(composer.id)
  const query = composer.complete_name || composer.name
  let artists = await searchArtists(query)
  let artist = pickComposerArtist(
    { name: composer.name, completeName: composer.complete_name },
    artists
  )
  if (!artist && composer.name && composer.name !== composer.complete_name) {
    artists = await searchArtists(composer.name)
    artist = pickComposerArtist(
      { name: composer.name, completeName: composer.complete_name },
      artists
    )
  }

  const tracks = await searchTracks(query)
  const workScores = collectWorkPopularities(
    { name: composer.name, completeName: composer.complete_name },
    works,
    tracks
  )
  // Commit only after Spotify responds, so a failed request does not wipe scores.
  for (const work of works) delete cache.works[work.id]
  for (const [id, score] of workScores) cache.works[id] = score

  const composerScore = spotifyImportance([artist?.popularity, ...workScores.values()])
  if (composerScore == null) delete cache.composers[composer.id]
  else cache.composers[composer.id] = composerScore

  if (!cache.completedComposers.includes(composer.id)) cache.completedComposers.push(composer.id)
  return { composerScore, works: workScores.size, matchedArtist: Boolean(artist) }
}

async function main() {
  loadEnvFile(join(ROOT, ".env.local"))
  loadEnvFile(join(ROOT, ".env"))

  const refresh = process.argv.includes("--refresh")
  const onlyId = argValue("--composer")
  const limitRaw = argValue("--limit")
  const limit = limitRaw == null ? Number.POSITIVE_INFINITY : Number(limitRaw)
  if (limitRaw != null && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error("--limit must be a positive number")
  }

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    throw new Error(
      "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET (environment or .env.local) before refreshing Spotify popularity."
    )
  }

  const cache = loadCache()
  if (refresh && !onlyId) {
    cache.composers = {}
    cache.works = {}
    cache.completedComposers = []
    cache.generatedAt = null
  }

  const composers = await listComposers()
  const pending = composers.filter((composer) => {
    if (onlyId) return composer.id === onlyId
    if (refresh) return true
    return !cache.completedComposers.includes(composer.id)
  })
  if (onlyId && pending.length === 0) {
    throw new Error(`Open Opus has no composer ${onlyId}`)
  }
  const batch = pending.slice(0, limit)
  if (batch.length === 0) {
    console.log("nothing to score. Pass --refresh to recompute every composer.")
    return
  }
  console.log(
    `Spotify popularity: ${batch.length} composer${batch.length === 1 ? "" : "s"} to score (${composers.length} in the catalog, ${cache.completedComposers.length} already complete)`
  )

  let failed = 0
  let succeeded = 0
  for (let index = 0; index < batch.length; index += 1) {
    const composer = batch[index]
    const label = composer.complete_name || composer.name
    try {
      const result = await scoreComposer(composer, cache)
      succeeded += 1
      writeCache(cache)
      console.log(
        `${index + 1}/${batch.length} ${label}: composer ${result.composerScore ?? "—"} (${result.matchedArtist ? "artist" : "no artist"}), ${result.works} works`
      )
    } catch (error) {
      failed += 1
      console.warn(`${index + 1}/${batch.length} ${label}: FAILED`, error)
    }
  }

  if (succeeded === 0) {
    console.warn("no scores written; existing cache left in place")
  } else {
    const done = composers.every((composer) => cache.completedComposers.includes(composer.id))
    if (done && failed === 0) cache.generatedAt = new Date().toISOString()
    writeCache(cache)
  }
  console.log(
    `done scored=${batch.length - failed} failed=${failed} composers=${Object.keys(cache.composers).length} works=${Object.keys(cache.works).length}`
  )
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
