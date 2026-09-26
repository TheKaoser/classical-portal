/**
 * Open Opus stores only five genres on each work: Chamber, Keyboard,
 * Orchestral, Stage, and Vocal. Finer forms (symphony, sonata, opera, …)
 * are not a separate field. These patterns were checked against the public
 * work dump (`/work/dump.json`) and local `data/form-works.json`.
 *
 * The Open Opus genre picks the genre page. The title, then the subtitle,
 * only picks the chip on that page. A form is listed in a group only when
 * the work's Open Opus genre is one that group accepts:
 * Keyboard requires Keyboard; Orchestral requires Orchestral; Chamber
 * requires Chamber; Choral requires Vocal (Stage as well, for oratorios);
 * Stage requires Stage. Concert overtures (Orchestral) are an Orchestral
 * chip; opera overtures (Stage) stay on Stage. The same title word can
 * therefore be a different page: a Chamber suite or partita is Chamber, a
 * Keyboard suite is Keyboard, an orchestral waltz or variation is Orchestral.
 * Concertos, sonatas, and songs stay their own pages whatever Open Opus says.
 *
 * Title wins over subtitle so a cantata whose subtitle says "Opera" stays a
 * cantata, while "Carmen" with subtitle "Opera" still lands in Operas.
 * Patterns run on accent-folded text, so "Étude" matches Etudes.
 *
 * Many operas are proper names only ("Carmen", "Il barbiere di Siviglia") and
 * Open Opus leaves their subtitle blank. Those Stage works are filed under
 * Operas unless the title marks them as a film score or incidental music.
 * A few unlabeled ballets end up there for the same reason.
 *
 * Order is match priority (specific forms before broader ones), not display
 * order. The genres page sorts forms by how many works are popular, counting
 * either the Open Opus `popular` or `recommended` flag.
 *
 * Trios, quartets, quintets, sextets, septets, octets, nonets, and instrumental
 * duos are Chamber, along with chamber suites, partitas, serenades, divertimenti,
 * and overtures. A trio sonata (including "sonata en trio" and "sonata a 3")
 * is a trio, not a sonata, so it is not listed under Sonatas. Requiems, masses,
 * oratorios, motets, cantatas, passions, Stabat Mater, Magnificat, and Te Deum
 * are Choral. Nocturnes, etudes, and the other character pieces, together with
 * preludes, fugues, toccatas, partitas, fantasias, variations, and keyboard
 * suites, are Keyboard when Open Opus says Keyboard. Piano, harpsichord, and
 * organ are not chips on that page and not separate genres. Sonata and concerto
 * pages still split by instrument. There the title's instrument wins (piano,
 * pianoforte, harpsichord, cembalo, clavier, organ). Clavier or Klavier is
 * harpsichord for Medieval, Renaissance, and Baroque composers and piano after
 * that. A title with no keyboard instrument uses that same era split. Organ is
 * used only when the title or subtitle names the organ. Symphonies, orchestral
 * suites, serenades, divertimenti, concert overtures, symphonic poems, and
 * orchestral variations, preludes, rhapsodies, waltzes, and mazurkas are
 * Orchestral. A sextet, septet, octet, nonet, or duo is recognized only when
 * that word is the form named before any other form, so "Sextet for string
 * quartet" is a sextet, "suite for wind sextet" stays a suite, and "Octet for
 * string sextet" is an octet.
 */

export type WorkForm = {
  slug: string
  name: string
  blurb: string
  pattern: RegExp
}

export const WORK_FORMS: WorkForm[] = [
  {
    slug: "requiem",
    name: "Requiems",
    blurb: "Requiems, including requiem masses.",
    pattern: /\brequiems?\b/,
  },
  {
    slug: "stabat-mater",
    name: "Stabat Mater",
    blurb: "Settings of the Stabat Mater.",
    pattern: /\bstabat maters?\b/,
  },
  {
    slug: "magnificat",
    name: "Magnificats",
    blurb: "Magnificat settings.",
    pattern: /\bmagnificats?\b/,
  },
  {
    slug: "te-deum",
    name: "Te Deum",
    blurb: "Te Deum settings.",
    pattern: /\bte deums?\b/,
  },
  {
    slug: "passion",
    name: "Passions",
    blurb: "Passions, including St Matthew and St John.",
    pattern:
      /\b(?:(?:st\.?|saint)\s+[a-z]+,?\s+passion|passion according\b|brockes passion|(?:johannes|matthaus|matthaeus|marcus|markus|lucas|lukas)-passion)\b/,
  },
  {
    slug: "cantata",
    name: "Cantatas",
    blurb: "Cantatas and Kantaten.",
    pattern: /\b(cantatas?|kantaten?)\b/,
  },
  {
    slug: "oratorio",
    name: "Oratorios",
    blurb: "Oratorios.",
    pattern: /\boratorios?\b/,
  },
  {
    slug: "mass",
    name: "Masses",
    blurb: "Masses, including Missa and Messe settings.",
    pattern: /\b(masses|mass|messe|messen|missa)\b/,
  },
  {
    slug: "motet",
    name: "Motets",
    blurb: "Motets.",
    pattern: /\bmotets?\b/,
  },
  {
    slug: "nocturne",
    name: "Nocturnes",
    blurb: "Nocturnes.",
    pattern: /\bnocturnes?\b/,
  },
  {
    slug: "etude",
    name: "Etudes",
    blurb: "Etudes.",
    pattern: /\betudes?\b/,
  },
  {
    slug: "mazurka",
    name: "Mazurkas",
    blurb: "Mazurkas.",
    pattern: /\bmazurkas?\b/,
  },
  {
    slug: "waltz",
    name: "Waltzes",
    blurb: "Waltzes, valses, and Walzer.",
    pattern: /\b(waltzes|waltz|valses|valse|walzer)\b/,
  },
  {
    slug: "polonaise",
    name: "Polonaises",
    blurb: "Polonaises.",
    pattern: /\bpolonaises?\b/,
  },
  {
    slug: "impromptu",
    name: "Impromptus",
    blurb: "Impromptus.",
    pattern: /\bimpromptus?\b/,
  },
  {
    slug: "ballade",
    name: "Ballades",
    blurb: "Ballades.",
    pattern: /\bballades?\b/,
  },
  {
    slug: "rhapsody",
    name: "Rhapsodies",
    blurb: "Rhapsodies.",
    pattern: /\brhapsod(?:y|ie|ies)\b/,
  },
  {
    slug: "concerto",
    name: "Concertos",
    blurb: "Concertos, including concerti grossi and sinfonie concertanti.",
    pattern: /\b(concertos?|concerti|concertante)\b/,
  },
  {
    slug: "sonata",
    name: "Sonatas",
    blurb: "Sonatas, other than trios.",
    pattern: /\bsonatas?\b/,
  },
  {
    slug: "nonet",
    name: "Nonets",
    blurb: "Nonets.",
    pattern: /\bnonets?\b/,
  },
  {
    slug: "octet",
    name: "Octets",
    blurb: "Octets.",
    pattern: /\boctets?\b/,
  },
  {
    slug: "septet",
    name: "Septets",
    blurb: "Septets.",
    pattern: /\bseptets?\b/,
  },
  {
    slug: "duo",
    name: "Duos",
    blurb: "Instrumental duos and duets.",
    pattern: /\b(?:duos?|duettos?|duetti|duette|duetts?|duets?)\b/,
  },
  {
    slug: "sextet",
    name: "Sextets",
    blurb: "Sextets.",
    pattern: /\bsextets?\b/,
  },
  {
    slug: "quartet",
    name: "Quartets",
    blurb: "String, piano, and other quartets.",
    pattern: /\bquartets?\b/,
  },
  {
    slug: "quintet",
    name: "Quintets",
    blurb: "Quintets.",
    pattern: /\bquintets?\b/,
  },
  {
    slug: "trio",
    name: "Trios",
    blurb: "Trios.",
    pattern: /\btrios?\b/,
  },
  {
    slug: "symphonic-poem",
    name: "Symphonic Poems",
    blurb: "Symphonic poems, tone poems, and Tondichtungen.",
    pattern: /\b(?:symphonic poems?|tone poems?|tondichtung(?:en)?|poemes? symphoniques?)\b/,
  },
  {
    slug: "symphony",
    name: "Symphonies",
    blurb: "Symphonies and sinfonias.",
    pattern: /\b(symphon(?:y|ie)s?|sinfonias?)\b/,
  },
  {
    slug: "suite",
    name: "Suites",
    blurb: "Suites, including suites drawn from operas.",
    pattern: /\bsuites?\b/,
  },
  {
    slug: "opera",
    name: "Operas",
    blurb: "Operas, including stage works with no more specific form.",
    pattern: /\boperas?\b/,
  },
  {
    slug: "ballet",
    name: "Ballets",
    blurb: "Ballets, including stage works subtitled Ballet.",
    pattern: /\bballets?\b/,
  },
  {
    slug: "overture",
    name: "Overtures",
    blurb: "Overtures and ouvertures.",
    pattern: /\b(overtures?|ouvertures?)\b/,
  },
  {
    slug: "prelude",
    name: "Preludes",
    blurb: "Preludes, including prelude and fugue pairs.",
    pattern: /\bpreludes?\b/,
  },
  {
    slug: "fugue",
    name: "Fugues",
    blurb: "Fugues.",
    pattern: /\bfugues?\b/,
  },
  {
    slug: "toccata",
    name: "Toccatas",
    blurb: "Toccatas.",
    pattern: /\btoccatas?\b/,
  },
  {
    slug: "partita",
    name: "Partitas",
    blurb: "Partitas.",
    pattern: /\bpartitas?\b/,
  },
  {
    slug: "fantasia",
    name: "Fantasias",
    blurb: "Fantasias, fantasies, and fantaisies.",
    pattern: /\b(fantasias?|fantasies|fantaisies?)\b/,
  },
  {
    slug: "variations",
    name: "Variations",
    blurb: "Variation sets.",
    pattern: /\bvariations?\b/,
  },
  {
    slug: "serenade",
    name: "Serenades",
    blurb: "Serenades.",
    pattern: /\bserenades?\b/,
  },
  {
    slug: "divertimento",
    name: "Divertimenti",
    blurb: "Divertimenti.",
    pattern: /\bdivertiment[oi]\b/,
  },
  {
    slug: "scherzo",
    name: "Scherzos",
    blurb: "Scherzos.",
    pattern: /\b(scherzos?|scherzi)\b/,
  },
  {
    slug: "song",
    name: "Songs",
    blurb: "Song cycles, Lieder, and collections titled Songs.",
    pattern: /\b(?<!bird\s)songs\b|\b(lieder|liederkreis|song cycles?)\b/,
  },
]

const bySlug = new Map(WORK_FORMS.map((form) => [form.slug, form]))

export type KeyboardInstrument = "piano" | "harpsichord" | "organ"

/** Character pieces listed on Keyboard. */
export const CHARACTER_PIECES = [
  "nocturne",
  "etude",
  "mazurka",
  "waltz",
  "polonaise",
  "impromptu",
  "ballade",
  "rhapsody",
  "scherzo",
] as const

/** Forms that used to be the separate Baroque keyboard genre. */
export const BAROQUE_KEYBOARD_FORMS = [
  "prelude",
  "fugue",
  "toccata",
  "partita",
  "fantasia",
  "variations",
] as const

/** Chip order on Keyboard: character pieces, then the former Baroque keyboard forms. */
export const KEYBOARD_FORMS = [...CHARACTER_PIECES, ...BAROQUE_KEYBOARD_FORMS] as const

const KEYBOARD_FORM_SLUGS = new Set<string>(KEYBOARD_FORMS)

/**
 * Retired instrument names. Not chips on Keyboard and not top-level genres.
 * Old URLs still open Keyboard; a real form chip in the query is kept.
 */
export const KEYBOARD_INSTRUMENTS: readonly { slug: KeyboardInstrument; label: string }[] = [
  { slug: "piano", label: "Piano" },
  { slug: "harpsichord", label: "Harpsichord" },
  { slug: "organ", label: "Organ" },
]

/**
 * Paths that used to be their own genre pages. Includes the instrument names
 * the classifier already treats as piano, harpsichord, or organ.
 */
const LEGACY_KEYBOARD_INSTRUMENT_SLUGS: Readonly<Record<string, KeyboardInstrument>> = {
  piano: "piano",
  pianos: "piano",
  pianoforte: "piano",
  pianofortes: "piano",
  fortepiano: "piano",
  fortepianos: "piano",
  harpsichord: "harpsichord",
  harpsichords: "harpsichord",
  cembalo: "harpsichord",
  cembalos: "harpsichord",
  cembali: "harpsichord",
  clavecin: "harpsichord",
  clavecins: "harpsichord",
  organ: "organ",
  organs: "organ",
  orgue: "organ",
  orgues: "organ",
}

export type FormGroup = {
  slug: string
  name: string
  blurb: string
  /** Chip order on the genre page. */
  children: readonly string[]
}

const KEYBOARD_GROUP_FORMS = KEYBOARD_FORMS.flatMap((slug) =>
  slug === "partita" ? [slug, "suite"] : [slug]
)

export const FORM_GROUPS: readonly FormGroup[] = [
  {
    slug: "chamber",
    name: "Chamber",
    blurb: "Trios through nonets, duos, suites, partitas, serenades, and divertimenti.",
    children: [
      "trio",
      "quartet",
      "quintet",
      "sextet",
      "septet",
      "octet",
      "nonet",
      "duo",
      "suite",
      "partita",
      "serenade",
      "divertimento",
      "overture",
    ],
  },
  {
    slug: "choral",
    name: "Choral",
    blurb: "Requiems, masses, oratorios, motets, cantatas, passions, and other sacred choral works.",
    children: [
      "requiem",
      "mass",
      "oratorio",
      "motet",
      "cantata",
      "passion",
      "stabat-mater",
      "magnificat",
      "te-deum",
    ],
  },
  {
    slug: "keyboard",
    name: "Keyboard",
    blurb: "Nocturnes, etudes, preludes, fugues, suites, partitas, fantasias, variations, overtures, and trios.",
    children: [...KEYBOARD_GROUP_FORMS, "overture", "trio"],
  },
  {
    slug: "stage",
    name: "Stage",
    blurb: "Operas, ballets, and overtures.",
    children: ["opera", "ballet", "overture"],
  },
  {
    slug: "orchestral",
    name: "Orchestral",
    blurb: "Symphonies, symphonic poems, suites, overtures, serenades, and orchestral character pieces.",
    children: [
      "symphony",
      "symphonic-poem",
      "suite",
      "overture",
      "serenade",
      "divertimento",
      "variations",
      "prelude",
      "rhapsody",
      "waltz",
      "mazurka",
      "polonaise",
    ],
  },
]

/** Open Opus genres that may list a chip on this page. */
const GROUP_OPEN_OPUS: Record<string, readonly string[]> = {
  chamber: ["Chamber"],
  choral: ["Vocal"],
  keyboard: ["Keyboard"],
  stage: ["Stage"],
  orchestral: ["Orchestral"],
}

/**
 * Historical parent for `/genres/{form}`. Shared chips keep that old URL
 * even when the same form is also listed on another page.
 */
const LEGACY_GROUP_SLUG: Record<string, string> = {
  trio: "chamber",
  suite: "orchestral",
  partita: "keyboard",
  overture: "stage",
  serenade: "orchestral",
  divertimento: "orchestral",
  variations: "keyboard",
  prelude: "keyboard",
  rhapsody: "keyboard",
  waltz: "keyboard",
  mazurka: "keyboard",
}

const STANDALONE_FORMS = new Set(["concerto", "sonata", "song"])

const groupBySlug = new Map(FORM_GROUPS.map((group) => [group.slug, group]))

type FormHome = { group: FormGroup; genres: ReadonlySet<string> }

const homesByForm = new Map<string, FormHome[]>()
for (const group of FORM_GROUPS) {
  const fallback = GROUP_OPEN_OPUS[group.slug] ?? []
  for (const child of group.children) {
    const names =
      child === "oratorio" && group.slug === "choral" ? ["Vocal", "Stage"] : fallback
    const list = homesByForm.get(child) ?? []
    list.push({ group, genres: new Set(names) })
    homesByForm.set(child, list)
  }
}

const groupByChild = new Map<string, FormGroup>()
for (const [form, homes] of homesByForm) {
  const legacySlug = LEGACY_GROUP_SLUG[form]
  const legacy = homes.find((home) => home.group.slug === legacySlug) ?? homes[0]
  if (legacy) groupByChild.set(form, legacy.group)
}

export type CatalogGenre = {
  slug: string
  name: string
  blurb: string
}

export function formFromSlug(slug: string): WorkForm | undefined {
  return bySlug.get(slug)
}

export function groupFromSlug(slug: string): FormGroup | undefined {
  return groupBySlug.get(slug)
}

/** Browse genre that folds this form in, when the form is not its own page. */
export function groupForForm(formSlug: string): FormGroup | undefined {
  return groupByChild.get(formSlug)
}

function canonicalOpenOpusGenre(genre?: string | null): string {
  const folded = (genre ?? "").trim().toLowerCase()
  if (folded === "chamber") return "Chamber"
  if (folded === "keyboard") return "Keyboard"
  if (folded === "orchestral") return "Orchestral"
  if (folded === "stage") return "Stage"
  if (folded === "vocal") return "Vocal"
  return ""
}

/**
 * Genre page for a classified form. Concertos, sonatas, and songs ignore
 * the Open Opus genre. Other forms need a chip on a group that accepts it.
 * With no genre, the historical page is used so older callers keep a home.
 */
export function browsePageForForm(form: string, genre?: string | null): string | null {
  if (STANDALONE_FORMS.has(form)) return form
  const homes = homesByForm.get(form)
  if (!homes?.length) return null
  const openOpus = canonicalOpenOpusGenre(genre)
  if (!openOpus) return groupForForm(form)?.slug ?? null
  return homes.find((home) => home.genres.has(openOpus))?.group.slug ?? null
}

/** Top-level genre page: a group, or a form that was not folded into one. */
export function catalogGenreFromSlug(slug: string): CatalogGenre | undefined {
  const group = groupFromSlug(slug)
  if (group) return group
  const form = formFromSlug(slug)
  if (!form || groupForForm(form.slug)) return undefined
  return form
}

/** Form slugs listed on a top-level genre page. Empty when the slug is not one. */
export function formsForBrowseSlug(slug: string): string[] {
  const group = groupFromSlug(slug)
  if (group) return [...group.children]
  if (catalogGenreFromSlug(slug)) return [slug]
  return []
}

/** Old fine-form URLs send the listener to the parent genre with that chip selected. */
export function relocatedGenreHref(slug: string): string | null {
  const group = groupForForm(slug)
  if (!group) return null
  return `/genres/${group.slug}?filter=${slug}`
}

/** `/genres/baroque-keyboard` now opens Keyboard. A current form chip is kept. */
export function legacyBaroqueKeyboardHref(filter?: string | null): string {
  const chip = (filter ?? "").trim().toLowerCase()
  if (KEYBOARD_FORM_SLUGS.has(chip)) return `/genres/keyboard?filter=${chip}`
  return "/genres/keyboard"
}

/** Former instrument-page slug, when this path should open Keyboard. */
export function legacyKeyboardInstrument(slug: string): KeyboardInstrument | null {
  return LEGACY_KEYBOARD_INSTRUMENT_SLUGS[slug.trim().toLowerCase()] ?? null
}

export function legacyKeyboardInstrumentLabel(slug: string): string | null {
  const instrument = legacyKeyboardInstrument(slug)
  return KEYBOARD_INSTRUMENTS.find((item) => item.slug === instrument)?.label ?? null
}

/**
 * `/genres/piano` (and the other retired instrument slugs) open Keyboard.
 * A filter that is already a Keyboard form chip is kept. An instrument
 * filter is dropped so the URL is not a dead chip.
 */
export function legacyKeyboardInstrumentHref(slug: string, filter?: string | null): string | null {
  const instrument = legacyKeyboardInstrument(slug)
  if (!instrument) return null
  const chip = (filter ?? "").trim().toLowerCase()
  if (KEYBOARD_FORM_SLUGS.has(chip)) return `/genres/keyboard?filter=${chip}`
  return "/genres/keyboard"
}

/** `?filter=piano` (and the other retired instrument chips) opens unfiltered Keyboard. */
export function retiredKeyboardInstrumentFilter(filter?: string | null): boolean {
  return legacyKeyboardInstrument(filter ?? "") != null
}

export function foldFormText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

const byFoldedName = new Map(WORK_FORMS.map((form) => [foldFormText(form.name), form]))

/** Link target for a work tag, or null when it is not a real genre route. */
export function genreHrefForLabel(label: string): string | null {
  const folded = foldFormText(label.trim())
  if (!folded) return null
  if (legacyKeyboardInstrument(folded)) return "/genres/keyboard"
  const form = bySlug.get(folded) ?? byFoldedName.get(folded)
  if (!form) return null
  return relocatedGenreHref(form.slug) ?? `/genres/${form.slug}`
}

/** Ensemble sizes named only when that word is the form, not the scoring. */
const ENSEMBLE_LEAD = new Set(["nonet", "octet", "septet", "sextet", "duo"])

/**
 * "Sextet for string quartet" names the sextet first. "Suite for wind sextet"
 * names the suite first and keeps that form. "Octet for string sextet" is an
 * octet. The earliest such word wins when no other form is named before it.
 */
function leadingEnsemble(folded: string): string | null {
  let best: { slug: string; index: number } | null = null
  for (const slug of ENSEMBLE_LEAD) {
    const form = bySlug.get(slug)
    if (!form) continue
    const match = new RegExp(form.pattern.source).exec(folded)
    if (!match || match.index == null) continue
    const before = folded.slice(0, match.index)
    if (WORK_FORMS.some((other) => !ENSEMBLE_LEAD.has(other.slug) && other.pattern.test(before))) continue
    if ([...ENSEMBLE_LEAD].some((other) => other !== slug && bySlug.get(other)?.pattern.test(before))) continue
    if (slug === "duo") {
      const concerto = bySlug.get("concerto")
      const sonata = bySlug.get("sonata")
      if ((concerto && concerto.pattern.test(folded)) || (sonata && sonata.pattern.test(folded))) continue
    }
    if (!best || match.index < best.index) best = { slug, index: match.index }
  }
  return best?.slug ?? null
}

/**
 * Trio sonatas are chamber trios. "Trio Sonata", "Trio, sonata", "sonata en
 * trio", "Triosonate", and "sonata a 3" all name a trio. A sonata whose
 * subtitle only mentions a trio stays a sonata, because the title is tried
 * on its own first.
 */
function isTrioRatherThanSonata(folded: string): boolean {
  if (/\btriosonat(?:e|en|a|as|es)?\b/.test(folded)) return true
  if (!/\bsonatas?\b/.test(folded)) return false
  if (/\btrios?\b/.test(folded)) return true
  return /\bsonatas?\s+a\s*3\b/.test(folded)
}

function matchForm(text: string): string | null {
  const folded = foldFormText(text)
  if (!folded) return null
  const ensemble = leadingEnsemble(folded)
  if (ensemble) return ensemble
  for (const form of WORK_FORMS) {
    if (ENSEMBLE_LEAD.has(form.slug)) continue
    if (form.slug === "sonata" && isTrioRatherThanSonata(folded)) return "trio"
    if (form.slug === "magnificat" && bySlug.get("fugue")?.pattern.test(folded)) continue
    if (form.slug === "te-deum" && bySlug.get("prelude")?.pattern.test(folded)) continue
    if (form.pattern.test(folded)) return form.slug
  }
  return null
}

const EARLY_EPOCHS = new Set(["Medieval", "Renaissance", "Baroque"])

const KEYBOARD_TAGS: { instrument: KeyboardInstrument | "clavier"; source: string }[] = [
  { instrument: "organ", source: "\\b(?:organs?|orgues?)\\b" },
  { instrument: "harpsichord", source: "\\b(?:harpsichords?|cembalos?|cembali|clavecins?)\\b" },
  { instrument: "piano", source: "\\b(?:fortepianos?|pianofortes?|pianos?)\\b" },
  { instrument: "clavier", source: "\\b(?:claviers?|klavier\\w*)\\b" },
]

export function isEarlyKeyboardEpoch(epoch?: string | null): boolean {
  return EARLY_EPOCHS.has((epoch ?? "").trim())
}

/**
 * Piano, harpsichord, or organ for a sonata or concerto row.
 * The earliest explicit instrument in the title or subtitle wins. Clavier and
 * Klavier follow the composer's era. With no instrument named, Medieval,
 * Renaissance, and Baroque works are harpsichord and later works are piano.
 * An unknown era is piano. Keyboard genre chips do not use this split.
 */
export function classifyKeyboardInstrument(
  title: string,
  subtitle?: string | null,
  epoch?: string | null
): KeyboardInstrument {
  const text = foldFormText(`${title} ${subtitle ?? ""}`)
  let best: { index: number; instrument: KeyboardInstrument | "clavier" } | null = null
  for (const tag of KEYBOARD_TAGS) {
    const re = new RegExp(tag.source, "g")
    for (const match of text.matchAll(re)) {
      if (match.index == null) continue
      if (!best || match.index < best.index) best = { index: match.index, instrument: tag.instrument }
    }
  }
  if (best?.instrument === "clavier") return isEarlyKeyboardEpoch(epoch) ? "harpsichord" : "piano"
  if (best) return best.instrument
  return isEarlyKeyboardEpoch(epoch) ? "harpsichord" : "piano"
}

const LABELED_STAGE = /\b(films?|incidental)\b/

/** Vocal "duo" is not an instrumental duo. A subtitle such as Songs can still match. */
function acceptedForm(form: string, genre?: string | null): boolean {
  if (form === "duo" && canonicalOpenOpusGenre(genre) === "Vocal") return false
  return true
}

export function classifyWork(
  title: string,
  subtitle?: string | null,
  genre?: string | null
): string | null {
  const fromTitle = matchForm(title)
  if (fromTitle && acceptedForm(fromTitle, genre)) return fromTitle
  const fromSubtitle = matchForm(subtitle ?? "")
  if (fromSubtitle && acceptedForm(fromSubtitle, genre)) return fromSubtitle

  // Open Opus often stores an opera as genre Stage with an empty subtitle.
  if ((genre ?? "").trim().toLowerCase() !== "stage") return null
  if ((subtitle ?? "").trim()) return null
  if (LABELED_STAGE.test(foldFormText(title))) return null
  return "opera"
}
