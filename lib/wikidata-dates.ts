import {
  birthYearFromIso,
  buildDateIndex,
  selectComposerQid,
  yearFromWikidataTime,
  type ComposerCandidate,
  type DateIndex,
  type DatedWorkLabels,
} from "./composition-date.ts"

const USER_AGENT = "ClassicalPortal/1.0 (https://github.com/TheKaoser/classical-portal)"
const COMPOSER_OCCUPATION = "Q36834"
const API = "https://www.wikidata.org/w/api.php"
const SPARQL = "https://query.wikidata.org/sparql"

type SearchHit = { id: string; label: string; description: string }

type EntityFacts = { birthYear: number | null; composer: boolean }

export async function fetchComposerDateIndex(
  completeName: string,
  birth: string | null
): Promise<DateIndex | null> {
  const birthYear = birthYearFromIso(birth)
  let qid = await resolveQid(completeName, birthYear)
  if (!qid) qid = await resolveQid(`${completeName} composer`, birthYear)
  if (!qid || !/^Q\d+$/.test(qid)) return null
  const works = await fetchDatedWorks(qid)
  return buildDateIndex(works)
}

async function resolveQid(name: string, birthYear: number | null): Promise<string | null> {
  const hits = await searchEntities(name)
  if (!hits.length) return null
  const facts = await entityFacts(hits.map((hit) => hit.id))
  const candidates: ComposerCandidate[] = hits.map((hit) => {
    const fact = facts.get(hit.id)
    return {
      id: hit.id,
      label: hit.label,
      description: hit.description,
      birthYear: fact?.birthYear ?? null,
      composerOccupation: fact?.composer ?? false,
    }
  })
  return selectComposerQid(name.replace(/ composer$/i, ""), birthYear, candidates)
}

async function searchEntities(name: string): Promise<SearchHit[]> {
  const url = new URL(API)
  url.searchParams.set("action", "wbsearchentities")
  url.searchParams.set("search", name)
  url.searchParams.set("language", "en")
  url.searchParams.set("type", "item")
  url.searchParams.set("limit", "8")
  url.searchParams.set("format", "json")
  const data = (await wikidataGet(url)) as {
    search?: { id?: string; label?: string; description?: string }[]
  }
  return (data.search ?? [])
    .filter((hit) => hit.id && hit.label)
    .map((hit) => ({
      id: hit.id as string,
      label: hit.label as string,
      description: hit.description ?? "",
    }))
}

async function entityFacts(ids: string[]): Promise<Map<string, EntityFacts>> {
  const unique = [...new Set(ids)].filter((id) => /^Q\d+$/.test(id))
  const facts = new Map<string, EntityFacts>()
  if (!unique.length) return facts
  const url = new URL(API)
  url.searchParams.set("action", "wbgetentities")
  url.searchParams.set("ids", unique.join("|"))
  url.searchParams.set("props", "claims")
  url.searchParams.set("format", "json")
  const data = (await wikidataGet(url)) as {
    entities?: Record<string, { claims?: Record<string, Claim[]> }>
  }
  for (const id of unique) {
    const claims = data.entities?.[id]?.claims ?? {}
    facts.set(id, {
      birthYear: birthYearFromClaims(claims.P569),
      composer: hasEntityId(claims.P106, COMPOSER_OCCUPATION),
    })
  }
  return facts
}

type Claim = {
  mainsnak?: {
    snaktype?: string
    datavalue?: {
      value?: { time?: string; id?: string }
    }
  }
}

function birthYearFromClaims(claims: Claim[] | undefined): number | null {
  for (const claim of claims ?? []) {
    if (claim.mainsnak?.snaktype !== "value") continue
    const time = claim.mainsnak.datavalue?.value?.time
    if (!time) continue
    const year = yearFromWikidataTime(time)
    if (year != null) return year
  }
  return null
}

function hasEntityId(claims: Claim[] | undefined, id: string): boolean {
  return (claims ?? []).some(
    (claim) => claim.mainsnak?.snaktype === "value" && claim.mainsnak.datavalue?.value?.id === id
  )
}

async function fetchDatedWorks(qid: string): Promise<DatedWorkLabels[]> {
  const query = `
SELECT ?work ?label ?date WHERE {
  ?work wdt:P86 wd:${qid} .
  ?work wdt:P571 ?date .
  { ?work rdfs:label ?label . } UNION { ?work skos:altLabel ?label . }
  FILTER(LANG(?label) = "en")
}`
  const url = new URL(SPARQL)
  url.searchParams.set("query", query)
  const data = (await wikidataGet(url, "application/sparql-results+json")) as {
    results?: { bindings?: SparqlBinding[] }
  }
  const grouped = new Map<string, { labels: Set<string>; years: Set<number> }>()
  for (const binding of data.results?.bindings ?? []) {
    const work = binding.work?.value
    const label = binding.label?.value?.trim()
    const year = binding.date?.value ? yearFromWikidataTime(binding.date.value) : null
    if (!work || !label || year == null) continue
    const entry = grouped.get(work) ?? { labels: new Set<string>(), years: new Set<number>() }
    entry.labels.add(label)
    entry.years.add(year)
    grouped.set(work, entry)
  }

  const works: DatedWorkLabels[] = []
  for (const entry of grouped.values()) {
    if (entry.years.size !== 1) continue
    works.push({ year: [...entry.years][0], labels: [...entry.labels] })
  }
  return works
}

type SparqlBinding = {
  work?: { value?: string }
  label?: { value?: string }
  date?: { value?: string }
}

async function wikidataGet(url: URL, accept = "application/json"): Promise<unknown> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: accept, "User-Agent": USER_AGENT },
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      })
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Wikidata request failed (${response.status})`)
        await delay(500 * 2 ** attempt)
        continue
      }
      if (!response.ok) {
        throw new Error(`Wikidata request failed (${response.status}) for ${url.pathname}`)
      }
      return await response.json()
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Wikidata request failed (4")) throw error
      lastError = error instanceof Error ? error : new Error("Wikidata request failed")
      await delay(500 * 2 ** attempt)
    }
  }
  throw lastError ?? new Error("Wikidata request failed")
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
