import { unstable_cache } from "next/cache"
import catalog from "../data/composition-dates.json"
import {
  EMPTY_DATE_INDEX,
  matchCompositionYear,
  normalizeDateIndex,
  type CompositionDate,
  type DateIndex,
} from "./composition-date.ts"
import { fetchComposerDateIndex } from "./wikidata-dates.ts"

type WorkLike = {
  title: string
  searchterms?: string | string[]
  catalogue?: string
  catalogue_number?: string
}

type ComposerLike = {
  id: string
  name: string
  complete_name: string
  birth?: string | null
  death?: string | null
}

export type DatedWork<T> = T & {
  compositionDate: CompositionDate | null
  compositionYear: number | null
}

type CatalogFile = {
  byId?: Record<string, unknown>
}

const stored = (catalog as unknown as CatalogFile).byId ?? {}
const inflight = new Map<string, Promise<DateIndex>>()

const liveIndex = unstable_cache(
  async (completeName: string, birth: string, death: string) => {
    const index = await fetchComposerDateIndex(completeName, birth || null, death || null)
    return index ?? EMPTY_DATE_INDEX
  },
  ["wikidata-composition-dates-v3"],
  { revalidate: 60 * 60 * 24 * 14 }
)

function storedIndex(id: string): DateIndex | null {
  return normalizeDateIndex(stored[id])
}

/** Composition date from the committed index only. Does not call Wikidata or IMSLP. */
export function storedCompositionDate(composerId: string, work: WorkLike): CompositionDate | null {
  const index = storedIndex(composerId)
  if (!index) return null
  return withYear(work, index).compositionDate
}

async function indexFor(composer: ComposerLike): Promise<DateIndex> {
  const cached = storedIndex(composer.id)
  if (cached) return cached
  const pending = inflight.get(composer.id)
  if (pending) return pending
  const promise = (async () => {
    try {
      return await liveIndex(
        composer.complete_name || composer.name,
        composer.birth ?? "",
        composer.death ?? ""
      )
    } catch (error) {
      inflight.delete(composer.id)
      console.warn(`Wikidata composition dates failed for ${composer.complete_name || composer.name}:`, error)
      return EMPTY_DATE_INDEX
    }
  })()
  inflight.set(composer.id, promise)
  return promise
}

function catalogueHint(work: WorkLike): string | null {
  const system = work.catalogue?.trim().toLowerCase()
  const number = work.catalogue_number?.trim()
  if (!system || !number) return null
  if (!/^[a-z]{1,8}$/.test(system)) return null
  if (!/^[0-9][0-9a-z./:-]*$/i.test(number) || number.length > 24) return null
  return `${system}. ${number}`
}

function withYear<T extends WorkLike>(work: T, index: DateIndex): DatedWork<T> {
  const extras: string[] = []
  const hint = catalogueHint(work)
  if (hint) extras.push(hint)
  const terms = work.searchterms
  if (Array.isArray(terms)) extras.push(...terms)
  else if (terms) extras.push(terms)
  const compositionDate = matchCompositionYear(work.title, index, extras)
  return {
    ...work,
    compositionDate,
    compositionYear: compositionDate?.start ?? null,
  }
}

export async function attachCompositionYears<T extends WorkLike>(
  works: T[],
  composer: ComposerLike
): Promise<Array<DatedWork<T>>> {
  const index = await indexFor(composer)
  return works.map((work) => withYear(work, index))
}

export async function attachCompositionYearsByComposer<T extends WorkLike & { composer: ComposerLike }>(
  works: T[]
): Promise<Array<DatedWork<T>>> {
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
