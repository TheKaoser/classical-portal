export type EpochSource = {
  /** Chip slug on the period page. */
  slug: string
  label: string
  /** Open Opus `epoch` string. */
  name: string
}

export type Epoch = {
  slug: string
  name: string
  years: string
  blurb: string
  /**
   * Open Opus epochs folded into this period. The period page merges them
   * and offers one chip per source. Absent means the period name is the
   * Open Opus epoch.
   */
  sources?: readonly EpochSource[]
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
    slug: "romantic",
    name: "Romantic",
    years: "c. 1800–1920",
    blurb: "From the personal and poetic through the expanded orchestra to the late symphony.",
    sources: [
      { slug: "early", label: "Early", name: "Early Romantic" },
      { slug: "romantic", label: "Romantic", name: "Romantic" },
      { slug: "late", label: "Late", name: "Late Romantic" },
    ],
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

/** Old top-level period slugs that now select a Romantic chip. */
const LEGACY_EPOCH_FILTERS: Record<string, string> = {
  "early-romantic": "early",
  "late-romantic": "late",
}

const bySlug = new Map(EPOCHS.map((epoch) => [epoch.slug, epoch]))
const byName = new Map(EPOCHS.map((epoch) => [epoch.name, epoch]))

export function epochFromSlug(slug: string): Epoch | undefined {
  return bySlug.get(slug)
}

export function epochFromName(name: string): Epoch | undefined {
  const direct = byName.get(name)
  if (direct) return direct
  return EPOCHS.find((epoch) => epoch.sources?.some((source) => source.name === name))
}

/** Open Opus epoch strings for one browse period, in chip order. */
export function openOpusEpochNamesFor(epoch: Epoch): string[] {
  return epoch.sources?.map((source) => source.name) ?? [epoch.name]
}

/** Every Open Opus epoch the catalog still fetches, including folded Romantic eras. */
export function openOpusEpochNames(): string[] {
  return EPOCHS.flatMap((epoch) => openOpusEpochNamesFor(epoch))
}

export function legacyEpochName(slug: string): string | undefined {
  const filter = LEGACY_EPOCH_FILTERS[slug]
  if (!filter) return undefined
  return epochFromSlug("romantic")?.sources?.find((source) => source.slug === filter)?.name
}

/** Old Early/Late Romantic URLs open the unified period with that chip selected. */
export function relocatedEpochHref(slug: string): string | null {
  const filter = LEGACY_EPOCH_FILTERS[slug]
  if (!filter) return null
  const romantic = epochFromSlug("romantic")
  if (!romantic?.sources?.some((source) => source.slug === filter)) return null
  return `/periods/${romantic.slug}?filter=${filter}`
}

export function epochHref(name: string): string {
  const trimmed = name.trim()
  for (const epoch of EPOCHS) {
    const source = epoch.sources?.find((item) => item.name === trimmed)
    if (source) return `/periods/${epoch.slug}?filter=${source.slug}`
  }
  const epoch = epochFromName(trimmed)
  if (epoch) return `/periods/${epoch.slug}`
  return `/periods/${encodeURIComponent(trimmed.toLowerCase())}`
}
