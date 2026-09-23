/**
 * Open Opus stores only five genres on each work: Chamber, Keyboard,
 * Orchestral, Stage, and Vocal. Finer forms (symphony, sonata, opera, …)
 * are not a separate field. These patterns were checked against the public
 * work dump (`/work/dump.json`) and assign one form per work from the title,
 * then the subtitle if the title has no form.
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
 * Trios, quartets, quintets, and sextets are one Chamber genre. A trio sonata
 * (including "sonata en trio" and "sonata a 3") is a trio, not a sonata, so
 * it is not listed under Sonatas. Requiems, masses, oratorios, motets, and
 * cantatas are one Choral genre. Nocturnes, etudes, and the other character
 * pieces are split by keyboard instrument into Piano, Harpsichord, and Organ.
 * The title's instrument wins (piano, pianoforte, harpsichord, cembalo,
 * clavier, organ). Clavier or Klavier is harpsichord for Medieval,
 * Renaissance, and Baroque composers and piano after that. A title with no
 * keyboard instrument uses that same era split. Operas, ballets, and
 * overtures are Stage. Symphonies, suites, serenades, and divertimenti are
 * Orchestral. Preludes, fugues, toccatas, partitas, fantasias, and variations
 * are Baroque keyboard. Concertos, sonatas, and songs stay their own pages.
 * The finer form stays on the work and becomes a filter chip, the way
 * concertos split by instrument. A sextet is recognized only when that word
 * is the form named before any other form, so "Sextet for string quartet" is
 * a sextet and "suite for wind sextet" stays a suite.
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

/** Character pieces that used to share the Keyboard genre. */
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

export type FormGroup = {
  slug: string
  name: string
  blurb: string
  /** Chip order on the genre page. */
  children: readonly string[]
  /**
   * When set, the page lists only the character pieces for this instrument.
   * The same forms can sit on Piano, Harpsichord, and Organ.
   */
  instrument?: KeyboardInstrument
}

export const FORM_GROUPS: readonly FormGroup[] = [
  {
    slug: "chamber",
    name: "Chamber",
    blurb: "Trios, quartets, quintets, and sextets.",
    children: ["trio", "quartet", "quintet", "sextet"],
  },
  {
    slug: "choral",
    name: "Choral",
    blurb: "Requiems, masses, oratorios, motets, and cantatas.",
    children: ["requiem", "mass", "oratorio", "motet", "cantata"],
  },
  {
    slug: "piano",
    name: "Piano",
    blurb: "Nocturnes, etudes, mazurkas, waltzes, and the other character pieces for piano.",
    children: CHARACTER_PIECES,
    instrument: "piano",
  },
  {
    slug: "harpsichord",
    name: "Harpsichord",
    blurb: "Character pieces for harpsichord, including earlier keyboard works with no instrument named.",
    children: CHARACTER_PIECES,
    instrument: "harpsichord",
  },
  {
    slug: "organ",
    name: "Organ",
    blurb: "Character pieces whose title names the organ.",
    children: CHARACTER_PIECES,
    instrument: "organ",
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
    blurb: "Symphonies, suites, serenades, and divertimenti.",
    children: ["symphony", "suite", "serenade", "divertimento"],
  },
  {
    slug: "baroque-keyboard",
    name: "Baroque keyboard",
    blurb: "Preludes, fugues, toccatas, partitas, fantasias, and variations.",
    children: ["prelude", "fugue", "toccata", "partita", "fantasia", "variations"],
  },
]

const groupBySlug = new Map(FORM_GROUPS.map((group) => [group.slug, group]))
const groupByChild = new Map<string, FormGroup>()
for (const group of FORM_GROUPS) {
  // Piano is the redirect parent for a shared character piece. Harpsichord
  // and Organ list the same forms but only their own works.
  if (group.instrument && group.instrument !== "piano") continue
  for (const child of group.children) {
    if (!groupByChild.has(child)) groupByChild.set(child, group)
  }
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

/** `/genres/keyboard` and its chips now open Piano. The query filter is kept when it is a chip slug. */
export function legacyKeyboardHref(filter?: string | null): string {
  const chip = (filter ?? "").trim()
  if (chip && /^[a-z0-9-]+$/.test(chip)) return `/genres/piano?filter=${chip}`
  return "/genres/piano"
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
  const form = bySlug.get(folded) ?? byFoldedName.get(folded)
  if (!form) return null
  return relocatedGenreHref(form.slug) ?? `/genres/${form.slug}`
}

const LARGER_ENSEMBLE = /\b(?:septets?|octets?|nonets?)\b/

/**
 * "Sextet for string quartet" names the sextet first. "Suite for wind sextet"
 * names the suite first and keeps that form. An octet that merely uses a
 * string sextet is not a sextet.
 */
function sextetLeads(folded: string): boolean {
  const sextet = bySlug.get("sextet")
  if (!sextet) return false
  const match = new RegExp(sextet.pattern.source).exec(folded)
  if (!match || match.index == null) return false
  const before = folded.slice(0, match.index)
  if (LARGER_ENSEMBLE.test(before)) return false
  return !WORK_FORMS.some((form) => form.slug !== "sextet" && form.pattern.test(before))
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
  if (sextetLeads(folded)) return "sextet"
  for (const form of WORK_FORMS) {
    if (form.slug === "sextet") continue
    if (form.slug === "sonata" && isTrioRatherThanSonata(folded)) return "trio"
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
 * Piano, harpsichord, or organ for a character piece.
 * The earliest explicit instrument in the title or subtitle wins. Clavier and
 * Klavier follow the composer's era. With no instrument named, Medieval,
 * Renaissance, and Baroque works are harpsichord and later works are piano.
 * An unknown era is piano.
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

export function classifyWork(
  title: string,
  subtitle?: string | null,
  genre?: string | null
): string | null {
  const fromTitle = matchForm(title)
  if (fromTitle) return fromTitle
  const fromSubtitle = matchForm(subtitle ?? "")
  if (fromSubtitle) return fromSubtitle

  // Open Opus often stores an opera as genre Stage with an empty subtitle.
  if ((genre ?? "").trim().toLowerCase() !== "stage") return null
  if ((subtitle ?? "").trim()) return null
  if (LABELED_STAGE.test(foldFormText(title))) return null
  return "opera"
}
