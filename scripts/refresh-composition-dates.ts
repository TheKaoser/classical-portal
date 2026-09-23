/**
 * Rebuild data/composition-dates.json.
 *
 * Open Opus has no composition year. For each composer this script reads
 * Wikidata inception (P571) and, where that is missing, the IMSLP
 * "Year/Date of Composition" field linked by Wikidata P839. Premiere and
 * publication dates are not used.
 *
 *   node --experimental-strip-types scripts/refresh-composition-dates.ts --refresh
 *
 * Safe to interrupt. Continue with `--resume`. Without `--refresh`, composers
 * already in the file are skipped. `--composer=87,145` limits the run.
 * A full run (no `--composer`) rewrites `stats` with the Open Opus match rate.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { EMPTY_DATE_INDEX, matchCompositionYear, normalizeDateIndex } from "../lib/composition-date.ts"
import { fetchComposerDateIndex } from "../lib/wikidata-dates.ts"

const OPEN_OPUS = "https://api.openopus.org"
const OUT = new URL("../data/composition-dates.json", import.meta.url)
const SOURCE =
  "Wikidata inception (P571, year precision or finer) on works with composer (P86). Several exact years within 30 years are stored as a range. IMSLP Year/Date of Composition via Wikidata P839 when inception is missing. Matched on catalogue numbers (a numbered span only when every number is dated), then a unique form or title. Premiere (P1191) and publication (P577) are not used. Open Opus does not provide a year."

type Composer = {
  id: string
  name: string
  complete_name: string
  birth: string | null
  death: string | null
}

type DateIndex = {
  catalogue: Record<string, unknown>
  form: Record<string, unknown>
  title: Record<string, unknown>
}

type Stats = {
  works: number
  dated: number
  exact: number
  ranged: number
  circa: number
  percent: number
}

type Catalog = {
  source: string
  generatedAt: string | null
  coverageVersion: number
  doneIds: string[]
  stats: Stats | null
  byId: Record<string, DateIndex>
}

async function main() {
  const args = process.argv.slice(2)
  const refresh = args.includes("--refresh")
  const resume = args.includes("--resume")
  const composerArg = args.find((arg) => arg.startsWith("--composer="))?.slice("--composer=".length)
  const only = new Set(
    (composerArg ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  )
  const response = await fetch(`${OPEN_OPUS}/composer/list/name/all.json`, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) throw new Error(`Open Opus composer list failed (${response.status})`)
  const data = (await response.json()) as { composers?: Composer[] }
  const composers = (data.composers ?? []).filter((composer) => !only.size || only.has(composer.id))
  const catalog = loadCatalog()
  if (refresh && !resume && !only.size) catalog.doneIds = []

  let found = 0
  let missing = 0
  let failed = 0
  let skipped = 0
  let cursor = 0

  async function worker() {
    while (cursor < composers.length) {
      const index = cursor
      cursor += 1
      const composer = composers[index]
      const label = composer.complete_name || composer.name
      const done = catalog.doneIds.includes(composer.id)
      if ((!refresh && catalog.byId[composer.id]) || (refresh && resume && done)) {
        skipped += 1
        continue
      }
      try {
        const dateIndex = await fetchComposerDateIndex(label, composer.birth, composer.death)
        if (dateIndex) {
          catalog.byId[composer.id] = dateIndex
          found += 1
          const keys =
            Object.keys(dateIndex.catalogue).length +
            Object.keys(dateIndex.form).length +
            Object.keys(dateIndex.title).length
          console.log(`${index + 1}/${composers.length} ${label}: ${keys} keys`)
        } else {
          catalog.byId[composer.id] = { catalogue: {}, form: {}, title: {} }
          missing += 1
          console.log(`${index + 1}/${composers.length} ${label}: no Wikidata composer`)
        }
        if (!catalog.doneIds.includes(composer.id)) catalog.doneIds.push(composer.id)
      } catch (error) {
        failed += 1
        console.warn(`${index + 1}/${composers.length} ${label}: FAILED`, error)
      }
      write(catalog)
    }
  }

  await Promise.all([worker(), worker()])
  catalog.generatedAt = new Date().toISOString()
  catalog.coverageVersion = 2
  if (!only.size) catalog.stats = await coverage(catalog)
  write(catalog)
  console.log(
    `done found=${found} missing=${missing} failed=${failed} skipped=${skipped} composers=${composers.length}`
  )
  if (catalog.stats) {
    console.log(
      `coverage ${catalog.stats.dated}/${catalog.stats.works} (${catalog.stats.percent}%) exact=${catalog.stats.exact} ranged=${catalog.stats.ranged} circa=${catalog.stats.circa}`
    )
  }
  if (failed > 0) process.exitCode = 1
}

async function coverage(catalog: Catalog): Promise<Stats> {
  const response = await fetch(`${OPEN_OPUS}/composer/list/name/all.json`, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) throw new Error(`Open Opus composer list failed (${response.status})`)
  const data = (await response.json()) as { composers?: Composer[] }
  const composers = data.composers ?? []
  const stats: Stats = { works: 0, dated: 0, exact: 0, ranged: 0, circa: 0, percent: 0 }
  let cursor = 0
  async function worker() {
    while (cursor < composers.length) {
      const index = cursor
      cursor += 1
      const composer = composers[index]
      const list = await openOpus(`/work/list/composer/${encodeURIComponent(composer.id)}/genre/all.json`)
      const works = (list.works as { title?: string; searchterms?: string | string[] }[] | undefined) ?? []
      const dateIndex = normalizeDateIndex(catalog.byId[composer.id]) ?? EMPTY_DATE_INDEX
      for (const work of works) {
        stats.works += 1
        const date = matchCompositionYear(work.title ?? "", dateIndex, work.searchterms)
        if (!date) continue
        stats.dated += 1
        if (date.circa) stats.circa += 1
        else if (date.end != null) stats.ranged += 1
        else stats.exact += 1
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, composers.length) }, () => worker()))
  stats.percent = stats.works ? Math.round((1000 * stats.dated) / stats.works) / 10 : 0
  return stats
}

async function openOpus(path: string): Promise<Record<string, unknown>> {
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(`${OPEN_OPUS}${path}`, { headers: { Accept: "application/json" } })
      if (!response.ok) throw new Error(`${response.status} ${path}`)
      return (await response.json()) as Record<string, unknown>
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }
  throw lastError
}

function loadCatalog(): Catalog {
  try {
    const parsed = JSON.parse(readFileSync(OUT, "utf8")) as Partial<Catalog>
    if (parsed?.byId && typeof parsed.byId === "object") {
      return {
        source: SOURCE,
        generatedAt: parsed.generatedAt ?? null,
        coverageVersion: parsed.coverageVersion ?? 1,
        doneIds: Array.isArray(parsed.doneIds) ? parsed.doneIds.map(String) : [],
        stats: parsed.stats ?? null,
        byId: parsed.byId,
      }
    }
  } catch {
    // Start a new catalog.
  }
  return { source: SOURCE, generatedAt: null, coverageVersion: 2, doneIds: [], stats: null, byId: {} }
}

function write(catalog: Catalog) {
  writeFileSync(OUT, JSON.stringify(catalog))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
