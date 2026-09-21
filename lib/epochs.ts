export type Epoch = {
  slug: string
  name: string
  years: string
  blurb: string
}

export const EPOCHS: Epoch[] = [
  {
    slug: "medieval",
    name: "Medieval",
    years: "c. 500–1400",
    blurb: "Chant, polyphony, and the first notated Western repertory.",
  },
  {
    slug: "renaissance",
    name: "Renaissance",
    years: "c. 1400–1600",
    blurb: "Masses, motets, and secular song in imitative counterpoint.",
  },
  {
    slug: "baroque",
    name: "Baroque",
    years: "c. 1600–1750",
    blurb: "Opera, concerto, and the high art of the figured bass.",
  },
  {
    slug: "classical",
    name: "Classical",
    years: "c. 1750–1820",
    blurb: "Symphony, sonata, and string quartet in balanced form.",
  },
  {
    slug: "early-romantic",
    name: "Early Romantic",
    years: "c. 1800–1850",
    blurb: "Beethoven through Chopin — the personal and the poetic.",
  },
  {
    slug: "romantic",
    name: "Romantic",
    years: "c. 1820–1910",
    blurb: "Expanded orchestra, character piece, and national voice.",
  },
  {
    slug: "late-romantic",
    name: "Late Romantic",
    years: "c. 1850–1920",
    blurb: "Post-Wagnerian richness, late symphony, and fin-de-siècle song.",
  },
  {
    slug: "20th-century",
    name: "20th Century",
    years: "c. 1900–1975",
    blurb: "Modernism, neoclassicism, and new harmonic languages.",
  },
  {
    slug: "post-war",
    name: "Post-War",
    years: "c. 1945–2000",
    blurb: "Serialism, spectral music, minimalism, and the avant-garde.",
  },
  {
    slug: "21st-century",
    name: "21st Century",
    years: "2000–",
    blurb: "Living composers writing for the concert hall today.",
  },
]

const bySlug = new Map(EPOCHS.map((epoch) => [epoch.slug, epoch]))
const byName = new Map(EPOCHS.map((epoch) => [epoch.name, epoch]))

export function epochFromSlug(slug: string): Epoch | undefined {
  return bySlug.get(slug)
}

export function epochFromName(name: string): Epoch | undefined {
  return byName.get(name)
}

export function epochHref(name: string): string {
  return `/periods/${epochFromName(name)?.slug ?? encodeURIComponent(name.toLowerCase())}`
}
