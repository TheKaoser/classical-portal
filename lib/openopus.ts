import { unstable_cache } from "next/cache"
import {
  compareWorksByPopularity,
  dedupeWorks,
  isFlagged,
  isPopular,
  popularityRank,
  sortComposersByImportance,
} from "@/lib/popularity"

export {
  compareWorksByPopularity,
  dedupeWorks,
  isFlagged,
  isPopular,
  popularityRank,
}

const OPEN_OPUS_BASE = "https://api.openopus.org"

export type OpenOpusComposer = {
  id: string
  name: string
  complete_name: string
  birth: string | null
  death: string | null
  epoch: string
  portrait?: string
}

export type OpenOpusWorkPart = string | { title?: string; name?: string }

export type OpenOpusWork = {
  id: string
  title: string
  subtitle?: string
  genre: string
  popular?: string | number
  recommended?: string | number
  searchterms?: string | string[]
  catalogue?: string
  catalogue_number?: string
  additional_number?: string
}

export type OpenOpusWorkDetail = OpenOpusWork & {
  searchmode?: string
  parts?: OpenOpusWorkPart[]
  movements?: OpenOpusWorkPart[]
}

export type OmniSearchHit = {
  composer: OpenOpusComposer
  work: OpenOpusWork | null
}

type Status = {
  success?: string | boolean
  rows?: number
  version?: string
}

function isSuccess(status?: Status): boolean {
  return status?.success === true || status?.success === "true"
}

function normalizeWork<T extends OpenOpusWork>(work: T): T {
  return {
    ...work,
    title: (work.title ?? "").trim(),
    subtitle: work.subtitle?.trim() ? work.subtitle.trim() : "",
  }
}

async function openOpusGet<T>(path: string, revalidate = 3600): Promise<T> {
  const url = `${OPEN_OPUS_BASE}${path}`
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate, tags: ["openopus"] },
  })

  if (!res.ok) {
    throw new Error(`Open Opus request failed (${res.status}) for ${path}`)
  }

  return (await res.json()) as T
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value)
}

export function lifeSpan(composer: Pick<OpenOpusComposer, "birth" | "death">): string | null {
  const year = (value: string | null) => (value ? value.slice(0, 4) : null)
  const birth = year(composer.birth)
  const death = year(composer.death)
  if (!birth) return null
  return death ? `${birth}–${death}` : `b. ${birth}`
}

export async function listPopularComposers(): Promise<OpenOpusComposer[]> {
  const data = await openOpusGet<{ status: Status; composers?: OpenOpusComposer[] }>(
    "/composer/list/pop.json"
  )
  return isSuccess(data.status) ? data.composers ?? [] : []
}

export async function listEssentialComposers(): Promise<OpenOpusComposer[]> {
  const data = await openOpusGet<{ status: Status; composers?: OpenOpusComposer[] }>(
    "/composer/list/rec.json"
  )
  return isSuccess(data.status) ? data.composers ?? [] : []
}

function composerSortName(composer: OpenOpusComposer): string {
  return composer.complete_name || composer.name
}

/**
 * Open Opus list payloads have no composer `popular` flag or numeric rank.
 * Period (and other) composer lists use three importance tiers:
 * 1. `/composer/list/pop.json`
 * 2. `/composer/list/rec.json` but not pop
 * 3. everyone else
 * Alphabetical by `complete_name` within each tier.
 * Work lists stay on the unified Popular flag; this sorter is composers only.
 */
export function sortComposersByPopularity(
  composers: OpenOpusComposer[],
  popularIds: Set<string>,
  essentialIds: Set<string>
): OpenOpusComposer[] {
  return sortComposersByImportance(composers, popularIds, essentialIds)
}

/** `/composer/list/pop.json`, ranked with the same importance tiers as period lists. */
export async function listRankedPopularComposers(): Promise<OpenOpusComposer[]> {
  const [popular, essential] = await Promise.all([listPopularComposers(), listEssentialComposers()])
  return sortComposersByPopularity(
    popular,
    new Set(popular.map((composer) => composer.id)),
    new Set(essential.map((composer) => composer.id))
  )
}

export async function listComposersByEpoch(epochName: string): Promise<OpenOpusComposer[]> {
  const [data, popular, essential] = await Promise.all([
    openOpusGet<{ status: Status; composers?: OpenOpusComposer[] }>(
      `/composer/list/epoch/${encodePathSegment(epochName)}.json`
    ),
    listPopularComposers(),
    listEssentialComposers(),
  ])
  const composers = isSuccess(data.status) ? data.composers ?? [] : []
  return sortComposersByPopularity(
    composers,
    new Set(popular.map((composer) => composer.id)),
    new Set(essential.map((composer) => composer.id))
  )
}

export async function getComposer(id: string): Promise<OpenOpusComposer | null> {
  const data = await openOpusGet<{ status: Status; composers?: OpenOpusComposer[] }>(
    `/composer/list/ids/${encodePathSegment(id)}.json`
  )
  if (!isSuccess(data.status) || !data.composers?.length) return null
  return data.composers[0]
}

export async function listWorksByComposer(composerId: string): Promise<{
  composer: OpenOpusComposer | null
  works: OpenOpusWork[]
}> {
  return listWorksByComposerGenre(composerId, "all")
}

export async function listWorksByComposerGenre(
  composerId: string,
  genre: string
): Promise<{
  composer: OpenOpusComposer | null
  works: OpenOpusWork[]
}> {
  const data = await openOpusGet<{
    status: Status
    composer?: OpenOpusComposer
    works?: OpenOpusWork[]
  }>(`/work/list/composer/${encodePathSegment(composerId)}/genre/${encodePathSegment(genre)}.json`)

  if (!isSuccess(data.status)) {
    return { composer: data.composer ?? null, works: [] }
  }

  return { composer: data.composer ?? null, works: (data.works ?? []).map(normalizeWork) }
}

export async function getWork(id: string): Promise<{
  composer: Pick<OpenOpusComposer, "id" | "name" | "complete_name" | "epoch"> | null
  work: OpenOpusWorkDetail | null
}> {
  const data = await openOpusGet<{
    status: Status
    composer?: Pick<OpenOpusComposer, "id" | "name" | "complete_name" | "epoch">
    work?: OpenOpusWorkDetail
  }>(`/work/detail/${encodePathSegment(id)}.json`, 3600)

  if (!isSuccess(data.status) || !data.work) {
    return { composer: data.composer ?? null, work: null }
  }

  return { composer: data.composer ?? null, work: normalizeWork(data.work) }
}

export async function omniSearch(query: string, offset = 0): Promise<OmniSearchHit[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const data = await openOpusGet<{ status: Status; results?: OmniSearchHit[] }>(
    `/omnisearch/${encodePathSegment(trimmed)}/${offset}.json`,
    120
  )

  return isSuccess(data.status)
    ? (data.results ?? []).map((hit) => ({
        composer: hit.composer,
        work: hit.work ? normalizeWork(hit.work) : null,
      }))
    : []
}

export function workSearchTerms(work: Pick<OpenOpusWork, "searchterms">): string[] {
  if (!work.searchterms) return []
  return (Array.isArray(work.searchterms) ? work.searchterms : [work.searchterms])
    .map((term) => term.trim())
    .filter(Boolean)
}

export function workParts(work: Pick<OpenOpusWorkDetail, "parts" | "movements">): string[] {
  const raw = work.parts ?? work.movements ?? []
  return raw
    .map((part) => (typeof part === "string" ? part : part.title || part.name || ""))
    .map((part) => part.trim())
    .filter(Boolean)
}

export const workPopularityRank = popularityRank

export function groupWorksByGenre(works: OpenOpusWork[]): { genre: string; works: OpenOpusWork[] }[] {
  const groups = new Map<string, OpenOpusWork[]>()

  for (const work of works) {
    const genre = work.genre || "Other"
    const list = groups.get(genre) ?? []
    list.push(work)
    groups.set(genre, list)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([genre, list]) => ({
      genre,
      works: list.sort(compareWorksByPopularity),
    }))
}

export const WORK_GENRES = ["Chamber", "Keyboard", "Orchestral", "Stage", "Vocal"] as const

export type WorkGenre = (typeof WORK_GENRES)[number]

export function genreSlug(name: string): string {
  return name.toLowerCase()
}

export function genreFromSlug(slug: string): WorkGenre | undefined {
  const decoded = decodeURIComponent(slug).toLowerCase()
  return WORK_GENRES.find((genre) => genreSlug(genre) === decoded)
}

export function genreHref(name: string): string {
  return `/genres/${genreSlug(name)}`
}

export type GenreSummary = {
  name: WorkGenre
  slug: string
  popularCount: number
  recommendedCount: number
  workCount: number
}

type DumpWork = {
  title: string
  subtitle?: string
  popular?: string | number
  recommended?: string | number
  genre: string
}

type DumpComposer = {
  name: string
  complete_name: string
  works?: DumpWork[]
}

async function fetchWorkDump(): Promise<DumpComposer[]> {
  // Dump is ~4MB; Next's data cache rejects payloads over 2MB, so we
  // fetch uncached and keep only a small summary in unstable_cache.
  const res = await fetch(`${OPEN_OPUS_BASE}/work/dump.json`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Open Opus request failed (${res.status}) for /work/dump.json`)
  }
  const data = (await res.json()) as { status: Status; composers?: DumpComposer[] }
  return isSuccess(data.status) ? data.composers ?? [] : []
}

type DumpSummary = {
  genres: GenreSummary[]
  rankedComposerNames: Record<WorkGenre, string[]>
}

async function buildDumpSummary(): Promise<DumpSummary> {
  const emptyNames = Object.fromEntries(WORK_GENRES.map((name) => [name, [] as string[]])) as Record<
    WorkGenre,
    string[]
  >
  const emptyGenres: GenreSummary[] = WORK_GENRES.map((name) => ({
    name,
    slug: genreSlug(name),
    popularCount: 0,
    recommendedCount: 0,
    workCount: 0,
  }))

  let dump: DumpComposer[] = []
  try {
    dump = await fetchWorkDump()
  } catch {
    return { genres: emptyGenres, rankedComposerNames: emptyNames }
  }

  const stats = Object.fromEntries(
    WORK_GENRES.map((name) => [name, { popular: 0, recommended: 0, total: 0 }])
  ) as Record<WorkGenre, { popular: number; recommended: number; total: number }>
  const rankedNames = Object.fromEntries(WORK_GENRES.map((name) => [name, new Set<string>()])) as Record<
    WorkGenre,
    Set<string>
  >

  for (const composer of dump) {
    for (const work of composer.works ?? []) {
      if (!WORK_GENRES.includes(work.genre as WorkGenre)) continue
      const genre = work.genre as WorkGenre
      stats[genre].total += 1
      if (isFlagged(work.popular)) stats[genre].popular += 1
      if (isFlagged(work.recommended)) stats[genre].recommended += 1
      if (isFlagged(work.popular) || isFlagged(work.recommended)) {
        rankedNames[genre].add(composer.name)
      }
    }
  }

  const genres = WORK_GENRES.map((name) => ({
    name,
    slug: genreSlug(name),
    popularCount: stats[name].popular,
    recommendedCount: stats[name].recommended,
    workCount: stats[name].total,
  })).sort(
    (a, b) =>
      b.popularCount - a.popularCount ||
      b.recommendedCount - a.recommendedCount ||
      a.name.localeCompare(b.name)
  )

  return {
    genres,
    rankedComposerNames: Object.fromEntries(
      WORK_GENRES.map((name) => [name, [...rankedNames[name]]])
    ) as Record<WorkGenre, string[]>,
  }
}

const getDumpSummary = unstable_cache(buildDumpSummary, ["openopus-dump-summary"], {
  revalidate: 3600,
  tags: ["openopus"],
})

export async function listAllComposers(): Promise<OpenOpusComposer[]> {
  const data = await openOpusGet<{ status: Status; composers?: OpenOpusComposer[] }>(
    "/composer/list/name/all.json"
  )
  return isSuccess(data.status) ? data.composers ?? [] : []
}

/**
 * Open Opus has no global genre list endpoint. `/work/dump.json` includes
 * composer.works[].popular as "0"|"1". Genres are ordered by that popular
 * count, then essential/recommended count, then name.
 */
export async function listGenresByPopularity(): Promise<GenreSummary[]> {
  const summary = await getDumpSummary()
  return summary.genres
}

export type GenreWork = OpenOpusWork & {
  composer: Pick<OpenOpusComposer, "id" | "name" | "complete_name" | "epoch" | "birth">
}

async function mapInBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    results.push(...(await Promise.all(batch.map(fn))))
  }
  return results
}

/**
 * Works Open Opus flags as popular or essential in this genre, with IDs from
 * `/work/list/composer/{id}/genre/{Genre}.json`. Sort: popular+essential,
 * popular, essential; then composer name, then title. Unflagged works are
 * omitted (thousands per genre, no rank).
 */
export async function listWorksByGenre(genre: WorkGenre): Promise<GenreWork[]> {
  const [summary, composers] = await Promise.all([getDumpSummary(), listAllComposers()])
  const byName = new Map(composers.map((composer) => [composer.name, composer]))
  const neededIds = summary.rankedComposerNames[genre]
    .map((name) => byName.get(name)?.id)
    .filter((id): id is string => Boolean(id))

  const lists = await mapInBatches(neededIds, 12, (id) => listWorksByComposerGenre(id, genre))
  const works: GenreWork[] = []

  for (const list of lists) {
    if (!list.composer) continue
    const composer = {
      id: list.composer.id,
      name: list.composer.name,
      complete_name: list.composer.complete_name,
      epoch: list.composer.epoch,
      birth: list.composer.birth,
    }
    for (const work of list.works) {
      if (work.genre !== genre) continue
      if (!isFlagged(work.popular) && !isFlagged(work.recommended)) continue
      works.push({ ...work, composer })
    }
  }

  return works.sort(
    (a, b) =>
      workPopularityRank(a) - workPopularityRank(b) ||
      composerSortName(a.composer).localeCompare(composerSortName(b.composer)) ||
      a.title.localeCompare(b.title)
  )
}
