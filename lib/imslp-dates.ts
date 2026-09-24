/**
 * Read IMSLP's "Year/Date of Composition" field. Wikidata P839 links some
 * pages directly. The composer's P839 category lists the rest; those pages
 * are used only when the title names that composer. The cache stores the
 * parsed year, not page text. IMSLP is queried only from the refresh script,
 * in small batches.
 */
import { normalizeTitle } from "./composition-date.ts"

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
    .replace(/#.*$/, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
}

export function imslpLookupKey(pageTitle: string): string {
  return pageTitle.replace(/_/g, " ").trim().toLowerCase()
}

const NAME_PARTICLES = new Set(["van", "von", "de", "da", "di", "del", "della", "la", "le", "du", "of", "the", "y"])

function nameTokens(value: string): string[] {
  return normalizeTitle(value)
    .split(" ")
    .filter((token) => token && !NAME_PARTICLES.has(token))
}

function generationOf(value: string): "jr" | "sr" | null {
  const tokens = normalizeTitle(value).split(" ").filter(Boolean)
  if (tokens.some((token) => token === "jr" || token === "junior" || token === "ii")) return "jr"
  if (tokens.some((token) => token === "sr" || token === "senior" || token === "i")) return "sr"
  return null
}

function givenNameMatches(token: string, composerTokens: string[]): boolean {
  if (composerTokens.includes(token)) return true
  if (token.length !== 1) return false
  return composerTokens.some((candidate) => candidate.startsWith(token) && candidate.length > 1)
}

/**
 * IMSLP work titles end in "(Last, First)". The page is kept only when that
 * credit is the composer whose category we listed, so a miscategorized
 * namesake does not lend its year.
 */
export function imslpPageMatchesComposer(pageTitle: string, completeName: string): boolean {
  const paren = /\(([^)]+)\)\s*$/.exec(pageTitle.replace(/_/g, " ").trim())
  if (!paren) return false
  const [surnamePart, givenPart] = paren[1].split(",").map((part) => part.trim())
  if (!surnamePart || !givenPart) return false
  const composerTokens = nameTokens(completeName)
  const surnameTokens = nameTokens(surnamePart)
  if (!surnameTokens.length || !surnameTokens.every((token) => composerTokens.includes(token))) return false
  const givenTokens = nameTokens(givenPart)
  if (!givenTokens.some((token) => givenNameMatches(token, composerTokens))) return false
  const composerGeneration = generationOf(completeName)
  const pageGeneration = generationOf(paren[1])
  if (composerGeneration !== pageGeneration) return false
  return true
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

export async function listImslpCategoryPages(category: string): Promise<string[]> {
  if (!/^Category:[^|]+$/.test(category)) return []
  const titles: string[] = []
  let cont: string | null = null
  for (let page = 0; page < 40; page++) {
    const batch = await enqueue(() => fetchCategoryPage(category, cont))
    titles.push(...batch.titles)
    cont = batch.cont
    if (!cont) break
  }
  return titles
}

async function fetchCategoryPage(
  category: string,
  cont: string | null
): Promise<{ titles: string[]; cont: string | null }> {
  const url = new URL(API)
  url.searchParams.set("action", "query")
  url.searchParams.set("format", "json")
  url.searchParams.set("list", "categorymembers")
  url.searchParams.set("cmtitle", category)
  url.searchParams.set("cmtype", "page")
  url.searchParams.set("cmnamespace", "0")
  url.searchParams.set("cmlimit", "500")
  url.searchParams.set("maxlag", "5")
  if (cont) url.searchParams.set("cmcontinue", cont)
  const data = (await imslpGet(url)) as {
    query?: { categorymembers?: { title?: string; ns?: number }[] }
    continue?: { cmcontinue?: string }
    "query-continue"?: { categorymembers?: { cmcontinue?: string } }
  } | null
  if (!data) return { titles: [], cont: null }
  const titles = (data.query?.categorymembers ?? [])
    .map((member) => member.title?.trim() ?? "")
    .filter(Boolean)
  const next =
    data.continue?.cmcontinue ?? data["query-continue"]?.categorymembers?.cmcontinue ?? null
  return { titles, cont: next }
}

async function imslpGet(url: URL): Promise<unknown | null> {
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
      return await response.json()
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("IMSLP request failed (4")) throw error
      lastError = error instanceof Error ? error : new Error("IMSLP request failed")
      await delay(1500 * 2 ** attempt)
    }
  }
  console.warn("IMSLP request skipped:", lastError)
  return null
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
  for (const batch of imslpBatches(unique, 16)) {
    const fields = await enqueue(() => fetchBatch(batch))
    for (const [key, value] of fields) out.set(key, value)
  }
  return out
}

function imslpBatches(titles: string[], size: number): string[][] {
  const batches: string[][] = []
  let current: string[] = []
  let length = 0
  for (const title of titles) {
    const next = title.length + 1
    if (current.length && (current.length >= size || length + next > 3500)) {
      batches.push(current)
      current = []
      length = 0
    }
    current.push(title)
    length += next
  }
  if (current.length) batches.push(current)
  return batches
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
