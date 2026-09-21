export type WorkQuery = {
  composerName: string
  composerCompleteName?: string
  title: string
  subtitle?: string
  genre?: string
  catalogue?: string
  catalogueNumber?: string
  additionalNumber?: string
  searchterms?: string[]
  parts?: string[]
}

export type ParsedWork = {
  composerLast: string
  composerFull: string
  form: string | null
  formIsSet: boolean
  workNumber: string | null
  key: string | null
  catalogueLabel: string | null
  catalogueNumber: string | null
  nickname: string | null
  titleNorm: string
  parts: string[]
  partsNorm: string[]
}

export type TrackLike = {
  id: string
  name: string
  uri?: string
  url?: string
  image?: string | null
  artists: string
  album: string
  albumId?: string
  durationMs: number
  previewUrl?: string | null
  trackNumber: number
  discNumber: number
}

export type ScoredTrack = TrackLike & { score: number }

export type RecordingGroup = {
  id: string
  album: string
  albumId: string
  image: string | null
  artists: string
  tracks: ScoredTrack[]
  score: number
}

const FORMS: { canonical: string; pattern: RegExp; set?: boolean }[] = [
  { canonical: "symphony", pattern: /\b(symphon(?:y|ie)s?|sinfonias?)\b/ },
  { canonical: "cantata", pattern: /\b(cantatas?|kantaten?)\b/ },
  { canonical: "nocturne", pattern: /\bnocturnes?\b/, set: true },
  { canonical: "concerto", pattern: /\bconcertos?\b/ },
  { canonical: "sonata", pattern: /\bsonatas?\b/ },
  { canonical: "quartet", pattern: /\bquartets?\b/ },
  { canonical: "quintet", pattern: /\bquintets?\b/ },
  { canonical: "trio", pattern: /\btrios?\b/ },
  { canonical: "mass", pattern: /\b(mass|messe|messen)\b/ },
  { canonical: "requiem", pattern: /\brequiems?\b/ },
  { canonical: "prelude", pattern: /\bpreludes?\b/, set: true },
  { canonical: "etude", pattern: /\b(etudes?|études?)\b/, set: true },
  { canonical: "mazurka", pattern: /\bmazurkas?\b/, set: true },
  { canonical: "waltz", pattern: /\b(waltzes?|valses?)\b/, set: true },
  { canonical: "impromptu", pattern: /\bimpromptus?\b/, set: true },
  { canonical: "ballade", pattern: /\bballades?\b/, set: true },
  { canonical: "polonaise", pattern: /\bpolonaises?\b/, set: true },
  { canonical: "rhapsody", pattern: /\brhapsod(?:y|ies)\b/ },
  { canonical: "overture", pattern: /\b(overtures?|ouvertures?)\b/ },
  { canonical: "suite", pattern: /\bsuites?\b/ },
  { canonical: "partita", pattern: /\bpartitas?\b/ },
  { canonical: "toccata", pattern: /\btoccatas?\b/ },
  { canonical: "fugue", pattern: /\bfugues?\b/ },
  { canonical: "variations", pattern: /\bvariations?\b/ },
  { canonical: "oratorio", pattern: /\boratorios?\b/ },
  { canonical: "motet", pattern: /\bmotets?\b/ },
  { canonical: "lied", pattern: /\b(lied|lieder|songs?)\b/, set: true },
  { canonical: "fantasia", pattern: /\b(fantasias?|fantasies|fantaisies?)\b/ },
  { canonical: "serenade", pattern: /\bserenades?\b/ },
  { canonical: "divertimento", pattern: /\bdivertiment[oi]\b/ },
  { canonical: "scherzo", pattern: /\bscherzos?\b/ },
  { canonical: "bagatelle", pattern: /\bbagatelles?\b/, set: true },
  { canonical: "intermezzo", pattern: /\bintermezzos?\b/, set: true },
  { canonical: "opera", pattern: /\boperas?\b/ },
]

const JUNK =
  /\b(karaoke|remix|nightcore|sped up|slowed|8-?bit|lo-?fi|midi backing|music box version)\b/

const CATALOGUE_ALIASES: Record<string, string> = {
  op: "op",
  opus: "op",
  bwv: "bwv",
  wwv: "wwv",
  k: "k",
  kv: "k",
  koehel: "k",
  d: "d",
  hob: "hob",
  rv: "rv",
  hwv: "hwv",
  twv: "twv",
  woo: "woo",
  b: "b",
  s: "s",
  l: "l",
  sz: "sz",
  bb: "bb",
  h: "h",
}

export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[«»“”]/g, '"')
    .replace(/&/g, " and ")
}

export function normalize(value: string): string {
  return fold(value)
    .replace(/[''`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function soften(value: string): string {
  return fold(value).replace(/[_/,;]/g, " ").replace(/\s+/g, " ").trim()
}

export function normalizeCatalogueLabel(label: string): string | null {
  const key = normalize(label).replace(/\s+/g, "")
  return CATALOGUE_ALIASES[key] ?? (key ? key : null)
}

type CatalogueHit = { label: string; number: string }

function cataloguePattern(label: string): RegExp {
  if (label === "op") return /\b(?:op(?:us)?)\.?\s*(?:posth\.?\s*)?(\d+[a-z]?)/g
  if (label === "k") return /\b(?:k\.?\s*v\.?|kv|k)\.?\s*(\d+[a-z]?)/g
  if (label === "hob") return /\bhob\.?\s*([a-z]{0,4}\s*[:.]?\s*\d+[a-z]?)/g
  if (label === "d") return /\bd\.?\s*(\d{2,4}[a-z]?)/g
  if (label === "b") return /\bb\.?\s*(\d{1,3}[a-z]?)\b/g
  return new RegExp(`\\b${label}\\.?\\s*(\\d+[a-z]?)`, "g")
}

export function extractCatalogues(text: string, allowedLabels?: string[]): CatalogueHit[] {
  const src = soften(text)
  const labels = allowedLabels ?? Object.values(CATALOGUE_ALIASES)
  const unique = [...new Set(labels)]
  const hits: CatalogueHit[] = []

  for (const label of unique) {
    const re = cataloguePattern(label)
    let match: RegExpExecArray | null
    while ((match = re.exec(src))) {
      const number = normalize(match[1] ?? "").replace(/\s+/g, "")
      if (!number) continue
      hits.push({ label, number })
    }
  }
  return hits
}

function extractNickname(title: string): string | null {
  const match = title.match(/"([^"]{3,80})"/) || title.match(/“([^"]{3,80})”/)
  return match?.[1]?.trim() || null
}

function extractKey(text: string): string | null {
  const src = soften(text).replace(/sharp/g, "#").replace(/flat/g, "b")
  const match = src.match(
    /\bin\s+([a-g])(?:[\s-]*(#|b))?\s+(major|minor|dur|moll)\b/
  )
  if (!match) return null
  const note = match[1]
  const acc = match[2] === "#" ? " sharp" : match[2] === "b" ? " flat" : ""
  const quality = match[3] === "dur" ? "major" : match[3] === "moll" ? "minor" : match[3]
  return `${note}${acc} ${quality}`
}

function extractForm(text: string): { form: string; set: boolean } | null {
  const src = soften(text)
  for (const entry of FORMS) {
    if (entry.pattern.test(src)) {
      const plural = new RegExp(`${entry.canonical}s\\b`)
      const numberedSet = /^\s*\d+\s+/.test(src)
      return { form: entry.canonical, set: Boolean(entry.set && (plural.test(src) || numberedSet)) }
    }
  }
  return null
}

function extractWorkNumber(text: string, form: string | null): string | null {
  const src = soften(text)
  const noMatch = src.match(/\b(?:no|nr|nº|n°)\.?\s*(\d{1,3})\b/)
  if (noMatch) return noMatch[1]
  if (form) {
    const ordinal = src.match(new RegExp(`\\b(\\d{1,3})(?:st|nd|rd|th)?\\s+${form}`))
    if (ordinal) return ordinal[1]
    const after = src.match(new RegExp(`\\b${form}\\s*(?:no\\.?\\s*)?(\\d{1,3})\\b`))
    if (after) return after[1]
  }
  return null
}

export function parseWorkParts(parts: WorkQuery["parts"]): string[] {
  return (parts ?? []).map((part) => part.trim()).filter(Boolean)
}

export function parseWork(work: WorkQuery): ParsedWork {
  const title = work.title || ""
  const formHit = extractForm(title)
  const catalogueLabel = work.catalogue ? normalizeCatalogueLabel(work.catalogue) : null
  const catalogueFromTitle = extractCatalogues(title)
  const preferredLabel = catalogueLabel ?? catalogueFromTitle[0]?.label ?? null
  const catalogueNumber =
    (work.catalogueNumber ? normalize(work.catalogueNumber).replace(/\s+/g, "") : null) ||
    catalogueFromTitle.find((hit) => hit.label === preferredLabel)?.number ||
    catalogueFromTitle[0]?.number ||
    null

  const workNumber =
    (work.additionalNumber ? normalize(work.additionalNumber) : null) ||
    extractWorkNumber(title, formHit?.form ?? null)

  const nickname = extractNickname(title)
  const parts = parseWorkParts(work.parts)
  if (work.subtitle) {
    const maybeParts = work.subtitle
      .split(/\s*[;/|]\s*/)
      .map((part) => part.trim())
      .filter((part) => part.length > 8)
    if (maybeParts.length >= 2 && parts.length === 0) parts.push(...maybeParts)
  }

  const formIsSet =
    Boolean(formHit?.set) || /^\s*\d+\s+/.test(title) || /s,\s/i.test(title)

  return {
    composerLast: normalize(work.composerName),
    composerFull: normalize(work.composerCompleteName || work.composerName),
    form: formHit?.form ?? null,
    formIsSet,
    workNumber: formIsSet ? null : workNumber,
    key: extractKey(title),
    catalogueLabel: preferredLabel,
    catalogueNumber,
    nickname: nickname ? normalize(nickname) : null,
    titleNorm: normalize(title),
    parts,
    partsNorm: parts.map(normalize),
  }
}

export function buildSearchQueries(work: WorkQuery, parsed = parseWork(work)): string[] {
  const composer = work.composerCompleteName || work.composerName
  const queries: string[] = []

  if (parsed.catalogueLabel && parsed.catalogueNumber) {
    queries.push(`${composer} ${parsed.catalogueLabel} ${parsed.catalogueNumber}`)
  }
  if (parsed.form && parsed.workNumber) {
    queries.push(`${composer} ${parsed.form} ${parsed.workNumber}`)
  } else if (parsed.form && parsed.catalogueNumber) {
    queries.push(`${composer} ${parsed.form} ${parsed.catalogueLabel ?? ""} ${parsed.catalogueNumber}`.replace(/\s+/g, " "))
  }
  if (parsed.nickname) {
    queries.push(`${composer} "${work.title.match(/"([^"]+)"/)?.[1] ?? parsed.nickname}"`)
  }
  for (const term of work.searchterms ?? []) {
    if (term.trim()) queries.push(`${composer} ${term.trim()}`)
  }
  if (parsed.parts[0]) {
    queries.push(`${composer} ${parsed.parts[0]}`)
  }

  const cleanedTitle = work.title.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim()
  queries.push(`${composer} ${cleanedTitle}`)

  const seen = new Set<string>()
  return queries
    .map((query) => query.replace(/\s+/g, " ").trim())
    .filter((query) => {
      const key = query.toLowerCase()
      if (!query || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 4)
}

function composerPresent(parsed: ParsedWork, haystack: string): boolean {
  if (!parsed.composerLast) return false
  if (!haystack.includes(parsed.composerLast)) return false

  const otherBach =
    /\b(c\.?\s*p\.?\s*e\.?|carl philipp|w\.?\s*f\.?|wilhelm friedemann|j\.?\s*c\.?|johann christian)\b/.test(
      haystack
    )
  if (parsed.composerFull.includes("johann sebastian") && otherBach) {
    return /\b(johann sebastian|j\.?\s*s\.?|js bach)\b/.test(haystack)
  }
  return true
}

function numbersEqual(a: string, b: string): boolean {
  return a.replace(/^0+/, "") === b.replace(/^0+/, "")
}

function conflictingCatalogue(parsed: ParsedWork, trackName: string): boolean {
  if (!parsed.catalogueLabel || !parsed.catalogueNumber) return false
  const hits = extractCatalogues(trackName, [parsed.catalogueLabel])
  if (!hits.length) return false
  return !hits.some((hit) => numbersEqual(hit.number, parsed.catalogueNumber!))
}

function conflictingWorkNumber(parsed: ParsedWork, trackName: string): boolean {
  if (!parsed.form || !parsed.workNumber || parsed.formIsSet) return false
  const src = soften(trackName)
  const formRe = FORMS.find((entry) => entry.canonical === parsed.form)?.pattern
  if (!formRe) return false
  if (!formRe.test(src)) return false
  const found = extractWorkNumber(trackName, parsed.form)
  if (!found) return false
  return !numbersEqual(found, parsed.workNumber)
}

function matchingCatalogue(parsed: ParsedWork, trackName: string): boolean {
  if (!parsed.catalogueLabel || !parsed.catalogueNumber) return false
  return extractCatalogues(trackName, [parsed.catalogueLabel]).some((hit) =>
    numbersEqual(hit.number, parsed.catalogueNumber!)
  )
}

function tokenOverlap(a: string, b: string): number {
  const stop = new Set(["in", "and", "the", "for", "from", "with", "no", "op", "major", "minor"])
  const aTokens = a.split(" ").filter((token) => token.length > 2 && !stop.has(token))
  if (!aTokens.length) return 0
  const bSet = new Set(b.split(" "))
  const hits = aTokens.filter((token) => bSet.has(token)).length
  return hits / aTokens.length
}

export function scoreTrack(track: TrackLike, parsed: ParsedWork): number {
  const trackName = track.name || ""
  const artists = track.artists || ""
  const identity = soften(`${trackName} ${artists}`)
  const identityNorm = normalize(`${trackName} ${artists}`)
  const composerHaystack = soften(`${trackName} ${artists} ${track.album || ""}`)

  if (!trackName || JUNK.test(identity)) return -1
  const composerOnTrack = composerPresent(parsed, identity)
  const composerAnywhere = composerPresent(parsed, composerHaystack)
  if (!composerAnywhere) return -1
  if (conflictingCatalogue(parsed, trackName)) return -1
  if (conflictingWorkNumber(parsed, trackName)) return -1

  let score = 0
  const hasCatalogue = matchingCatalogue(parsed, trackName)
  if (hasCatalogue) score += 40

  if (parsed.form && new RegExp(`\\b${parsed.form}`).test(identity)) score += 12
  if (parsed.form && parsed.workNumber) {
    const found = extractWorkNumber(trackName, parsed.form)
    if (found && numbersEqual(found, parsed.workNumber)) score += 24
  }

  if (parsed.key && identity.includes(parsed.key)) score += 8
  if (parsed.nickname && identityNorm.includes(parsed.nickname)) score += 22

  const overlap = tokenOverlap(parsed.titleNorm, normalize(trackName))
  score += Math.round(overlap * 16)

  if (parsed.partsNorm.length) {
    const trackNorm = normalize(trackName)
    if (parsed.partsNorm.some((part) => part && (trackNorm.includes(part) || tokenOverlap(part, trackNorm) > 0.6))) {
      score += 18
    }
  }

  if (parsed.composerLast && normalize(artists).includes(parsed.composerLast)) score += 8

  const required =
    hasCatalogue ||
    Boolean(parsed.form && parsed.workNumber && extractWorkNumber(trackName, parsed.form) === parsed.workNumber) ||
    Boolean(parsed.nickname && identityNorm.includes(parsed.nickname)) ||
    overlap >= 0.55 ||
    parsed.partsNorm.some((part) => part && normalize(trackName).includes(part))

  if (!required) return -1
  if (!composerOnTrack && !hasCatalogue && !(parsed.nickname && identityNorm.includes(parsed.nickname))) {
    return -1
  }
  if (score < MATCH_THRESHOLD) return -1
  return score
}

export const MATCH_THRESHOLD = 20

export function trackStem(name: string): string {
  return normalize(name.split(/:\s*(?=[IVXLC0-9]|[A-Z][a-z])/)[0] ?? name)
}

function sameRecordingStem(a: string, b: string): boolean {
  const left = trackStem(a)
  const right = trackStem(b)
  if (!left || !right) return false
  return left === right || left.startsWith(right) || right.startsWith(left) || tokenOverlap(left, right) >= 0.7
}

export function clusterTracks(tracks: ScoredTrack[]): RecordingGroup[] {
  const byAlbum = new Map<string, ScoredTrack[]>()
  for (const track of tracks) {
    const albumId = track.albumId || track.album || track.id
    const list = byAlbum.get(albumId) ?? []
    list.push(track)
    byAlbum.set(albumId, list)
  }

  const groups: RecordingGroup[] = []

  for (const [albumId, albumTracks] of byAlbum) {
    const unique = new Map<string, ScoredTrack>()
    for (const track of albumTracks) {
      const prev = unique.get(track.id)
      if (!prev || track.score > prev.score) unique.set(track.id, track)
    }

    const ordered = [...unique.values()].sort(
      (a, b) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber || a.name.localeCompare(b.name)
    )

    let current: ScoredTrack[] = []
    const pushCurrent = () => {
      if (!current.length) return
      const first = current[0]
      const artists =
        current.map((track) => track.artists).sort((a, b) => b.length - a.length)[0] || first.artists
      const score =
        Math.max(...current.map((track) => track.score)) + Math.min(12, (current.length - 1) * 3)
      groups.push({
        id: `${albumId}:${first.id}`,
        album: first.album,
        albumId,
        image: first.image ?? null,
        artists,
        tracks: current,
        score,
      })
      current = []
    }

    for (const track of ordered) {
      const prev = current[current.length - 1]
      const consecutive =
        prev &&
        prev.discNumber === track.discNumber &&
        track.trackNumber - prev.trackNumber <= 2 &&
        sameRecordingStem(prev.name, track.name)
      if (!prev || consecutive) {
        if (prev && track.trackNumber - prev.trackNumber === 2) {
          // gap of one track: keep the cluster only when stems already match
        }
        current.push(track)
      } else {
        pushCurrent()
        current.push(track)
      }
    }
    pushCurrent()
  }

  return groups.sort((a, b) => b.score - a.score || b.tracks.length - a.tracks.length)
}

function looksLikeBareMovement(name: string): boolean {
  const trimmed = name.trim()
  return /^[IVXLC]+\.\s+\S/.test(trimmed) || /^\d+\.\s+[A-Za-z]/.test(trimmed)
}

export function fillAlbumGaps(albumTracks: TrackLike[], matched: ScoredTrack[], parsed: ParsedWork): ScoredTrack[] {
  if (!matched.length) return []
  const matchedIds = new Set(matched.map((track) => track.id))
  const byKey = new Map(albumTracks.map((track) => [`${track.discNumber}:${track.trackNumber}`, track]))
  const extra: ScoredTrack[] = [...matched]

  const ordered = [...matched].sort(
    (a, b) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber
  )

  for (let i = 0; i < ordered.length - 1; i++) {
    const left = ordered[i]
    const right = ordered[i + 1]
    if (left.discNumber !== right.discNumber) continue
    if (right.trackNumber - left.trackNumber !== 2) continue
    const middle = byKey.get(`${left.discNumber}:${left.trackNumber + 1}`)
    if (!middle || matchedIds.has(middle.id)) continue
    if (
      !sameRecordingStem(left.name, middle.name) &&
      !sameRecordingStem(middle.name, right.name) &&
      !looksLikeBareMovement(middle.name)
    ) {
      continue
    }
    const score = scoreTrack(middle, parsed)
    extra.push({ ...middle, score: score > 0 ? score : Math.min(left.score, right.score) - 1 })
    matchedIds.add(middle.id)
  }

  for (const seed of matched) {
    for (const delta of [-1, 1]) {
      const neighbor = byKey.get(`${seed.discNumber}:${seed.trackNumber + delta}`)
      if (!neighbor || matchedIds.has(neighbor.id)) continue
      const related = sameRecordingStem(seed.name, neighbor.name) || matchingCatalogue(parsed, neighbor.name)
      if (!related) continue
      const score = scoreTrack(neighbor, parsed)
      extra.push({ ...neighbor, score: score > 0 ? score : seed.score - 2 })
      matchedIds.add(neighbor.id)
    }
  }

  return extra
}
