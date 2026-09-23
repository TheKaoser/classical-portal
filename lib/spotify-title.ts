/**
 * Open Opus titles often append a scoring list the way a catalogue does:
 * "Stabat mater, for soloists, chorus, and orchestra". Spotify's track
 * search ANDs every word, and recordings are usually filed as "Stabat Mater",
 * so the extra forces return nothing.
 *
 * The cleaned title keeps the musical name, work numbers, keys, nicknames,
 * and catalogue ids. It drops instrumentation that is only a scoring list.
 * A "for …" phrase that *is* the title stays: "Concerto for Orchestra",
 * "Music for the Royal Fireworks", "Piano Concerto for the Left Hand".
 */

const FUNCTION = new Set([
  "a",
  "an",
  "and",
  "or",
  "the",
  "for",
  "with",
  "of",
  "da",
  "de",
  "di",
  "del",
  "della",
  "et",
  "und",
  "e",
  "ad",
  "al",
  "au",
  "aux",
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "du",
  "on",
  "in",
  "only",
  "adlib",
  "libitum",
])

const ADJECTIVE = new Set([
  "great",
  "grand",
  "small",
  "large",
  "double",
  "military",
  "hunting",
  "mixed",
  "male",
  "female",
  "high",
  "low",
  "solo",
  "childrens",
  "children",
  "descant",
  "concertante",
])

/** Forces, instruments, and ensembles that show up in Open Opus scoring lists. */
const SCORING = new Set([
  "soloist",
  "soloists",
  "soli",
  "chorus",
  "choruses",
  "choir",
  "choirs",
  "choral",
  "choeur",
  "choeurs",
  "coro",
  "voice",
  "voices",
  "voci",
  "soprano",
  "mezzo",
  "alto",
  "contralto",
  "countertenor",
  "tenor",
  "baritone",
  "bass",
  "basses",
  "treble",
  "singer",
  "vocal",
  "orchestra",
  "orchestral",
  "string",
  "strings",
  "violin",
  "violins",
  "viola",
  "violas",
  "violetta",
  "cello",
  "cellos",
  "violoncello",
  "violoncellos",
  "violone",
  "gamba",
  "flute",
  "flutes",
  "flauto",
  "flauti",
  "oboe",
  "oboes",
  "hautbois",
  "clarinet",
  "clarinets",
  "bassoon",
  "bassoons",
  "fagotto",
  "fagotti",
  "horn",
  "horns",
  "corno",
  "corni",
  "trumpet",
  "trumpets",
  "tromba",
  "trombe",
  "trombone",
  "trombones",
  "tuba",
  "tubas",
  "timpani",
  "kettledrum",
  "kettledrums",
  "drum",
  "drums",
  "percussion",
  "celesta",
  "piano",
  "pianos",
  "pianoforte",
  "fortepiano",
  "organ",
  "organs",
  "organo",
  "keyboard",
  "keyboards",
  "harpsichord",
  "harpsichords",
  "cembalo",
  "clavier",
  "klavier",
  "continuo",
  "guitar",
  "guitars",
  "harp",
  "harps",
  "lute",
  "lutes",
  "theorbo",
  "mandolin",
  "saxophone",
  "saxophones",
  "recorder",
  "recorders",
  "piccolo",
  "piccolos",
  "contrabass",
  "contrabasses",
  "ensemble",
  "ensembles",
  "band",
  "bands",
  "brass",
  "wind",
  "winds",
  "woodwind",
  "woodwinds",
  "instrument",
  "instruments",
  "instrumental",
  "part",
  "parts",
  "manual",
  "manuals",
  "pedal",
  "pedals",
  "quartet",
  "quintet",
  "sextet",
  "septet",
  "octet",
  "nonet",
  "trio",
  "cappella",
  "obbligato",
  "ripieno",
])

/**
 * A bare form name is not enough to throw away "Concerto for Orchestra".
 * A work number, key, catalogue, or a real name beside the form is.
 */
const GENERIC_HEAD = new Set([
  "symphony",
  "sinfonia",
  "sinfonie",
  "concerto",
  "concert",
  "concerti",
  "sonata",
  "sonatas",
  "suite",
  "mass",
  "messe",
  "missa",
  "fantasia",
  "fantasie",
  "fantasy",
  "toccata",
  "prelude",
  "fugue",
  "partita",
  "quartet",
  "quintet",
  "trio",
  "music",
  "piece",
  "pieces",
  "work",
  "works",
  "composition",
  "compositions",
  "overture",
  "serenade",
  "divertimento",
  "variation",
  "variations",
  "canon",
  "etude",
  "nocturne",
  "waltz",
  "march",
  "aria",
  "song",
  "songs",
  "lied",
  "lieder",
  "motet",
  "anthem",
  "hymn",
  "chorale",
  "movement",
  "book",
  "number",
  "numbers",
])

const KEY_END =
  /(?:,\s*)?\bin\s+[a-g](?:\s*[-]?\s*(?:flat|sharp))?(?:\s+(?:major|minor|dur|moll))?\s*$/i
const TONE_END = /(?:,\s*)?\bin\s+tone\s+\d+\s*$/i
const NUMBER_END = /(?:,\s*)?\b(?:nos?|nr)\.?\s*\d+[a-z]?(?:\s*[-–—]\s*\d+[a-z]?)?\s*$/i
const NICKNAME_END = /(?:,\s*)?(?:"[^"]{2,80}"|'[^']{2,80}'|“[^”]{2,80}”)\s*$/
const CATALOGUE_END =
  /(?:,\s*)?\b(?:op(?:us)?|bwv|wwv|buxwv|swwv|hwv|twv|woo|kv|hob|rv|sz|qr|trv|lvv|lwv|eg|js|zn|sf|mb|sv|bb)\.?\s*(?:[a-z]{0,8}\s*[/.:-]?\s*)?\d+[a-z0-9]*(?:\s*[-–—]\s*\d+[a-z0-9]*)?\s*$/i
const LETTER_CATALOGUE_END = /(?:,\s*)?\b[A-Z]\.\s*(?:[A-Za-z]+\.?\s*)?\d+[a-z]?(?:\s*[-–—]\s*\d+[a-z]?)?\s*$/

const CATALOGUE_CLAUSE =
  /^(?:op(?:us)?|bwv|wwv|buxwv|swwv|hwv|twv|woo|kv|hob|rv|sz|qr|trv|lvv|lwv|eg|js|zn|sf|mb|sv|bb)\.?\s*[a-z0-9]+(?:[/.:-][a-z0-9]+)*$/i

function tokenKey(word: string): string {
  return word
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function isNumberToken(word: string): boolean {
  const key = tokenKey(word)
  if (!key) return false
  if (/^\d+[a-z]?$/.test(key)) return true
  if (/^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|first|second|third)$/.test(key)) {
    return true
  }
  return /^[ivx]+$/.test(key) && key !== "a"
}

function isScoringToken(word: string): boolean {
  const key = tokenKey(word)
  if (!key) return false
  if (SCORING.has(key)) return true
  if (key.endsWith("es") && SCORING.has(key.slice(0, -2))) return true
  if (key.endsWith("s") && SCORING.has(key.slice(0, -1))) return true
  return false
}

function isFunctionToken(word: string): boolean {
  const key = tokenKey(word)
  return FUNCTION.has(key)
}

function isAdjectiveToken(word: string): boolean {
  return ADJECTIVE.has(tokenKey(word))
}

type WordAnalysis = { scoring: boolean; residue: string }

function analyzeWords(phrase: string): WordAnalysis {
  const residue: string[] = []
  let scoring = false
  for (const word of phrase.split(/\s+/).filter(Boolean)) {
    if (isFunctionToken(word) || isNumberToken(word) || isAdjectiveToken(word)) continue
    if (isScoringToken(word)) {
      scoring = true
      continue
    }
    residue.push(word)
  }
  return { scoring, residue: residue.join(" ") }
}

function isWordApostrophe(value: string, index: number): boolean {
  const char = value[index]
  if (char !== "'" && char !== "’") return false
  const prev = value[index - 1]
  const next = value[index + 1]
  return Boolean(prev && next && /\p{L}/u.test(prev) && /\p{L}/u.test(next))
}

function splitOutsideQuotes(value: string, separator: "," | ";"): string[] {
  const parts: string[] = []
  let current = ""
  let quote: string | null = null
  for (let index = 0; index < value.length; index++) {
    const char = value[index]
    if (quote) {
      current += char
      const closes =
        (quote === '"' && char === '"') ||
        (quote === "“" && char === "”") ||
        (quote === "'" && char === "'" && !isWordApostrophe(value, index)) ||
        (quote === "‘" && (char === "’" || char === "'"))
      if (closes) quote = null
      continue
    }
    if (char === "'" || char === "’") {
      if (isWordApostrophe(value, index)) {
        current += char
        continue
      }
      quote = char === "’" ? "'" : char
      current += char
      continue
    }
    if (char === '"' || char === "“" || char === "‘") {
      quote = char
      current += char
      continue
    }
    if (char === separator) {
      parts.push(current)
      current = ""
      continue
    }
    current += char
  }
  parts.push(current)
  return parts
}

function peelEndKeeper(value: string): { keeper: string; rest: string } | null {
  const patterns = [NICKNAME_END, KEY_END, TONE_END, NUMBER_END, CATALOGUE_END, LETTER_CATALOGUE_END]
  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (!match || match.index == null) continue
    const keeper = match[0].replace(/^,\s*/, "").trim()
    const rest = value.slice(0, match.index).replace(/,\s*$/, "").trim()
    if (!keeper) continue
    return { keeper, rest }
  }
  return null
}

function peelKeepers(value: string): { keepers: string[]; rest: string } {
  const keepers: string[] = []
  let rest = value.trim()
  while (rest) {
    const peeled = peelEndKeeper(rest)
    if (!peeled) break
    keepers.unshift(peeled.keeper)
    rest = peeled.rest.trim()
  }
  return { keepers, rest }
}

function isIdentifierClause(clause: string): boolean {
  const text = clause.trim()
  if (!text) return false
  if (/^["“„«'].+["”»']$/.test(text)) return true
  if (/^in\s+(?:[a-g]\b|tone\b)/i.test(text)) return true
  if (/^(?:nos?|nr)\.?\s*\d/i.test(text)) return true
  if (/^bwv\.?\s*deest$/i.test(text)) return true
  if (CATALOGUE_CLAUSE.test(text.replace(/\s+/g, " "))) return true
  if (/^[A-Z]\.\s*\S/.test(text) && /\d/.test(text) && text.split(/\s+/).length <= 4) return true
  return false
}

function hasIdentifier(text: string): boolean {
  if (/\b(?:nos?|nr|op(?:us)?|bwv|hwv|twv|woo|kv|hob)\b/i.test(text)) return true
  if (/\d/.test(text)) return true
  if (/\bin\s+[a-g]\b/i.test(text)) return true
  return false
}

function isGenericHead(text: string): boolean {
  const words = text.split(/\s+/).map(tokenKey).filter(Boolean)
  if (!words.length) return true
  return words.every((word) => GENERIC_HEAD.has(word) || FUNCTION.has(word) || /^\d+$/.test(word))
}

function isNumberedNoun(clause: string): boolean {
  return /^(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+\p{L}+$/iu.test(
    clause.trim()
  )
}

function stripLeadingListWord(clause: string): string {
  return clause.replace(/^(?:and|or|&)\s+/i, "").trim()
}

/**
 * A comma-clause that is only a scoring list. Identifying tail matter
 * (key, opus, "no. 3") is returned so it can stay in the search title.
 * Unknown words such as "left hand" stay too; they are the piece, not the forces.
 */
function reduceScoringClause(clause: string): { matched: boolean; text: string } {
  const leading = /^(?:for|with)\b/i.test(clause.trim())
  const body = clause.replace(/^(?:for|with)\b/i, "").trim()
  const { keepers, rest } = peelKeepers(stripLeadingListWord(body))
  const analysis = analyzeWords(rest)
  if (!leading || !analysis.scoring) return { matched: false, text: clause.trim() }
  // "left hand" is the piece. A longer leftover ("taped bird songs") is still
  // catalogue prose, and the opening clause is searched on its own.
  const residueWords = analysis.residue.split(/\s+/).filter(Boolean)
  const residue = residueWords.length > 0 && residueWords.length <= 2 ? analysis.residue : ""
  const text = [residue, ...keepers].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
  return { matched: true, text }
}

function stripInlineScoring(clause: string): string | null {
  const re = /\b(?:for|with)\b/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(clause))) {
    const before = clause.slice(0, match.index).trim()
    const after = clause.slice(match.index + match[0].length).trim()
    const { keepers, rest } = peelKeepers(after)
    const analysis = analyzeWords(rest)
    if (!analysis.scoring) continue
    const headIdentifies = hasIdentifier(before) || !isGenericHead(before)
    // "Concerto for Orchestra" — the ensemble is the whole title.
    if (!headIdentifies && keepers.length === 0 && !analysis.residue) continue
    const text = [before, analysis.residue, ...keepers].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
    if (!text || text.toLowerCase() === clause.trim().toLowerCase()) continue
    return text
  }
  return null
}

function splitMovementSuffix(clause: string): { body: string; suffix: string } {
  const match = clause.match(/:\s+\S/)
  if (!match || match.index == null) return { body: clause.trim(), suffix: "" }
  return {
    body: clause.slice(0, match.index).trim(),
    suffix: clause.slice(match.index).trim(),
  }
}

function joinSuffix(body: string, suffix: string): string {
  if (!body) return suffix
  if (!suffix) return body
  return `${body} ${suffix}`.replace(/\s+/g, " ").trim()
}

function cleanTitlePiece(piece: string): string {
  const clauses = splitOutsideQuotes(piece, ",")
    .map((clause) => clause.trim())
    .filter(Boolean)
  const kept: string[] = []
  let inList = false

  for (const clause of clauses) {
    const { body, suffix } = splitMovementSuffix(clause)
    if (!body && suffix) {
      kept.push(suffix)
      inList = false
      continue
    }

    if (inList && !isIdentifierClause(body)) {
      // "2 Tboes" is still the instrument list, even when the noun is misspelled.
      if (isNumberedNoun(body)) continue
      const asList = /^(?:for|with)\b/i.test(body) ? body : `for ${stripLeadingListWord(body)}`
      const reduced = reduceScoringClause(asList)
      const residue = analyzeWords(peelKeepers(stripLeadingListWord(body.replace(/^(?:for|with)\b/i, ""))).rest).residue
      // A leftover name ("Chorus of the Hebrew Slaves") ends the list.
      // A pure force list ("and orchestra", "2 violins") does not.
      if (reduced.matched && !residue) {
        if (reduced.text) kept.push(joinSuffix(reduced.text, suffix))
        continue
      }
      inList = false
    }

    if (isIdentifierClause(body) && inList) inList = false

    const leading = reduceScoringClause(body)
    if (leading.matched) {
      if (leading.text) kept.push(joinSuffix(leading.text, suffix))
      inList = true
      continue
    }

    const inline = stripInlineScoring(body)
    if (inline != null) {
      if (inline) kept.push(joinSuffix(inline, suffix))
      inList = true
      continue
    }

    if (body) kept.push(joinSuffix(body, suffix))
    inList = false
  }

  return kept.join(", ")
}

function collapseTitle(value: string): string {
  return value
    .replace(/\s+,/g, ",")
    .replace(/(?:,\s*){2,}/g, ", ")
    .replace(/\s+;/g, ";")
    .replace(/;\s*/g, "; ")
    .replace(/\s+:\s+/g, ": ")
    .replace(/\s+/g, " ")
    .replace(/^(?:[,;\s]+)|(?:[,;\s]+)$/g, "")
    .trim()
}

/** Title used for Spotify search and for title-overlap matching. */
export function cleanSpotifySearchTitle(title: string): string {
  const withoutAsides = title.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ")
  const pieces = splitOutsideQuotes(withoutAsides, ";").map((piece) => cleanTitlePiece(piece))
  const cleaned = collapseTitle(pieces.filter(Boolean).join("; "))
  if (cleaned) return cleaned
  return collapseTitle(withoutAsides)
}

function stripKeyPhrases(title: string): string {
  return collapseTitle(
    title.replace(/\bin\s+[a-g](?:\s*[-]?\s*(?:flat|sharp))?(?:\s+(?:major|minor|dur|moll))?\b/gi, " ")
  )
}

function toSearchText(title: string): string {
  return title.replace(/[,:;]+/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * Queries to try, most specific first. A key or a leftover scoring residue
 * can make Spotify return nothing, so a shorter fallback follows.
 */
export function spotifyTitleQueryVariants(title: string): string[] {
  const cleaned = cleanSpotifySearchTitle(title)
  const variants = [cleaned]
  const core = cleaned.split(/[,;]/)[0]?.trim() ?? ""
  if (core && core.length >= 3) variants.push(core)
  const loose = stripKeyPhrases(cleaned)
  if (loose) variants.push(loose)
  const looseCore = core ? stripKeyPhrases(core) : ""
  if (looseCore) variants.push(looseCore)

  const seen = new Set<string>()
  const queries: string[] = []
  for (const variant of variants) {
    const text = toSearchText(variant)
    const key = text.toLowerCase()
    if (text.length < 3 || seen.has(key)) continue
    seen.add(key)
    queries.push(text)
  }
  return queries
}
