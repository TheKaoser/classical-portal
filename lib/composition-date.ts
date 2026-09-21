/**
 * Match Open Opus work titles to composition years.
 *
 * Years come from Wikidata inception (P571) on works whose composer (P86)
 * is the same person. Nothing here invents a year: a title is dated only
 * when catalogue numbers, a unique form-and-number, or the full title
 * point at exactly one year. Movements are ignored when the parent work
 * already has a year.
 */

export type DateIndex = {
  catalogue: Record<string, number>
  form: Record<string, number>
  title: Record<string, number>
}

export type DatedWorkLabels = {
  year: number
  labels: string[]
  /** Set when every label looks like a single movement, not the whole work. */
  movement?: boolean
}

export type ComposerCandidate = {
  id: string
  label: string
  description: string
  birthYear: number | null
  composerOccupation: boolean
}

export const EMPTY_DATE_INDEX: DateIndex = { catalogue: {}, form: {}, title: {} }

const NAME_PARTICLES = new Set([
  "van",
  "von",
  "de",
  "da",
  "di",
  "del",
  "della",
  "la",
  "le",
  "du",
  "of",
  "the",
  "y",
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
  "junior",
  "senior",
])

const CATALOGUE_SKIP = new Set([
  "no",
  "nr",
  "nos",
  "vol",
  "pp",
  "ms",
  "op",
  "arr",
  "ed",
  "vs",
  "mr",
  "st",
  "dr",
  "jr",
  "sr",
  "ca",
  "cf",
  "eg",
  "ie",
  "fig",
  "anh",
])

const INSTRUMENTS =
  "string|piano|violin|cello|viola|flute|oboe|clarinet|horn|trumpet|organ|harp|bassoon|keyboard|double|choral|orchestral|wind|brass|guitar|lute"

const FORMS =
  "symphony|sonata|concerto|quartet|quintet|sextet|trio|suite|cantata|partita|serenade|nocturne|prelude|waltz|polonaise|etude|bagatelle|overture|requiem|mass|oratorio|fantasia|fantasy|rhapsody|ballade|scherzo|impromptu|mazurka|intermezzo|capriccio|divertimento"

const FORM_PATTERN = `\\b(?:(${INSTRUMENTS})\\s+)?(?:(${INSTRUMENTS})\\s+)?(${FORMS})s?\\s+no\\.?\\s*(\\d+)`

export function birthYearFromIso(value: string | null | undefined): number | null {
  if (!value) return null
  const match = /^(\d{4})/.exec(value.trim())
  if (!match) return null
  return clampYear(Number(match[1]))
}

export function yearFromWikidataTime(value: string): number | null {
  const match = /^([+-]?\d+)/.exec(value.trim())
  if (!match) return null
  return clampYear(Number(match[1]))
}

function clampYear(year: number): number | null {
  if (!Number.isInteger(year) || year < 500 || year > 2100) return null
  return year
}

function foldLatin(value: string): string {
  return value
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ø/g, "o")
    .replace(/ł/g, "l")
    .replace(/đ/g, "d")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/ı/g, "i")
}

export function normalizeTitle(value: string): string {
  return foldLatin(
    value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
  )
    .replace(/[“”«»„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/♭/g, " flat ")
    .replace(/[♯#]/g, " sharp ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function softNormalize(value: string): string {
  return foldLatin(
    value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
  )
    .replace(/[“”«»„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
}

function canonSystem(system: string): string {
  if (system === "kv") return "k"
  if (system === "opus") return "op"
  return system
}

function catalogueKey(system: string, number: string, sub?: string | null, end?: string | null): string {
  const base = `${canonSystem(system)}:${number.toLowerCase()}`
  if (sub) return `${base}:${sub.toLowerCase()}`
  if (end) return `${base}-${end.toLowerCase()}`
  return base
}

export function extractCatalogueKeys(value: string): string[] {
  const text = softNormalize(value)
  const keys = new Set<string>()

  const opusRe =
    /\bop(?:us)?\.?\s*(?:(posth(?:umous)?)\.?\s*)?(\d{1,4}[a-z]?)(?:\s*,?\s*(?:no\.?|nr\.?)\s*(\d{1,3}[a-z]?))?/g
  for (const match of text.matchAll(opusRe)) {
    const system = match[1] ? "op.posth" : "op"
    keys.add(catalogueKey(system, match[2], match[3]))
  }

  const wooRe = /\bwoo\.?\s*(\d{1,4}[a-z]?)(?:\s*,?\s*(?:no\.?|nr\.?)\s*(\d{1,3}[a-z]?))?/g
  for (const match of text.matchAll(wooRe)) {
    keys.add(catalogueKey("woo", match[1], match[2]))
  }

  const hobRe = /\bhob(?:oken)?\.?\s*([ivxlcdm]+)\s*[:./]\s*(\d{1,4}[a-z]?)/g
  for (const match of text.matchAll(hobRe)) {
    keys.add(`hob:${match[1]}:${match[2].toLowerCase()}`)
  }

  const bwvAnhRe = /\bbwv\.?\s*anh\.?\s*(\d{1,4}[a-z]?)/g
  for (const match of text.matchAll(bwvAnhRe)) {
    keys.add(catalogueKey("bwv.anh", match[1]))
  }

  const undottedRe =
    /\b(bwv|rv|hwv|wwv|twv|wab|sz|wq|swv|woo|kv|trv|bb)\.?\s*(\d{1,4}[a-z]?)(?::(\d{1,4}[a-z]?))?(?:\s*-\s*(\d{1,4}[a-z]?))?/g
  for (const match of text.matchAll(undottedRe)) {
    if (match[1] === "bwv" && /\bbwv\.?\s*anh/.test(text)) continue
    keys.add(catalogueKey(match[1], match[3] ? `${match[2]}:${match[3]}` : match[2], null, match[3] ? null : match[4]))
  }

  const genericRe = /\b([a-z]{1,6})\.\s*(\d{1,4}[a-z]?)(?::(\d{1,4}[a-z]?))?(?:\s*-\s*(\d{1,4}[a-z]?))?/g
  for (const match of text.matchAll(genericRe)) {
    if (CATALOGUE_SKIP.has(match[1])) continue
    if (match[1] === "hob" || match[1] === "bwv") continue
    const number = match[3] ? `${match[2]}:${match[3]}` : match[2]
    const end = match[3] ? null : match[4]
    keys.add(catalogueKey(match[1], number, null, end))
  }

  return [...keys]
}

export function extractFormKey(value: string): string | null {
  const text = softNormalize(value)
  const match = new RegExp(FORM_PATTERN, "i").exec(text)
  if (!match) return null
  const instruments = [match[1], match[2]].filter(Boolean)
  const form = match[3].toLowerCase()
  const number = match[4]
  return `${[...instruments, form].join(" ")}:${number}`
}

export function isMovementLabel(value: string): boolean {
  const text = softNormalize(value)
  if (/\bmovement\b/.test(text)) return true
  if (/:\s*(i{1,3}|iv|v|vi{1,3}|vii|viii|ix|x)\b/.test(text)) return true
  if (
    /[.:]\s*(?:marche funebre|funeral march|finale|allegro|andante|adagio|scherzo|minuet|menuet|menuetto|largo|presto|moderato)\b/.test(
      text
    )
  ) {
    return true
  }
  return false
}

function significantTokens(value: string): string[] {
  return normalizeTitle(value)
    .split(" ")
    .filter((token) => token && !NAME_PARTICLES.has(token))
}

function substantialTitle(value: string): boolean {
  const normalized = normalizeTitle(value)
  if (!normalized || isMovementLabel(value)) return false
  const words = normalized.split(" ").filter(Boolean)
  if (words.length < 2) return false
  return normalized.length >= 12 || /\d/.test(normalized)
}

type YearBuckets = Map<string, { standalone: Set<number>; movement: Set<number> }>

function addYear(map: YearBuckets, key: string, year: number, movement: boolean) {
  const bucket = map.get(key) ?? { standalone: new Set<number>(), movement: new Set<number>() }
  ;(movement ? bucket.movement : bucket.standalone).add(year)
  map.set(key, bucket)
}

function collapse(map: YearBuckets): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, bucket] of map) {
    if (bucket.standalone.size === 1) {
      out[key] = [...bucket.standalone][0]
    } else if (bucket.standalone.size === 0 && bucket.movement.size === 1) {
      out[key] = [...bucket.movement][0]
    }
  }
  return out
}

export function buildDateIndex(works: DatedWorkLabels[]): DateIndex {
  const catalogue: YearBuckets = new Map()
  const form: YearBuckets = new Map()
  const title: YearBuckets = new Map()

  for (const work of works) {
    const year = clampYear(work.year)
    if (year == null) continue
    const labels = work.labels.map((label) => label.trim()).filter(Boolean)
    if (!labels.length) continue
    const movement = work.movement ?? labels.every((label) => isMovementLabel(label))
    const usable = movement ? labels : labels.filter((label) => !isMovementLabel(label))

    const catalogueKeys = new Set<string>()
    const formKeys = new Set<string>()
    const titleKeys = new Set<string>()
    for (const label of usable) {
      for (const key of extractCatalogueKeys(label)) catalogueKeys.add(key)
      const formKey = extractFormKey(label)
      if (formKey) formKeys.add(formKey)
      if (substantialTitle(label)) titleKeys.add(normalizeTitle(label))
    }

    for (const key of catalogueKeys) addYear(catalogue, key, year, movement)
    for (const key of formKeys) addYear(form, key, year, movement)
    for (const key of titleKeys) addYear(title, key, year, movement)
  }

  return {
    catalogue: collapse(catalogue),
    form: collapse(form),
    title: collapse(title),
  }
}

function yearsFor(keys: string[], table: Record<string, number>): number[] {
  const years = new Set<number>()
  for (const key of keys) {
    const year = table[key]
    if (year != null) years.add(year)
  }
  return [...years]
}

export function matchCompositionYear(
  title: string,
  index: DateIndex,
  extraText?: string | string[] | null
): number | null {
  const direct = matchOne(title, index)
  if (direct != null) return direct
  const extras = (Array.isArray(extraText) ? extraText : extraText ? [extraText] : [])
    .flatMap((value) => value.split(/[,;/]/))
    .map((value) => value.trim())
    .filter(Boolean)
  for (const extra of extras) {
    const year = matchOne(extra, index)
    if (year != null) return year
  }
  return null
}

function matchOne(title: string, index: DateIndex): number | null {
  const trimmed = title.trim()
  if (!trimmed) return null

  const catalogueKeys = extractCatalogueKeys(trimmed)
  if (catalogueKeys.length) {
    const years = yearsFor(catalogueKeys, index.catalogue)
    if (years.length === 1) return years[0]
    if (years.length > 1) return null
  }

  const formKey = extractFormKey(trimmed)
  if (formKey && index.form[formKey] != null) return index.form[formKey]

  return matchTitle(trimmed, index.title)
}

function matchTitle(title: string, table: Record<string, number>): number | null {
  const normalized = normalizeTitle(title)
  const years = new Set<number>()
  if (table[normalized] != null) years.add(table[normalized])
  for (const [key, year] of Object.entries(table)) {
    if (key.length < 12 || key === normalized) continue
    if (normalized.startsWith(`${key} `) || normalized.endsWith(` ${key}`)) years.add(year)
  }
  for (const phrase of quotedPhrases(title)) {
    const key = normalizeTitle(phrase)
    if (key.length >= 12 && table[key] != null) years.add(table[key])
  }
  if (years.size === 1) return [...years][0]
  return null
}

function quotedPhrases(title: string): string[] {
  return [...title.matchAll(/["“«]([^"”»]{3,})["”»]/g)].map((match) => match[1])
}

export function compareByCompositionDate(
  a: { title: string; compositionYear?: number | null },
  b: { title: string; compositionYear?: number | null }
): number {
  const aYear = a.compositionYear ?? null
  const bYear = b.compositionYear ?? null
  if (aYear != null && bYear != null && aYear !== bYear) return aYear - bYear
  if (aYear != null && bYear == null) return -1
  if (aYear == null && bYear != null) return 1
  return a.title.localeCompare(b.title)
}

export function sortWorksChronologically<T extends { title: string; compositionYear?: number | null }>(
  works: T[]
): T[] {
  return [...works].sort(compareByCompositionDate)
}

export function selectComposerQid(
  completeName: string,
  birthYear: number | null,
  candidates: ComposerCandidate[]
): string | null {
  let best: { id: string; score: number } | null = null
  for (const candidate of candidates) {
    const score = scoreComposerCandidate(completeName, birthYear, candidate)
    if (score == null) continue
    if (!best || score > best.score) best = { id: candidate.id, score }
  }
  return best?.id ?? null
}

function scoreComposerCandidate(
  completeName: string,
  birthYear: number | null,
  candidate: ComposerCandidate
): number | null {
  const label = normalizeTitle(candidate.label)
  const name = normalizeTitle(completeName)
  if (!label || !name) return null

  const exact = label === name
  const labelTokens = significantTokens(candidate.label)
  const nameTokenList = significantTokens(completeName)
  const nameTokens = new Set(nameTokenList)
  const labelTokenSet = new Set(labelTokens)
  const labelSubset = labelTokens.length >= 2 && labelTokens.every((token) => nameTokens.has(token))
  const nameSubset = nameTokenList.length >= 2 && nameTokenList.every((token) => labelTokenSet.has(token))
  const gap =
    birthYear != null && candidate.birthYear != null ? Math.abs(candidate.birthYear - birthYear) : null
  // Open Opus often stores 1 January of an approximate year, and early
  // composers are sometimes a few years off. Exact-name matches can absorb
  // that; a larger gap is a different person.
  if (gap != null && gap > 15) return null
  const birthOk = gap != null && gap <= 1

  const description = candidate.description.toLowerCase()
  const nonPerson =
    /\b(film|painting|statue|street|school|sculpture|article|award|exhibition|book|highway|album|death of)\b/.test(
      description
    )
  const composerInDescription =
    /\bcomposer\b/.test(description) && !/\b(grandfather|grandson|pupil of|student of)\b/.test(description)
  if (nonPerson && !candidate.composerOccupation) return null
  if (!candidate.composerOccupation && !composerInDescription) return null
  const closeName = birthOk && tokensNearlyMatch(labelTokens, nameTokenList)
  if (!exact && !((labelSubset || nameSubset) && (birthOk || birthYear == null)) && !closeName) return null

  let score = 0
  if (exact) score += 10
  if (labelSubset || nameSubset || closeName) score += 4
  if (birthOk) score += 5
  else if (gap != null) score += 2
  if (candidate.composerOccupation) score += 3
  if (composerInDescription) score += 2
  return score
}

function tokensNearlyMatch(labelTokens: string[], nameTokens: string[]): boolean {
  return labelTokens.some((labelToken) =>
    nameTokens.some((nameToken) => {
      if (labelToken.length < 6 || nameToken.length < 6) return false
      if (labelToken === nameToken) return true
      return editDistance(labelToken, nameToken) <= 1
    })
  )
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
    }
  }
  return rows[a.length][b.length]
}
