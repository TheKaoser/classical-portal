import { unstable_cache } from "next/cache"
import catalog from "../data/composition-dates.json"
import { EMPTY_DATE_INDEX, matchCompositionYear, type DateIndex } from "./composition-date.ts"
import { fetchComposerDateIndex } from "./wikidata-dates.ts"

type WorkLike = {
  title: string
  searchterms?: string | string[]
}

type ComposerLike = {
  id: string
  name: string
  complete_name: string
  birth?: string | null
}

type CatalogFile = {
  byId?: Record<string, DateIndex>
}

const stored = ((catalog as CatalogFile).byId ?? {}) as Record<string, DateIndex>
const inflight = new Map<string, Promise<DateIndex>>()

const liveIndex = unstable_cache(
  async (completeName: string, birth: string) => {
    const index = await fetchComposerDateIndex(completeName, birth || null)
    return index ?? EMPTY_DATE_INDEX
  },
  ["wikidata-composition-dates-v1"],
  { revalidate: 60 * 60 * 24 * 14 }
)

function storedIndex(id: string): DateIndex | null {
  const index = stored[id]
  if (!index?.catalogue || !index.form || !index.title) return null
  return index
}

async function indexFor(composer: ComposerLike): Promise<DateIndex> {
  const cached = storedIndex(composer.id)
  if (cached) return cached
  const pending = inflight.get(composer.id)
  if (pending) return pending
  const promise = (async () => {
    try {
      return await liveIndex(composer.complete_name || composer.name, composer.birth ?? "")
    } catch (error) {
      inflight.delete(composer.id)
      console.warn(`Wikidata composition dates failed for ${composer.complete_name || composer.name}:`, error)
      return EMPTY_DATE_INDEX
    }
  })()
  inflight.set(composer.id, promise)
  return promise
}

function withYear<T extends WorkLike>(work: T, index: DateIndex): T & { compositionYear: number | null } {
  return {
    ...work,
    compositionYear: matchCompositionYear(work.title, index, work.searchterms),
  }
}

export async function attachCompositionYears<T extends WorkLike>(
  works: T[],
  composer: ComposerLike
): Promise<Array<T & { compositionYear: number | null }>> {
  const index = await indexFor(composer)
  return works.map((work) => withYear(work, index))
}

export async function attachCompositionYearsByComposer<T extends WorkLike & { composer: ComposerLike }>(
  works: T[]
): Promise<Array<T & { compositionYear: number | null }>> {
  const composers = new Map<string, ComposerLike>()
  for (const work of works) composers.set(work.composer.id, work.composer)
  const indexes = new Map<string, DateIndex>()
  const missing = [...composers.values()].filter((composer) => !storedIndex(composer.id))
  for (const composer of composers.values()) {
    const cached = storedIndex(composer.id)
    if (cached) indexes.set(composer.id, cached)
  }
  await mapPool(missing, 3, async (composer) => {
    indexes.set(composer.id, await indexFor(composer))
  })
  return works.map((work) => withYear(work, indexes.get(work.composer.id) ?? EMPTY_DATE_INDEX))
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  async function worker() {
    while (next < items.length) {
      const current = next
      next += 1
      await fn(items[current])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
}
