import {
  birthYearFromIso,
  buildDateIndex,
  dateFromWikidataPrecision,
  dateWithinLife,
  extractCatalogueKeys,
  mergeExactYears,
  labelsForCatalogueCode,
  parseCompositionDateText,
  prefixFromCatalogueLabels,
  selectComposerQid,
  yearFromWikidataTime,
  type ComposerCandidate,
  type CompositionDate,
  type DateIndex,
  type DatedWorkLabels,
} from "./composition-date.ts"
import { fetchImslpWorkFields, imslpLookupKey, imslpTitleLabel } from "./imslp-dates.ts"

const USER_AGENT = "ClassicalPortal/1.0 (https://github.com/TheKaoser/classical-portal)"
const COMPOSER_OCCUPATION = "Q36834"
const API = "https://www.wikidata.org/w/api.php"
const SPARQL = "https://query.wikidata.org/sparql"

type SearchHit = { id: string; label: string; description: string }

type EntityFacts = { birthYear: number | null; composer: boolean }

export async function fetchComposerDateIndex(
  completeName: string,
  birth: string | null,
  death: string | null = null
): Promise<DateIndex | null> {
  const birthYear = birthYearFromIso(birth)
  const deathYear = birthYearFromIso(death)
  let qid = await resolveQid(completeName, birthYear)
  if (!qid) qid = await resolveQid(`${completeName} composer`, birthYear)
  if (!qid || !/^Q\d+$/.test(qid)) return null
  const works = await fetchDatedWorks(qid, birthYear, deathYear)
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

type WorkRecord = {
  labels: Set<string>
  dates: Map<string, CompositionDate>
  imslp: Set<string>
  codes: { code: string; catalogue: string | null }[]
}

const prefixCache = new Map<string, string | null>()

async function fetchDatedWorks(
  qid: string,
  birthYear: number | null,
  deathYear: number | null
): Promise<DatedWorkLabels[]> {
  const [workRows, catalogueRows] = await Promise.all([
    sparql(worksQuery(qid)).catch(() => sparql(worksQuery(qid, false))),
    sparql(catalogueQuery(qid)).catch(() => [] as SparqlBinding[]),
  ])
  const grouped = new Map<string, WorkRecord>()
  const recordFor = (work: string) => {
    const existing = grouped.get(work)
    if (existing) return existing
    const created: WorkRecord = { labels: new Set(), dates: new Map(), imslp: new Set(), codes: [] }
    grouped.set(work, created)
    return created
  }

  for (const binding of workRows) {
    const work = binding.work?.value
    if (!work) continue
    const record = recordFor(work)
    const label = binding.label?.value?.trim()
    if (label) record.labels.add(label)
    if (binding.date?.value && binding.precision?.value) {
      const date = dateFromWikidataPrecision(binding.date.value, Number(binding.precision.value))
      if (date) record.dates.set(dateKey(date), date)
    }
    const imslp = binding.imslp?.value?.trim()
    if (imslp) record.imslp.add(imslp)
  }
  for (const binding of catalogueRows) {
    const work = binding.work?.value
    const code = binding.code?.value?.trim()
    if (!work || !code) continue
    recordFor(work).codes.push({ code, catalogue: qidFromUri(binding.cat?.value) })
  }

  const prefixes = await cataloguePrefixes(
    [...new Set([...grouped.values()].flatMap((record) => record.codes.map((code) => code.catalogue).filter(Boolean)))] as string[]
  )
  const imslpTitles: string[] = []
  for (const record of grouped.values()) {
    if (needsImslp(record, prefixes, birthYear, deathYear)) imslpTitles.push(...record.imslp)
  }
  const imslp = imslpTitles.length ? await fetchImslpWorkFields(imslpTitles) : new Map()

  const works: DatedWorkLabels[] = []
  for (const record of grouped.values()) {
    let date = acceptedInception(record, birthYear, deathYear)
    const labels = new Set<string>(record.labels)
    for (const code of record.codes) {
      const prefix = code.catalogue ? prefixes.get(code.catalogue) ?? null : null
      for (const label of labelsForCatalogueCode(prefix, code.code)) labels.add(label)
    }
    if (record.imslp.size && (date == null || !hasCatalogue(labels))) {
      const parsed: CompositionDate[] = []
      for (const page of record.imslp) {
        const fields = imslp.get(imslpLookupKey(page))
        if (!fields) continue
        if (fields.catalogue) labels.add(fields.catalogue)
        const title = imslpTitleLabel(page)
        if (title) labels.add(title)
        if (date == null && fields.composition) {
          const candidate = parseCompositionDateText(fields.composition)
          if (candidate && dateWithinLife(candidate, birthYear, deathYear)) parsed.push(candidate)
        }
      }
      if (date == null) {
        const unique = new Map(parsed.map((candidate) => [dateKey(candidate), candidate]))
        if (unique.size === 1) date = [...unique.values()][0]
      }
    }
    if (!date || !labels.size) continue
    works.push({
      year: date.start,
      end: date.end,
      circa: date.circa,
      labels: [...labels],
    })
  }
  return works
}

function acceptedInception(
  record: WorkRecord,
  birthYear: number | null,
  deathYear: number | null
): CompositionDate | null {
  const inception = [...record.dates.values()]
  const date = inception.length === 1 ? inception[0] : mergeExactYears(inception)
  if (!date || !dateWithinLife(date, birthYear, deathYear)) return null
  return date
}

function needsImslp(
  record: WorkRecord,
  prefixes: Map<string, string | null>,
  birthYear: number | null,
  deathYear: number | null
): boolean {
  if (!record.imslp.size) return false
  const dated = acceptedInception(record, birthYear, deathYear)
  if (!dated) return true
  const labels = new Set<string>(record.labels)
  for (const code of record.codes) {
    const prefix = code.catalogue ? prefixes.get(code.catalogue) ?? null : null
    for (const label of labelsForCatalogueCode(prefix, code.code)) labels.add(label)
  }
  return !hasCatalogue(labels)
}

function hasCatalogue(labels: Set<string>): boolean {
  for (const label of labels) {
    if (extractCatalogueKeys(label).length) return true
  }
  return false
}

function dateKey(date: CompositionDate): string {
  return `${date.circa ? "c" : "e"}:${date.start}:${date.end ?? ""}`
}

function worksQuery(qid: string, altLabels = true): string {
  const labels = altLabels
    ? `{ ?work rdfs:label ?label . FILTER(LANG(?label) = "en") }
    UNION
    { ?work skos:altLabel ?label . FILTER(LANG(?label) = "en") }`
    : `?work rdfs:label ?label . FILTER(LANG(?label) = "en")`
  return `
SELECT ?work ?label ?date ?precision ?imslp WHERE {
  ?work wdt:P86 wd:${qid} .
  OPTIONAL { ${labels} }
  OPTIONAL {
    ?work p:P571 ?statement .
    ?statement psv:P571 ?value .
    ?value wikibase:timeValue ?date .
    ?value wikibase:timePrecision ?precision .
  }
  OPTIONAL { ?work wdt:P839 ?imslp }
}`
}

function catalogueQuery(qid: string): string {
  return `
SELECT ?work ?code ?cat WHERE {
  ?work wdt:P86 wd:${qid} .
  ?work p:P528 ?statement .
  ?statement ps:P528 ?code .
  OPTIONAL { ?statement pq:P972 ?cat }
}`
}

async function sparql(query: string): Promise<SparqlBinding[]> {
  const url = new URL(SPARQL)
  url.searchParams.set("query", query)
  const data = (await wikidataGet(url, "application/sparql-results+json")) as {
    results?: { bindings?: SparqlBinding[] }
  }
  return data.results?.bindings ?? []
}

async function cataloguePrefixes(ids: string[]): Promise<Map<string, string | null>> {
  const missing = ids.filter((id) => /^Q\d+$/.test(id) && !prefixCache.has(id))
  for (let i = 0; i < missing.length; i += 40) {
    const batch = missing.slice(i, i + 40)
    const url = new URL(API)
    url.searchParams.set("action", "wbgetentities")
    url.searchParams.set("ids", batch.join("|"))
    url.searchParams.set("props", "labels|aliases")
    url.searchParams.set("languages", "en")
    url.searchParams.set("format", "json")
    const data = (await wikidataGet(url)) as {
      entities?: Record<string, { labels?: { en?: { value?: string } }; aliases?: { en?: { value?: string }[] } }>
    }
    for (const id of batch) {
      const entity = data.entities?.[id]
      const label = entity?.labels?.en?.value ?? ""
      const aliases = (entity?.aliases?.en ?? [])
        .map((alias) => alias.value)
        .filter((value): value is string => Boolean(value))
      prefixCache.set(id, prefixFromCatalogueLabels(label, aliases))
    }
  }
  const prefixes = new Map<string, string | null>()
  for (const id of ids) prefixes.set(id, prefixCache.get(id) ?? null)
  return prefixes
}

function qidFromUri(value: string | undefined): string | null {
  const match = value?.match(/Q\d+$/)
  return match ? match[0] : null
}

type SparqlBinding = {
  work?: { value?: string }
  label?: { value?: string }
  date?: { value?: string }
  precision?: { value?: string }
  imslp?: { value?: string }
  code?: { value?: string }
  cat?: { value?: string }
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
