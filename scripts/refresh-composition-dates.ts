import { readFileSync, writeFileSync } from "node:fs"
import { fetchComposerDateIndex } from "../lib/wikidata-dates.ts"

const OPEN_OPUS = "https://api.openopus.org/composer/list/name/all.json"
const OUT = new URL("../data/composition-dates.json", import.meta.url)

type Composer = {
  id: string
  name: string
  complete_name: string
  birth: string | null
}

type Catalog = {
  source: string
  generatedAt: string | null
  byId: Record<string, unknown>
}

async function main() {
  const response = await fetch(OPEN_OPUS, { headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error(`Open Opus composer list failed (${response.status})`)
  const data = (await response.json()) as { composers?: Composer[] }
  const composers = data.composers ?? []
  const catalog: Catalog = loadCatalog()

  let found = 0
  let missing = 0
  let failed = 0
  let skipped = 0
  const concurrency = 2
  let cursor = 0

  async function worker() {
    while (cursor < composers.length) {
      const index = cursor
      cursor += 1
      const composer = composers[index]
      const label = composer.complete_name || composer.name
      if (catalog.byId[composer.id]) {
        skipped += 1
        continue
      }
      try {
        const dateIndex = await fetchComposerDateIndex(label, composer.birth)
        if (dateIndex) {
          catalog.byId[composer.id] = dateIndex
          found += 1
          const keys = Object.keys(dateIndex.catalogue).length + Object.keys(dateIndex.form).length
          console.log(`${index + 1}/${composers.length} ${label}: ${keys} keys`)
        } else {
          catalog.byId[composer.id] = { catalogue: {}, form: {}, title: {} }
          missing += 1
          console.log(`${index + 1}/${composers.length} ${label}: no Wikidata composer`)
        }
      } catch (error) {
        failed += 1
        console.warn(`${index + 1}/${composers.length} ${label}: FAILED`, error)
      }
      if ((index + 1) % 10 === 0) write(catalog)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  catalog.generatedAt = new Date().toISOString()
  write(catalog)
  console.log(
    `done found=${found} missing=${missing} failed=${failed} skipped=${skipped} composers=${composers.length}`
  )
  if (failed > 0) process.exitCode = 1
}

function loadCatalog(): Catalog {
  try {
    const parsed = JSON.parse(readFileSync(OUT, "utf8")) as Catalog
    if (parsed?.byId && typeof parsed.byId === "object") {
      parsed.source =
        "Wikidata Query Service: works with composer (P86) and inception (P571), matched on English labels and aliases"
      return parsed
    }
  } catch {
    // Start a new catalog.
  }
  return {
    source:
      "Wikidata Query Service: works with composer (P86) and inception (P571), matched on English labels and aliases",
    generatedAt: null,
    byId: {},
  }
}

function write(catalog: Catalog) {
  writeFileSync(OUT, JSON.stringify(catalog))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
