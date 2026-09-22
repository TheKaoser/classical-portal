/**
 * Rebuild data/form-works.json from Open Opus.
 *
 * The dump (`/work/dump.json`) has every title but no work ids. This script
 * lists composers by epoch, then each composer's works (which include ids),
 * and keeps works whose title or subtitle matches a form in lib/forms.ts.
 *
 *   node --experimental-strip-types scripts/build-form-index.ts
 */
import { writeFileSync } from "node:fs"
import { openOpusEpochNames } from "../lib/epochs.ts"
import { classifyWork, WORK_FORMS } from "../lib/forms.ts"

const BASE = "https://api.openopus.org"

type Composer = {
  id: string
  name: string
  complete_name: string
}

type Work = {
  id: string
  title: string
  subtitle?: string
  genre?: string
  popular?: string
  recommended?: string
}

async function getJson<T>(path: string): Promise<T> {
  const url = `${BASE}${path}`
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } })
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return (await res.json()) as T
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }
  throw lastError
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

const composers: Composer[] = []
for (const name of openOpusEpochNames()) {
  const data = await getJson<{ composers?: Composer[] }>(
    `/composer/list/epoch/${encodeURIComponent(name)}.json`
  )
  composers.push(...(data.composers ?? []))
}

const unique = [...new Map(composers.map((composer) => [composer.id, composer])).values()]
console.log(`Fetching works for ${unique.length} composers`)

const catalog = await mapPool(unique, 8, async (composer) => {
  const data = await getJson<{ works?: Work[] }>(
    `/work/list/composer/${encodeURIComponent(composer.id)}/genre/all.json`
  )
  const works = []
  for (const work of data.works ?? []) {
    const title = (work.title ?? "").trim()
    const subtitle = (work.subtitle ?? "").trim()
    const form = classifyWork(title, subtitle, work.genre)
    if (!form || !work.id) continue
    works.push({
      id: String(work.id),
      title,
      subtitle,
      genre: work.genre ?? "",
      popular: String(work.popular ?? "0"),
      recommended: String(work.recommended ?? "0"),
      composerId: String(composer.id),
      composerName: composer.complete_name,
      form,
    })
  }
  return works
})

const byId = new Map<string, (typeof catalog)[number][number]>()
for (const works of catalog) {
  for (const work of works) byId.set(work.id, work)
}
const works = [...byId.values()]

const counts = new Map<string, number>()
for (const work of works) counts.set(work.form, (counts.get(work.form) ?? 0) + 1)
for (const form of WORK_FORMS) {
  console.log(`${String(counts.get(form.slug) ?? 0).padStart(5)}  ${form.name}`)
}
console.log(`${String(works.length).padStart(5)}  total`)

const payload = {
  source:
    "Derived from Open Opus composer work lists (https://api.openopus.org). Open Opus genres are only Chamber, Keyboard, Orchestral, Stage, and Vocal. Each work is assigned one form from its title, or from its subtitle when the title has none, using the patterns in lib/forms.ts. The dump at /work/dump.json confirms those patterns but omits work ids, so ids come from /work/list/composer/{id}/genre/all.json.",
  generatedAt: new Date().toISOString().slice(0, 10),
  works,
}

writeFileSync(new URL("../data/form-works.json", import.meta.url), `${JSON.stringify(payload)}\n`)
console.log("Wrote data/form-works.json")
