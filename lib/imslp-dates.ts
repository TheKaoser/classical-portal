/**
 * Read IMSLP's "Year/Date of Composition" field for works Wikidata already
 * links with P839. The cache stores the parsed year, not page text.
 * IMSLP is queried only from the refresh script, in small batches.
 */

const USER_AGENT =
  "ClassicalPortal/1.0 (https://github.com/TheKaoser/classical-portal; composition-date cache)"
const API = "https://imslp.org/api.php"

const COMPOSITION_FIELDS = [
  "Year/Date of Composition",
  "Year of Composition",
  "Date of Composition",
  "Composition Date",
  "Composition Year",
]

const CATALOGUE_FIELDS = [
  "Opus/Catalogue Number",
  "Opus/Catalog Number",
  "Catalogue Number",
  "Catalog Number",
]

export type ImslpWorkFields = {
  composition: string | null
  catalogue: string | null
}

export function imslpTitleLabel(pageTitle: string): string {
  return pageTitle
    .replace(/_/g, " ")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
}

export function imslpLookupKey(pageTitle: string): string {
  return pageTitle.replace(/_/g, " ").trim().toLowerCase()
}

export function imslpWorkFields(wikitext: string): ImslpWorkFields {
  return {
    composition: readTemplateField(wikitext, COMPOSITION_FIELDS),
    catalogue: readTemplateField(wikitext, CATALOGUE_FIELDS),
  }
}

function readTemplateField(wikitext: string, names: string[]): string | null {
  for (const name of names) {
    const pattern = new RegExp(
      `(?:^|\\n)\\|\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=([^\\n]*)`,
      "i"
    )
    const value = pattern.exec(wikitext)?.[1]?.trim()
    if (value) return value
  }
  return null
}

let imslpChain: Promise<unknown> = Promise.resolve()

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = imslpChain.then(fn, fn)
  imslpChain = run.then(
    () => delay(1100),
    () => delay(1100)
  )
  return run
}

export async function fetchImslpWorkFields(pageTitles: string[]): Promise<Map<string, ImslpWorkFields>> {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const title of pageTitles) {
    const key = imslpLookupKey(title)
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(title.replace(/_/g, " ").trim())
  }
  const out = new Map<string, ImslpWorkFields>()
  for (let i = 0; i < unique.length; i += 8) {
    const batch = unique.slice(i, i + 8)
    const fields = await enqueue(() => fetchBatch(batch))
    for (const [key, value] of fields) out.set(key, value)
  }
  return out
}

type QueryPayload = {
  query?: {
    normalized?: { from: string; to: string }[]
    redirects?: { from: string; to: string }[]
    pages?: Record<
      string,
      {
        title?: string
        missing?: string
        revisions?: { slots?: { main?: { "*"?: string; content?: string } }; "*"?: string }[]
      }
    >
  }
}

async function fetchBatch(titles: string[]): Promise<Map<string, ImslpWorkFields>> {
  const url = new URL(API)
  url.searchParams.set("action", "query")
  url.searchParams.set("format", "json")
  url.searchParams.set("redirects", "1")
  url.searchParams.set("maxlag", "5")
  url.searchParams.set("prop", "revisions")
  url.searchParams.set("rvprop", "content")
  url.searchParams.set("rvslots", "main")
  url.searchParams.set("titles", titles.join("|"))

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      })
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`IMSLP request failed (${response.status})`)
        await delay(1500 * 2 ** attempt)
        continue
      }
      if (!response.ok) throw new Error(`IMSLP request failed (${response.status})`)
      const data = (await response.json()) as QueryPayload
      return mapPages(titles, data)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("IMSLP request failed (4")) throw error
      lastError = error instanceof Error ? error : new Error("IMSLP request failed")
      await delay(1500 * 2 ** attempt)
    }
  }
  console.warn(`IMSLP batch skipped (${titles.length} pages):`, lastError)
  return new Map()
}

function mapPages(requested: string[], data: QueryPayload): Map<string, ImslpWorkFields> {
  const out = new Map<string, ImslpWorkFields>()
  const pages = Object.values(data.query?.pages ?? {})
  for (const title of requested) {
    const resolved = resolveTitle(title, data)
    const page = pages.find((candidate) => candidate.title === resolved || candidate.title === title)
    if (!page || page.missing != null) continue
    const revision = page.revisions?.[0]
    const wikitext = revision?.slots?.main?.["*"] ?? revision?.slots?.main?.content ?? revision?.["*"] ?? ""
    if (!wikitext) continue
    out.set(imslpLookupKey(title), imslpWorkFields(wikitext))
  }
  return out
}

function resolveTitle(title: string, data: QueryPayload): string {
  let current = title
  for (const row of data.query?.normalized ?? []) {
    if (row.from === current) current = row.to
  }
  for (const row of data.query?.redirects ?? []) {
    if (row.from === current) current = row.to
  }
  return current
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
