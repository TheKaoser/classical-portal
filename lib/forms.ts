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
 * order. The genres page sorts forms by how many works Open Opus marks popular.
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
    blurb: "Sonatas, including trio sonatas.",
    pattern: /\bsonatas?\b/,
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

export function formFromSlug(slug: string): WorkForm | undefined {
  return bySlug.get(slug)
}

export function foldFormText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function matchForm(text: string): string | null {
  const folded = foldFormText(text)
  if (!folded) return null
  for (const form of WORK_FORMS) {
    if (form.pattern.test(folded)) return form.slug
  }
  return null
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
