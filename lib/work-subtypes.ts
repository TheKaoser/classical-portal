/**
 * Open Opus has no instrument field. The style guide puts the soloist or
 * ensemble in the title (`Piano Concerto`, `String Quartet`) and uses the
 * subtitle for a `for …` line only when the title does not already say it
 * (`For violin, viola and orchestra`). Continuo and the ripieno strings that
 * follow a named soloist are the accompanying body, not extra soloists.
 *
 * A form with fewer than two groups of at least eight works gets no selector.
 */

import composerEpochs from "../data/composer-epochs.json" with { type: "json" }
import { classifyKeyboardInstrument, foldFormText, formFromSlug, groupForForm } from "./forms.ts"

export type WorkSubtype = {
  slug: string
  label: string
}

type Term = WorkSubtype & { source: string }

const MIN_COUNT = 8
const MIN_GROUPS = 2

const TERMS: Term[] = [
  { slug: "double-bass", label: "Double bass", source: "\\b(?:double basses|double bass|contrabasses|contrabass)\\b" },
  { slug: "oboe", label: "Oboe", source: "\\boboes? d'?amore\\b" },
  { slug: "viola-damore", label: "Viola d'amore", source: "\\bviolas? d'?amore\\b" },
  { slug: "english-horn", label: "English horn", source: "\\b(?:english horns?|cor anglais)\\b" },
  { slug: "bass-clarinet", label: "Bass clarinet", source: "\\bbass clarinets?\\b" },
  { slug: "basset-horn", label: "Basset horn", source: "\\bbasset horns?\\b" },
  { slug: "viola-da-gamba", label: "Viola da gamba", source: "\\bviolas? da gamba\\b" },
  { slug: "harpsichord", label: "Harpsichord", source: "\\b(?:harpsichords?|cembalos?|clavecins?)\\b" },
  { slug: "piano", label: "Piano", source: "\\b(?:fortepianos?|pianofortes?|pianos?)\\b" },
  { slug: "violin", label: "Violin", source: "\\b(?:violins?|violini|violino|violons?)\\b" },
  { slug: "cello", label: "Cello", source: "\\b(?:violoncellos?|violoncelle|cellos?)\\b" },
  { slug: "viola", label: "Viola", source: "\\bviolas?\\b" },
  { slug: "flute", label: "Flute", source: "\\b(?:flutes?|flauti|flauto)\\b" },
  { slug: "piccolo", label: "Piccolo", source: "\\bpiccolos?\\b" },
  { slug: "oboe", label: "Oboe", source: "\\b(?:oboes?|hautbois)\\b" },
  { slug: "clarinet", label: "Clarinet", source: "\\b(?:clarinets?|clarinettes?)\\b" },
  { slug: "bassoon", label: "Bassoon", source: "\\b(?:bassoons?|fagotti|fagotto)\\b" },
  { slug: "trumpet", label: "Trumpet", source: "\\b(?:trumpets?|trompettes?|trombe|tromba)\\b" },
  { slug: "trombone", label: "Trombone", source: "\\btrombones?\\b" },
  { slug: "horn", label: "Horn", source: "\\bfrench horns?\\b" },
  { slug: "horn", label: "Horn", source: "\\b(?:horns?|cornos?|corni)\\b" },
  { slug: "organ", label: "Organ", source: "\\b(?:organs?|orgues?)\\b" },
  { slug: "guitar", label: "Guitar", source: "\\b(?:guitars?|guitares?)\\b" },
  { slug: "harp", label: "Harp", source: "\\b(?:harps?|harpes?)\\b" },
  { slug: "recorder", label: "Recorder", source: "\\brecorders?\\b" },
  { slug: "saxophone", label: "Saxophone", source: "\\bsaxophones?\\b" },
  { slug: "mandolin", label: "Mandolin", source: "\\bmandolins?\\b" },
  { slug: "lute", label: "Lute", source: "\\blutes?\\b" },
  { slug: "keyboard", label: "Keyboard", source: "\\b(?:keyboards?|claviers?)\\b" },
  { slug: "baryton", label: "Baryton", source: "\\bbarytons?\\b" },
  { slug: "timpani", label: "Timpani", source: "\\btimpani\\b" },
  { slug: "harmonica", label: "Harmonica", source: "\\bharmonicas?\\b" },
  { slug: "tuba", label: "Tuba", source: "\\btubas?\\b" },
]

const ENSEMBLES: Term[] = [
  { slug: "woodwind", label: "Woodwind", source: "\\bwoodwinds?\\b" },
  { slug: "string", label: "String", source: "\\bstrings?\\b" },
  { slug: "wind", label: "Wind", source: "\\bwinds?\\b" },
  { slug: "brass", label: "Brass", source: "\\bbrass\\b" },
  { slug: "orchestral", label: "Orchestral", source: "\\borchestral\\b" },
  { slug: "vocal", label: "Vocal", source: "\\bvocal\\b" },
]

const TRIO: WorkSubtype = { slug: "trio", label: "Trio sonata" }
const GROSSO: WorkSubtype = { slug: "grosso", label: "Concerto grosso" }
const MULTIPLE: WorkSubtype = { slug: "multiple", label: "Multiple" }
const CHAMBER: WorkSubtype = { slug: "chamber", label: "Chamber" }
const KEYBOARD: WorkSubtype = { slug: "keyboard", label: "Keyboard" }
const STRING: WorkSubtype = { slug: "string", label: "String" }
const WIND: WorkSubtype = { slug: "wind", label: "Wind" }
const BRASS: WorkSubtype = { slug: "brass", label: "Brass" }

const STRINGS = new Set(["violin", "viola", "cello", "double-bass", "viola-da-gamba"])
const WOODWINDS = new Set([
  "flute",
  "oboe",
  "clarinet",
  "bassoon",
  "english-horn",
  "piccolo",
  "recorder",
  "saxophone",
  "bass-clarinet",
])
const BRASS_INSTRUMENTS = new Set(["horn", "trumpet", "trombone", "tuba", "basset-horn"])
const SONATA_ACCOMPANIMENT = new Set(["piano", "harpsichord", "keyboard"])

const DISPLAY_ORDER = [
  "piano",
  "harpsichord",
  "organ",
  "violin",
  "viola",
  "cello",
  "double-bass",
  "flute",
  "oboe",
  "clarinet",
  "bassoon",
  "horn",
  "english-horn",
  "trumpet",
  "trombone",
  "tuba",
  "harp",
  "guitar",
  "lute",
  "mandolin",
  "saxophone",
  "recorder",
  "piccolo",
  "baryton",
  "timpani",
  "harmonica",
  "viola-damore",
  "viola-da-gamba",
  "bass-clarinet",
  "basset-horn",
  "string",
  "wind",
  "woodwind",
  "brass",
  "vocal",
  "orchestral",
  "trio",
  "grosso",
  "multiple",
  "chamber",
]

const orderIndex = new Map(DISPLAY_ORDER.map((slug, index) => [slug, index]))

type TaggedWork = {
  form: string
  title: string
  subtitle?: string | null
  genre?: string | null
  composerId?: string | null
  epoch?: string | null
}

const epochs = composerEpochs as Record<string, string>

const PIANO: WorkSubtype = { slug: "piano", label: "Piano" }
const HARPSICHORD: WorkSubtype = { slug: "harpsichord", label: "Harpsichord" }
const ORGAN: WorkSubtype = { slug: "organ", label: "Organ" }

export function classifyWorkSubtype(work: TaggedWork): WorkSubtype | null {
  return concreteKeyboard(unmappedSubtype(work), work)
}

/**
 * "Keyboard" and "clavier" are not chips next to Piano and Harpsichord.
 * The same era split used for character pieces picks Piano, Harpsichord, or Organ.
 */
function concreteKeyboard(subtype: WorkSubtype | null, work: TaggedWork): WorkSubtype | null {
  if (subtype?.slug !== "keyboard") return subtype
  const epoch = work.epoch?.trim() || (work.composerId ? epochs[work.composerId] : null) || null
  const instrument = classifyKeyboardInstrument(work.title, work.subtitle, epoch)
  if (instrument === "organ") return ORGAN
  if (instrument === "harpsichord") return HARPSICHORD
  return PIANO
}

function unmappedSubtype(work: TaggedWork): WorkSubtype | null {
  if (work.form === "concerto") return concertoSubtype(work.title, work.subtitle)
  if (work.form === "sonata") return sonataSubtype(work.title, work.subtitle, work.genre)
  if (work.form === "quartet" || work.form === "quintet" || work.form === "trio") {
    return ensembleSubtype(work.form, work.title, work.subtitle)
  }
  if (work.form === "suite" || work.form === "partita") {
    return titledInstrument(work.title, work.subtitle, [...ENSEMBLES, ...TERMS])
  }
  return null
}

/** Chip on a genre page: a folded form (Trios, Masses, …) or an instrument. */
export function classifyListedSubtype(work: TaggedWork): WorkSubtype | null {
  const grouped = groupedFormChip(work.form)
  if (grouped) return grouped
  return classifyWorkSubtype(work)
}

export function listedSubtypeFilters<T extends TaggedWork>(works: T[]): Array<WorkSubtype & { count: number }> {
  if (works.some((work) => groupForForm(work.form))) return groupedFormFilters(works)
  return subtypeFilters(works)
}

function groupedFormChip(formSlug: string): WorkSubtype | null {
  if (!groupForForm(formSlug)) return null
  const form = formFromSlug(formSlug)
  return form ? { slug: form.slug, label: form.name } : null
}

function groupedFormFilters<T extends TaggedWork>(works: T[]): Array<WorkSubtype & { count: number }> {
  const counts = new Map<string, WorkSubtype & { count: number }>()
  let group: ReturnType<typeof groupForForm> | undefined
  for (const work of works) {
    const parent = groupForForm(work.form)
    if (!parent) continue
    group = parent
    const chip = groupedFormChip(work.form)
    if (!chip) continue
    const row = counts.get(chip.slug) ?? { ...chip, count: 0 }
    row.count += 1
    counts.set(chip.slug, row)
  }

  const options = (group?.children ?? [])
    .map((slug) => counts.get(slug))
    .filter((row): row is WorkSubtype & { count: number } => Boolean(row && row.count >= MIN_COUNT))
  if (options.length < MIN_GROUPS) return []
  return options
}

export function subtypeFilters<T extends TaggedWork>(works: T[]): Array<WorkSubtype & { count: number }> {
  const counts = new Map<string, WorkSubtype & { count: number }>()
  for (const work of works) {
    const subtype = classifyWorkSubtype(work)
    if (!subtype) continue
    const row = counts.get(subtype.slug) ?? { ...subtype, count: 0 }
    row.count += 1
    counts.set(subtype.slug, row)
  }

  const options = [...counts.values()].filter((row) => row.count >= MIN_COUNT)
  if (options.length < MIN_GROUPS) return []

  return options.sort(
    (a, b) =>
      (orderIndex.get(a.slug) ?? DISPLAY_ORDER.length) - (orderIndex.get(b.slug) ?? DISPLAY_ORDER.length) ||
      b.count - a.count ||
      a.label.localeCompare(b.label)
  )
}

/** Keeps the incoming order, which genre pages set from Spotify popularity. */
export function filterWorksBySubtype<T extends { subtype: string | null }>(works: T[], slug: string): T[] {
  if (!slug || slug === "all") return works
  return works.filter((work) => work.subtype === slug)
}

function concertoSubtype(title: string, subtitle?: string | null): WorkSubtype | null {
  const text = normalize(title)
  if (/\b(?:concerti grossi|concerto grosso)\b/.test(text)) return GROSSO
  if (/\bchamber concertos?\b/.test(text)) return CHAMBER
  if (/\b(?:sacred|chorale) concertos?\b/.test(text) || /\b(?:voices|chorus|soprano)\b/.test(text)) return null

  const prefixed = instrumentBefore(text, /\b(?:concertos?|concerti)\b/, TERMS)
  if (prefixed) return prefixed

  const soloists = soloistsFrom(text)
  const chosen = soloists.length ? soloists : soloistsFrom(normalize(subtitle ?? ""))
  if (chosen.length === 1) return chosen[0]
  if (chosen.length > 3 && !/\b(?:concertante|double concertos?|triple concertos?)\b/.test(text)) return null
  if (chosen.length > 1) return MULTIPLE
  return null
}

function sonataSubtype(title: string, subtitle?: string | null, genre?: string | null): WorkSubtype | null {
  const text = normalize(title)
  if (/\btrio sonatas?\b/.test(text)) return TRIO

  const prefixed = instrumentBefore(text, /\bsonatas?\b/, TERMS)
  if (prefixed) return prefixed

  const featured = sonataFeature(text) ?? sonataFeature(normalize(subtitle ?? ""))
  if (featured) return featured

  const named = findTerms(normalize(`${title} ${subtitle ?? ""}`), TERMS)
  if (!named.length && (genre ?? "").trim().toLowerCase() === "keyboard") return KEYBOARD
  return null
}

function ensembleSubtype(form: string, title: string, subtitle?: string | null): WorkSubtype | null {
  const pattern = form === "quartet" ? /\bquartets?\b/ : form === "quintet" ? /\bquintets?\b/ : /\btrios?\b/
  const lexicon = [...ENSEMBLES, ...TERMS]
  const prefixed = instrumentBefore(normalize(title), pattern, lexicon)
  if (prefixed) return prefixed

  const fromTitle = ensembleFromClause(normalize(title))
  if (fromTitle) return fromTitle
  return ensembleFromClause(normalize(subtitle ?? ""))
}

function titledInstrument(title: string, subtitle: string | null | undefined, lexicon: Term[]): WorkSubtype | null {
  const text = normalize(title)
  const pattern = /\b(?:suites?|partitas?)\b/
  const prefixed = instrumentBefore(text, pattern, lexicon)
  if (prefixed) return prefixed
  const featured = sonataFeature(text) ?? sonataFeature(normalize(subtitle ?? ""))
  return featured
}

function soloistsFrom(text: string): WorkSubtype[] {
  const clause = forClause(text)
  if (!clause) return []
  if (/\bsolo\b/.test(clause)) {
    const after = clause.split(/\bsolo\b/).slice(1).join(" ")
    const first = findTerms(after, TERMS)[0]
    return first ? [first] : []
  }

  const found = uniqueTerms(findTerms(clause, TERMS))
  if (!found.length) return []

  // "for oboe, 2 violins, viola, cello and continuo": the winds named
  // before the string body are the soloists. A string choir with continuo
  // and no other soloist is a string concerto, not a violin concerto.
  const ripieno = /\b(?:continuos?|strings|orchestra)\b/.test(clause)
  if (ripieno && !STRINGS.has(found[0].slug)) {
    const solos: WorkSubtype[] = []
    const seen = new Set<string>()
    for (const term of found) {
      if (STRINGS.has(term.slug)) break
      if (seen.has(term.slug)) continue
      seen.add(term.slug)
      solos.push(term)
    }
    if (solos.length) return solos
  }

  // "for violin, strings and continuo" names one soloist. A continuo
  // group of several string parts is the orchestra ("2 violins, viola
  // and continuo"). Two string soloists with orchestra ("violin, viola
  // and orchestra") stay separate so a sinfonia concertante is not filed
  // as a string concerto.
  if (ripieno && found.every((term) => STRINGS.has(term.slug))) {
    if (found.length === 1) return found
    if (found.length >= 3 || (found.length >= 2 && /\bcontinuos?\b/.test(clause))) return [STRING]
  }
  return found
}

function sonataFeature(text: string): WorkSubtype | null {
  const clause = forClause(text)
  if (!clause) return null
  if (/\bsolo\b/.test(clause)) {
    const after = clause.split(/\bsolo\b/).slice(1).join(" ")
    return findTerms(after, TERMS)[0] ?? null
  }
  let found = uniqueTerms(findTerms(clause, TERMS))
  if (found.some((term) => !SONATA_ACCOMPANIMENT.has(term.slug))) {
    found = found.filter((term) => !SONATA_ACCOMPANIMENT.has(term.slug))
  }
  if (/\b(?:orchestra|chorus|choir)\b/.test(clause) && found.every((term) => SONATA_ACCOMPANIMENT.has(term.slug))) {
    return null
  }
  if (found.length === 1) return found[0]
  return null
}

function ensembleFromClause(text: string): WorkSubtype | null {
  const clause = forClause(text)
  if (!clause) return null
  const found = uniqueTerms(findTerms(clause, TERMS))
  if (!found.length) return null
  if (found.every((term) => STRINGS.has(term.slug))) return STRING

  const wood = found.filter((term) => WOODWINDS.has(term.slug)).length
  const brass = found.filter((term) => BRASS_INSTRUMENTS.has(term.slug)).length
  const windsOnly = found.every((term) => WOODWINDS.has(term.slug) || BRASS_INSTRUMENTS.has(term.slug))
  if (windsOnly && found.length >= 3) {
    if (wood && !brass) return { slug: "woodwind", label: "Woodwind" }
    if (brass && !wood) return BRASS
    return WIND
  }

  return found.find((term) => !STRINGS.has(term.slug)) ?? null
}

function instrumentBefore(text: string, form: RegExp, lexicon: Term[]): WorkSubtype | null {
  const match = form.exec(text)
  if (!match || match.index === 0) return null
  const before = text.slice(0, match.index).trim().split(/\s+/).slice(-4).join(" ")
  return termEnding(before, lexicon)
}

function forClause(text: string): string | null {
  const match = /\b(?:for|pour|fur)\b\s+(.+)/.exec(text)
  if (!match) return null
  let rest = match[1]
  rest = rest.split(/\b(?:op\.|opus|bwv|rv|hwv|twv|hob|woo)\b/)[0]
  rest = rest.split(/\bin\s+[a-g](?:\s|-)?(?:flat|sharp)?\b/)[0]
  return rest.trim()
}

function termEnding(text: string, lexicon: Term[]): WorkSubtype | null {
  const folded = text.trim()
  if (!folded) return null
  let best: { term: Term; start: number } | null = null
  for (const term of lexicon) {
    const re = new RegExp(term.source, "g")
    for (const match of folded.matchAll(re)) {
      if (match.index == null) continue
      if (match.index + match[0].length !== folded.length) continue
      if (!best || match.index < best.start) best = { term, start: match.index }
    }
  }
  return best ? { slug: best.term.slug, label: best.term.label } : null
}

function findTerms(text: string, lexicon: Term[]): WorkSubtype[] {
  const hits: { index: number; length: number; term: Term }[] = []
  for (const term of lexicon) {
    const re = new RegExp(term.source, "g")
    for (const match of text.matchAll(re)) {
      if (match.index == null) continue
      hits.push({ index: match.index, length: match[0].length, term })
    }
  }
  hits.sort((a, b) => a.index - b.index || b.length - a.length)
  const kept: WorkSubtype[] = []
  let cursor = -1
  for (const hit of hits) {
    if (hit.index < cursor) continue
    kept.push({ slug: hit.term.slug, label: hit.term.label })
    cursor = hit.index + hit.length
  }
  return kept
}

function uniqueTerms(terms: WorkSubtype[]): WorkSubtype[] {
  const seen = new Set<string>()
  const unique: WorkSubtype[] = []
  for (const term of terms) {
    if (seen.has(term.slug)) continue
    seen.add(term.slug)
    unique.push(term)
  }
  return unique
}

function normalize(value: string): string {
  return foldFormText(value)
    .replace(/[\u2019\u2018']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}
