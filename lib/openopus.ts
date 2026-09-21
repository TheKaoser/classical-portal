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
}

export type OpenOpusWorkDetail = OpenOpusWork & {
  searchmode?: string
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

export function isFlagged(value: string | number | undefined): boolean {
  return value === 1 || value === "1"
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

export async function listComposersByEpoch(epochName: string): Promise<OpenOpusComposer[]> {
  const data = await openOpusGet<{ status: Status; composers?: OpenOpusComposer[] }>(
    `/composer/list/epoch/${encodePathSegment(epochName)}.json`
  )
  return isSuccess(data.status) ? data.composers ?? [] : []
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
  const data = await openOpusGet<{
    status: Status
    composer?: OpenOpusComposer
    works?: OpenOpusWork[]
  }>(`/work/list/composer/${encodePathSegment(composerId)}/genre/all.json`)

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

export function groupWorksByGenre(works: OpenOpusWork[]): { genre: string; works: OpenOpusWork[] }[] {
  const groups = new Map<string, OpenOpusWork[]>()

  for (const work of works) {
    const genre = work.genre || "Other"
    const list = groups.get(genre) ?? []
    list.push(work)
    groups.set(genre, list)
  }

  const rank = (work: OpenOpusWork) => {
    if (isFlagged(work.popular) && isFlagged(work.recommended)) return 0
    if (isFlagged(work.popular)) return 1
    if (isFlagged(work.recommended)) return 2
    return 3
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([genre, list]) => ({
      genre,
      works: list.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title)),
    }))
}

export const WORK_GENRES = ["Chamber", "Keyboard", "Orchestral", "Stage", "Vocal"] as const
