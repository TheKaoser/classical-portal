import { formatCompositionDate, type CompositionDate } from "./composition-label.ts"

export { formatCompositionDate, type CompositionDate }

/**
 * Match Open Opus work titles to composition dates.
 *
 * A date is Wikidata inception (P571), or, when that is missing, IMSLP's
 * "Year/Date of Composition" field. Nothing here invents a year: a title is
 * dated only when catalogue numbers, a unique form-and-number, or the full
 * title point at exactly one date. If the title already carries a catalogue
 * number and that number is not in the index, form and title fallbacks are
 * not used. Movements are ignored when the parent work already has a date.
 */

export type DateIndex = {
  catalogue: Record<string, CompositionDate>
  form: Record<string, CompositionDate>
  title: Record<string, CompositionDate>
}

export type DatedWorkLabels = {
  year: number
  end?: number | null
  circa?: boolean
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
  "posth",
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

export function exactDate(year: number): CompositionDate | null {
  const start = clampYear(year)
  if (start == null) return null
  return { start, end: null, circa: false }
}

export function coerceCompositionDate(value: unknown): CompositionDate | null {
  if (typeof value === "number") return exactDate(value)
  if (!value || typeof value !== "object") return null
  const record = value as { start?: unknown; end?: unknown; circa?: unknown }
  if (typeof record.start !== "number") return null
  const start = clampYear(record.start)
  if (start == null) return null
  let end: number | null = null
  if (typeof record.end === "number") {
    end = clampYear(record.end)
    if (end == null || end < start || end - start > 30) return null
    if (end === start) end = null
  }
  return { start, end, circa: record.circa === true }
}

function coerceDateMap(value: unknown): Record<string, CompositionDate> {
  if (!value || typeof value !== "object") return {}
  const out: Record<string, CompositionDate> = {}
  for (const [key, raw] of Object.entries(value)) {
    const date = coerceCompositionDate(raw)
    if (date) out[key] = date
  }
  return out
}

/** Accepts the current object cache and the older year-number cache. */
export function normalizeDateIndex(value: unknown): DateIndex | null {
  if (!value || typeof value !== "object") return null
  const record = value as { catalogue?: unknown; form?: unknown; title?: unknown }
  if (!record.catalogue || !record.form || !record.title) return null
  return {
    catalogue: coerceDateMap(record.catalogue),
    form: coerceDateMap(record.form),
    title: coerceDateMap(record.title),
  }
}

export function dateWithinLife(
  date: CompositionDate,
  birthYear: number | null,
  deathYear: number | null,
  currentYear = new Date().getFullYear()
): boolean {
  const latest = deathYear != null ? deathYear + 5 : currentYear + 1
  return [date.start, date.end ?? date.start].every(
    (year) => (birthYear == null || year >= birthYear - 3) && year <= latest
  )
}

export function dateFromWikidataPrecision(time: string, precision: number): CompositionDate | null {
  const year = yearFromWikidataTime(time)
  if (year == null || !Number.isInteger(precision)) return null
  if (precision >= 9) return { start: year, end: null, circa: false }
  if (precision === 8 && year % 10 === 0 && year % 100 !== 0) {
    const end = clampYear(year + 9)
    if (end == null) return null
    return { start: year, end, circa: false }
  }
  return null
}

/**
 * Year-precision inception wins. When that value is only a century-like decade,
 * P580/P582 on the same statement can still supply a real year span.
 */
export function dateFromInceptionClaim(
  time: string | null | undefined,
  precision: number | null,
  start: { time: string; precision: number } | null,
  end: { time: string; precision: number } | null
): CompositionDate | null {
  if (time && precision != null) {
    const direct = dateFromWikidataPrecision(time, precision)
    if (direct) return direct
  }
  if (!start || !end || start.precision < 9 || end.precision < 9) return null
  const from = yearFromWikidataTime(start.time)
  const to = yearFromWikidataTime(end.time)
  if (from == null || to == null || to < from || to - from > 30) return null
  return { start: from, end: to === from ? null : to, circa: false }
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

  const hobRe =
    /\bhob(?:oken)?\.?\s*([ivxlcdm]+[a-z]?)\s*(?:[:./]\s*|,\s*(?:nos?|nrs?)\.?\s+)(\d{1,4}[a-z]?)(?:\s*[-–—]\s*(\d{1,4}))?/g
  for (const match of text.matchAll(hobRe)) {
    const number = match[2].toLowerCase()
    if (match[3]) keys.add(`hob:${match[1]}:${number}-${match[3]}`)
    else keys.add(`hob:${match[1]}:${number}`)
  }

  // Hoboken's short form is "H.3/57" (group III, number 57), not Helm "H.24".
  const hobSlashRe = /\bh\.?\s*(\d{1,2})\s*\/\s*(\d{1,4}[a-z]?)(?:\s*[-–—]\s*(\d{1,4}))?/g
  for (const match of text.matchAll(hobSlashRe)) {
    const roman = hobokenRoman(Number(match[1]))
    if (!roman) continue
    const number = match[2].toLowerCase()
    if (match[3]) keys.add(`hob:${roman}:${number}-${match[3]}`)
    else keys.add(`hob:${roman}:${number}`)
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

  const genericRe =
    /\b([a-z]{1,6})\.\s*(\d{1,4}[a-z]?)(?::(\d{1,4}[a-z]?))?(?:\s*-\s*(\d{1,4}[a-z]?))?(?!\/\d)/g
  for (const match of text.matchAll(genericRe)) {
    if (CATALOGUE_SKIP.has(match[1])) continue
    if (match[1] === "hob" || match[1] === "bwv") continue
    const number = match[3] ? `${match[2]}:${match[3]}` : match[2]
    const end = match[3] ? null : match[4]
    keys.add(catalogueKey(match[1], number, null, end))
  }

  // Köchel Anhang, and the revised number after the slash (K.252/240a, K.Anh.95/484b).
  const anhRe = /\bk\.?\s*anh\.?\s*(\d{1,4}[a-z]?)(?:\s*\/\s*(\d{1,4}[a-z]?))?/g
  for (const match of text.matchAll(anhRe)) {
    keys.add(catalogueKey("k.anh", match[1]))
    if (match[2]) keys.add(catalogueKey("k", match[2]))
  }
  const koechelAltRe = /\bk\.?\s*(\d{1,4}[a-z]?)\s*\/\s*(\d{1,4}[a-z]?)/g
  for (const match of text.matchAll(koechelAltRe)) {
    keys.add(catalogueKey("k", match[1]))
    keys.add(catalogueKey("k", match[2]))
  }

  // Warburton numbers as printed by Open Opus: "CW C65", "CW.G6", "CW 36/195", "W.G3".
  const cwRe = /\bcw\.?\s*([a-z])?\s*(\d{1,4}[a-z]{0,4})(?:\s*\/\s*(\d{1,4}[a-z]{0,3}))?/g
  for (const match of text.matchAll(cwRe)) {
    if (match[1] && match[3]) keys.add(`cw:${match[1]}${match[2]}:${match[3]}`)
    else if (match[3]) keys.add(`cw:${match[2]}:${match[3]}`)
    else if (match[1]) keys.add(`cw:${match[1]}${match[2]}`)
    else keys.add(`cw:${match[2]}`)
  }
  const warburtonRe = /\bw\.([a-z])(\d{1,4}[a-z]{0,4})\b/g
  for (const match of text.matchAll(warburtonRe)) {
    keys.add(`w:${match[1]}${match[2]}`)
  }

  return [...keys]
}

const HOB_ROMAN = [
  "",
  "i",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
  "xi",
  "xii",
  "xiii",
  "xiv",
  "xv",
  "xvi",
  "xvii",
  "xviii",
  "xix",
  "xx",
  "xxi",
  "xxii",
  "xxiii",
  "xxiv",
  "xxv",
  "xxvi",
  "xxvii",
  "xxviii",
  "xxix",
  "xxx",
  "xxxi",
  "xxxii",
]

function hobokenRoman(group: number): string | null {
  if (!Number.isInteger(group)) return null
  return HOB_ROMAN[group] ?? null
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

const GENERIC_TITLE = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "major",
  "minor",
  "flat",
  "sharp",
  "no",
  "nr",
  "nos",
  "number",
  "op",
  "opus",
  "symphony",
  "sonata",
  "concerto",
  "quartet",
  "quintet",
  "sextet",
  "trio",
  "mass",
  "requiem",
  "opera",
  "ballet",
  "suite",
  "prelude",
  "fugue",
  "etude",
  "nocturne",
  "waltz",
  "song",
  "songs",
  "aria",
  "overture",
  "cantata",
  "oratorio",
  "motet",
  "chorale",
  "variation",
  "variations",
  "partita",
  "toccata",
  "fantasia",
  "fantasy",
  "rhapsody",
  "serenade",
  "divertimento",
  "minuet",
  "march",
  "piece",
  "pieces",
])

function substantialTitle(value: string): boolean {
  const normalized = normalizeTitle(value)
  if (!normalized || isMovementLabel(value)) return false
  const words = normalized.split(" ").filter(Boolean)
  if (words.length < 2) return false
  return normalized.length >= 12 || /\d/.test(normalized)
}

/** "Asyla, Op. 17" can date the Open Opus title "Asyla". Generic forms cannot. */
function strippedTitleKey(label: string): string | null {
  const full = normalizeTitle(label)
  const stripped = normalizeTitle(stripCatalogueTokens(softNormalize(label)))
  if (!stripped || stripped === full || isMovementLabel(label)) return null
  if (GENERIC_TITLE.has(stripped) || stripped.length < 5) return null
  const words = stripped.split(" ").filter(Boolean)
  if (words.every((word) => GENERIC_TITLE.has(word) || /^\d+$/.test(word))) return null
  return stripped
}

type DateBuckets = Map<string, { standalone: Map<string, CompositionDate>; movement: Map<string, CompositionDate> }>

function dateIdentity(date: CompositionDate): string {
  return `${date.circa ? "c" : "e"}:${date.start}:${date.end ?? ""}`
}

function addDate(map: DateBuckets, key: string, date: CompositionDate, movement: boolean) {
  const bucket = map.get(key) ?? { standalone: new Map<string, CompositionDate>(), movement: new Map() }
  ;(movement ? bucket.movement : bucket.standalone).set(dateIdentity(date), date)
  map.set(key, bucket)
}

function collapse(map: DateBuckets): Record<string, CompositionDate> {
  const out: Record<string, CompositionDate> = {}
  for (const [key, bucket] of map) {
    if (bucket.standalone.size === 1) {
      out[key] = [...bucket.standalone.values()][0]
    } else if (bucket.standalone.size === 0 && bucket.movement.size === 1) {
      out[key] = [...bucket.movement.values()][0]
    }
  }
  return out
}

function compositionDateFromWork(work: DatedWorkLabels): CompositionDate | null {
  const start = clampYear(work.year)
  if (start == null) return null
  let end = work.end == null ? null : clampYear(work.end)
  if (end != null && (end < start || end - start > 30)) return null
  if (end === start) end = null
  return { start, end, circa: work.circa === true }
}

export function buildDateIndex(works: DatedWorkLabels[]): DateIndex {
  const catalogue: DateBuckets = new Map()
  const form: DateBuckets = new Map()
  const title: DateBuckets = new Map()

  for (const work of works) {
    const date = compositionDateFromWork(work)
    if (!date) continue
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
      const stripped = strippedTitleKey(label)
      if (stripped) titleKeys.add(stripped)
    }

    for (const key of catalogueKeys) addDate(catalogue, key, date, movement)
    for (const key of formKeys) addDate(form, key, date, movement)
    for (const key of titleKeys) addDate(title, key, date, movement)
  }

  return suppressDisputedSetKeys({
    catalogue: collapse(catalogue),
    form: collapse(form),
    title: collapse(title),
  })
}

/**
 * "Etudes, op. 10" stays blank when the pieces do not share one year.
 * A parent stays when its numbered children all carry one date, even if that
 * date is not the parent's: the parent may be the whole work (a symphony)
 * rather than a set.
 */
export function suppressDisputedSetKeys(index: DateIndex): DateIndex {
  const catalogue = { ...index.catalogue }
  for (const key of Object.keys(catalogue)) {
    const children = Object.keys(catalogue).filter((child) => child.startsWith(`${key}:`))
    if (children.length < 2) continue
    const shared = dateIdentity(catalogue[children[0]])
    const childrenAgree = children.every((child) => dateIdentity(catalogue[child]) === shared)
    if (!childrenAgree) delete catalogue[key]
  }
  return { catalogue, form: index.form, title: index.title }
}

/** Fill keys that are still blank. An existing year is left as it is. */
export function mergeDateIndexes(base: DateIndex, extra: DateIndex): DateIndex {
  const fill = (kept: Record<string, CompositionDate>, incoming: Record<string, CompositionDate>) => {
    const out = { ...kept }
    for (const [key, date] of Object.entries(incoming)) {
      if (!out[key]) out[key] = date
    }
    return out
  }
  return suppressDisputedSetKeys({
    catalogue: fill(base.catalogue, extra.catalogue),
    form: fill(base.form, extra.form),
    title: fill(base.title, extra.title),
  })
}

/**
 * Combine exact years from one work (two Wikidata inception values, or every
 * number in a catalogue span) into one date. A span wider than 30 years, or a
 * mix of decades and exact years, is left unresolved.
 */
export function mergeExactYears(dates: CompositionDate[]): CompositionDate | null {
  if (!dates.length) return null
  if (dates.some((date) => date.circa || date.end != null)) {
    const identity = dateIdentity(dates[0])
    return dates.every((date) => dateIdentity(date) === identity) ? dates[0] : null
  }
  const start = Math.min(...dates.map((date) => date.start))
  const end = Math.max(...dates.map((date) => date.start))
  if (end - start > 30) return null
  return { start, end: end === start ? null : end, circa: false }
}

function datesFor(keys: string[], table: Record<string, CompositionDate>): CompositionDate[] {
  const found = new Map<string, CompositionDate>()
  for (const key of keys) {
    const date = lookupCatalogueDate(key, table)
    if (date) found.set(dateIdentity(date), date)
  }
  return [...found.values()]
}

/** "BWV 841-843" and "BWV 933-38" date the row only when every number is known. */
function lookupCatalogueDate(key: string, table: Record<string, CompositionDate>): CompositionDate | null {
  if (table[key]) return table[key]
  const parts = expandCatalogueRange(key)
  if (!parts) return null
  const dates: CompositionDate[] = []
  for (const part of parts) {
    const date = table[part]
    if (!date) return null
    dates.push(date)
  }
  return mergeExactYears(dates)
}

function expandCatalogueRange(key: string): string[] | null {
  const match = /^(.*):(\d+)-(\d+)$/.exec(key)
  if (!match) return null
  const prefix = match[1]
  const start = Number(match[2])
  let end = Number(match[3])
  if (end < start && match[3].length < match[2].length) {
    const factor = 10 ** match[3].length
    end = Math.floor(start / factor) * factor + end
    if (end < start) end += factor
  }
  if (end <= start || end - start > 24) return null
  const keys: string[] = []
  for (let number = start; number <= end; number++) keys.push(`${prefix}:${number}`)
  return keys
}

export function matchCompositionYear(
  title: string,
  index: DateIndex,
  extraText?: string | string[] | null
): CompositionDate | null {
  if (extractCatalogueKeys(title).length) return matchOne(title, index)
  const direct = matchOne(title, index)
  if (direct) return direct
  const extras = (Array.isArray(extraText) ? extraText : extraText ? [extraText] : [])
    .flatMap((value) => value.split(/[,;/]/))
    .map((value) => value.trim())
    .filter(Boolean)
  for (const extra of extras) {
    const date = matchOne(extra, index)
    if (date) return date
  }
  return null
}

function matchOne(title: string, index: DateIndex): CompositionDate | null {
  const trimmed = title.trim()
  if (!trimmed) return null

  const catalogueKeys = extractCatalogueKeys(trimmed)
  if (catalogueKeys.length) {
    const dates = datesFor(catalogueKeys, index.catalogue)
    return dates.length === 1 ? dates[0] : null
  }

  const formKey = extractFormKey(trimmed)
  if (formKey && index.form[formKey]) return index.form[formKey]
  // Bach's cantata number is the BWV number. Other catalogues are not implied.
  const cantata = /^cantata:(\d+)$/.exec(formKey ?? "")
  if (cantata && index.catalogue[`bwv:${cantata[1]}`]) return index.catalogue[`bwv:${cantata[1]}`]

  return matchTitle(trimmed, index.title)
}

function allowsTitleExtension(rest: string): boolean {
  if (!rest) return true
  if (/^(?:book|books|part|parts|vol|vols|volume|volumes|no|nos|nr|number|movement|movements)\b/.test(rest)) {
    return false
  }
  return !/^\d/.test(rest)
}

function matchTitle(title: string, table: Record<string, CompositionDate>): CompositionDate | null {
  const normalized = normalizeTitle(title)
  const found = new Map<string, CompositionDate>()
  const add = (date: CompositionDate | undefined) => {
    if (date) found.set(dateIdentity(date), date)
  }
  if (table[normalized]) return table[normalized]
  for (const [key, date] of Object.entries(table)) {
    if (key.length < 12 || key === normalized) continue
    if (normalized.startsWith(`${key} `)) {
      if (allowsTitleExtension(normalized.slice(key.length + 1))) add(date)
    } else if (normalized.endsWith(` ${key}`)) {
      add(date)
    }
  }
  for (const phrase of quotedPhrases(title)) {
    const key = normalizeTitle(phrase)
    if (key.length >= 12) add(table[key])
  }
  if (found.size === 1) return [...found.values()][0]
  return null
}

function quotedPhrases(title: string): string[] {
  return [...title.matchAll(/["“«]([^"”»]{3,})["”»]/g)].map((match) => match[1])
}

const CATALOGUE_KEYWORDS: [RegExp, string][] = [
  [/bach-werke-verzeichnis|\bbwv\b/, "bwv"],
  [/köchel|kochel|koechel|\bkv\b/, "k"],
  [/hoboken|\bhob\b/, "hob"],
  [/ryom-verzeichnis|\brv\b/, "rv"],
  [/handel-werke-verzeichnis|händel-werke-verzeichnis|\bhwv\b/, "hwv"],
  [/telemann-werke-verzeichnis|\btwv\b/, "twv"],
  [/werke ohne opuszahl|\bwoo\b/, "woo"],
  [/deutsch(?:-|\s)verzeichnis|\bdeutsch\b/, "d"],
  [/\bopus\b/, "op"],
]

export function prefixFromCatalogueLabels(label: string, aliases: string[]): string | null {
  const blob = `${label} ${aliases.join(" ")}`.toLowerCase()
  for (const [pattern, prefix] of CATALOGUE_KEYWORDS) {
    if (pattern.test(blob)) return prefix
  }
  const shorts = aliases
    .map((alias) => /^([A-Za-z]{1,5})\.?$/.exec(alias.trim())?.[1]?.toLowerCase() ?? null)
    .filter((token): token is string => Boolean(token && !CATALOGUE_SKIP.has(token)))
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
  return shorts[0] ?? null
}

export function labelsForCatalogueCode(prefix: string | null, code: string): string[] {
  const trimmed = code.trim().replace(/\s+/g, " ")
  if (!trimmed || trimmed.length > 48 || /^\d{5,}$/.test(trimmed)) return []
  const labels: string[] = []
  const own = extractCatalogueKeys(trimmed)
  if (own.length) labels.push(trimmed)
  if (!prefix) return [...new Set(labels)]
  const system = canonSystem(prefix.toLowerCase())
  if (system === "bwv" && /\banh/i.test(trimmed)) {
    labels.push(`BWV ${trimmed.replace(/anh\.?\s*/i, "Anh. ")}`.replace(/\s+/g, " "))
    return [...new Set(labels)]
  }
  if (own.some((key) => key.startsWith(`${system}:`) || key.startsWith(`${system}.`))) return [...new Set(labels)]
  const synthesized = synthesizeCatalogue(system, trimmed)
  if (synthesized && extractCatalogueKeys(synthesized).length) labels.push(synthesized)
  return [...new Set(labels)]
}

/** A label that extractCatalogueKeys turns back into this key. */
export function catalogueKeyLabel(key: string): string | null {
  const pieces = key.split(":")
  if (pieces.length < 2 || pieces.length > 3) return null
  const [system, first, second] = pieces
  if (!first || /[^0-9a-z-]/i.test(first)) return null
  if (second && /[^0-9a-z-]/i.test(second)) return null
  if (system === "op") return second ? `Op. ${first} no. ${second}` : `Op. ${first}`
  if (system === "op.posth") return second ? `Op. posth. ${first} no. ${second}` : `Op. posth. ${first}`
  if (system === "k") return second ? `K. ${first} no. ${second}` : `K. ${first}`
  if (system === "k.anh") return `K.Anh. ${first}`
  if (system === "hob") {
    if (!second) return null
    return `Hob.${first.toUpperCase()}:${second}`
  }
  if (system === "woo") return second ? `WoO ${first} no. ${second}` : `WoO ${first}`
  if (system === "bwv") return second ? `BWV ${first} no. ${second}` : `BWV ${first}`
  if (system === "bwv.anh") return `BWV Anh. ${first}`
  if (system === "cw") {
    if (second) return `CW ${first}/${second}`
    return `CW ${first.toUpperCase()}`
  }
  if (system === "w") return `W.${first.toUpperCase()}`
  if (!/^[a-z]{1,6}$/.test(system)) return null
  const head = `${system.toUpperCase()}. ${first}`
  return second ? `${head} no. ${second}` : head
}

function synthesizeCatalogue(prefix: string, code: string): string | null {
  if (prefix === "op") return `Op. ${code}`
  if (prefix === "k") return `K. ${code}`
  if (prefix === "hob") return `Hob. ${code}`
  if (prefix === "woo") return `WoO ${code}`
  if (prefix === "bwv") return `BWV ${code}`
  if (!/^[a-z]{1,6}$/.test(prefix)) return null
  return `${prefix.toUpperCase()}. ${code}`
}

function stripWiki(value: string): string {
  let text = value.replace(/<!--[\s\S]*?-->/g, " ")
  for (let i = 0; i < 6; i++) {
    const next = text.replace(/\{\{[^{}]*\}\}/g, " ")
    if (next === text) break
    text = next
  }
  text = text.replace(/\[\[([^\[\]|]+)\|([^\[\]]+)\]\]/g, "$2")
  text = text.replace(/\[\[([^\[\]]+)\]\]/g, "$1")
  text = text.replace(/'''?/g, "")
  text = text.replace(/<[^>]+>/g, " ")
  text = text.replace(/&nbsp;|&#\d+;/g, " ")
  return text
}

function stripCatalogueTokens(value: string): string {
  return value.replace(
    /\b(?:opus|op\.?|bwv|hwv|twv|wwv|swv|woo|hoboken|hob\.?|kv|k\.|rv|sz|trv|wab|wq|anh\.?)\s*[0-9][0-9a-z]*(?:\s*[-–—/]\s*[0-9]{1,4}[a-z]?)?/gi,
    " "
  )
}

function yearsIn(body: string): number[] {
  const years: number[] = []
  for (const match of body.matchAll(/\b(\d{3,4})\b/g)) {
    const year = clampYear(Number(match[1]))
    if (year != null) years.push(year)
  }
  return years
}

/**
 * Parse a composition-date phrase from IMSLP or a similar catalogue note.
 * Vague wording ("early 1720s", "before 1740", "?") yields nothing.
 */
export function parseCompositionDateText(raw: string): CompositionDate | null {
  const plain = stripWiki(raw).replace(/\s+/g, " ").trim()
  if (!plain) return null
  const lower = plain.toLowerCase()
  if (/[?]/.test(lower)) return null
  if (/\b(?:unknown|undated|uncertain|various|century|centuries)\b/.test(lower)) return null
  if (/\b(?:early|late|mid|middle|beginning|end)\b/.test(lower)) return null
  if (/\b(?:before|after|until|prior|earlier|later)\b/.test(lower)) return null
  if (/\bby\b/.test(lower)) return null
  if (/\b(?:half|quarter)\b/.test(lower)) return null

  const circa =
    /\b(?:circa|approx(?:imately)?|around|about)\b/.test(lower) ||
    /\bca\.?\s*\d/.test(lower) ||
    /\bc\.?\s*\d/.test(lower) ||
    /\d{3,4}\s*ca\.?\b/.test(lower)

  let body = lower
    .replace(/\b(?:circa|approximately|approx|around|about)\b/g, " ")
    .replace(/\bca\.?/g, " ")
    .replace(/\bc\./g, " ")
  body = stripCatalogueTokens(body).replace(/\s+/g, " ").trim()

  const years: number[] = []
  body = body.replace(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g, (_full, yearText, monthText, dayText) => {
    const year = clampYear(Number(yearText))
    const month = Number(monthText)
    const day = Number(dayText)
    if (year != null && month >= 1 && month <= 12 && day >= 1 && day <= 31) years.push(year)
    return " "
  })

  const decades: number[] = []
  body = body.replace(/\b(\d{3,4})s\b/g, (_full, yearText) => {
    const start = Number(yearText)
    if (start % 10 === 0 && start % 100 !== 0) decades.push(start)
    return " "
  })

  body = body.replace(/\b(\d{3,4})\s*[-–—/]\s*(\d{2,4})\b/g, (_full, startText, endText) => {
    const start = Number(startText)
    let end = Number(endText)
    if (end < 100) {
      end = Math.floor(start / 100) * 100 + end
      if (end < start) end += 100
    }
    const startYear = clampYear(start)
    const endYear = clampYear(end)
    if (startYear != null && endYear != null && endYear >= startYear && endYear - startYear <= 30) {
      years.push(startYear, endYear)
    }
    return " "
  })
  years.push(...yearsIn(body))

  if (decades.length && years.length) return null
  if (decades.length === 1) {
    const end = clampYear(decades[0] + 9)
    if (end == null) return null
    return { start: decades[0], end, circa: false }
  }
  if (decades.length > 1) return null

  const unique = [...new Set(years)].sort((a, b) => a - b)
  if (unique.length === 1) return { start: unique[0], end: null, circa }
  if (unique.length > 1 && unique[unique.length - 1] - unique[0] <= 30) {
    return { start: unique[0], end: unique[unique.length - 1], circa }
  }
  return null
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
