import type { Metadata } from "next"
import type { CompositionDate } from "./composition-label.ts"
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "./site.ts"

export const DESCRIPTION_MAX = 160

export function absoluteUrl(path: string): string {
  if (path === "/") return SITE_ORIGIN
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`
}

/** Trim to a search-snippet length on a word boundary. Does not add facts. */
export function clampDescription(text: string, limit = DESCRIPTION_MAX): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= limit) return normalized
  const sliced = normalized.slice(0, limit - 1)
  const space = sliced.lastIndexOf(" ")
  const base = (space > 80 ? sliced.slice(0, space) : sliced).replace(/[.,;:–—\-]+$/u, "")
  return `${base}…`
}

export function socialTitle(title: string): string {
  return `${title} | ${SITE_NAME}`
}

/** Default share image. Nested routes set this explicitly so it is not dropped when they define Open Graph. */
export const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME}. Explore classical music your way.`,
} as const

export function pageMetadata({
  title,
  description,
  path,
  socialPath,
  index = true,
}: {
  /** Title before the layout template. Omit for the homepage. */
  title?: string
  description: string
  /** Canonical path, without a filter or search query. */
  path: string
  /** Open Graph URL when it should differ from the canonical path. */
  socialPath?: string
  index?: boolean
}): Metadata {
  const shareTitle = title ? socialTitle(title) : SITE_NAME
  return {
    title: title ?? { absolute: SITE_NAME },
    description,
    alternates: { canonical: path },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: shareTitle,
      description,
      url: socialPath ?? path,
      siteName: SITE_NAME,
      locale: "en_US",
      type: "website",
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: ["/twitter-image"],
    },
  }
}

export function composerDescription(input: {
  completeName: string
  years?: string | null
  epoch?: string | null
}): string {
  const years = input.years?.trim()
  const epoch = input.epoch?.trim()
  const who = years ? `${input.completeName} (${years})` : input.completeName
  const lead = epoch ? `${who}, ${epoch}.` : `${who}.`
  return clampDescription(`${lead} Browse works and play recordings on ${SITE_NAME}.`)
}

export function workPageTitle(composerName: string, workTitle: string): string {
  return `${composerName} – ${workTitle}`
}

export function workDescription(input: {
  composerName: string
  title: string
  subtitle?: string | null
  genre?: string | null
  compositionLabel?: string | null
}): string {
  const facts = [input.compositionLabel?.trim(), input.genre?.trim()].filter((part): part is string =>
    Boolean(part)
  )
  let text = `${input.title} by ${input.composerName}.`
  if (facts.length) text += ` ${facts.join(" · ")}.`
  const subtitle = input.subtitle?.trim()
  if (subtitle && subtitle !== input.title.trim()) {
    text += ` ${subtitle.endsWith(".") ? subtitle : `${subtitle}.`}`
  }
  text += ` Play recordings on ${SITE_NAME}.`
  return clampDescription(text)
}

export function periodDescription(epoch: { name: string; years: string; blurb: string }): string {
  return clampDescription(`${epoch.name} (${epoch.years}). ${epoch.blurb}`)
}

export function periodsIndexDescription(names: readonly string[]): string {
  return clampDescription(`Browse classical music by period: ${names.join(", ")}.`)
}

export function genreDescription(form: { name: string; blurb: string }, count: number): string {
  const noun = count === 1 ? "work" : "works"
  return clampDescription(
    `${form.name}: ${count.toLocaleString("en-US")} ${noun}. ${form.blurb} Ordered by Spotify popularity.`
  )
}

export function searchDescription(query?: string | null): string {
  const q = query?.trim()
  if (!q) return "Search composers and works in the Open Opus catalog."
  return clampDescription(`Search results for “${q}” in the ${SITE_NAME} catalog.`)
}

/** Year, or YYYY-MM-DD, when the source string starts with one. Otherwise omit. */
export function schemaDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const match = value.trim().match(/^(\d{4})(?:-(\d{2})-(\d{2}))?/)
  if (!match) return undefined
  if (!match[2] || !match[3]) return match[1]
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return match[1]
  // Open Opus stores a year as YYYY-01-01. Pages show that year, not 1 January.
  if (month === 1 && day === 1) return match[1]
  return `${match[1]}-${match[2]}-${match[3]}`
}

/** A single non-circa year. Ranges and circa dates are not a schema dateCreated. */
export function exactCompositionYear(date: CompositionDate | null | undefined): number | null {
  if (!date || date.circa) return null
  if (date.end != null && date.end !== date.start) return null
  return date.start
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_ORIGIN,
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_ORIGIN}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export function composerJsonLd(input: {
  id: string
  completeName: string
  birth?: string | null
  death?: string | null
  portrait?: string | null
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: input.completeName,
    url: absoluteUrl(`/composers/${input.id}`),
  }
  const birth = schemaDate(input.birth)
  const death = schemaDate(input.death)
  if (birth) data.birthDate = birth
  if (death) data.deathDate = death
  const portrait = input.portrait?.trim()
  if (portrait && /^https?:\/\//i.test(portrait)) data.image = portrait
  return data
}

export function workJsonLd(input: {
  id: string
  title: string
  subtitle?: string | null
  genre?: string | null
  compositionDate?: CompositionDate | null
  composer: { id: string; completeName: string }
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "MusicComposition",
    name: input.title,
    url: absoluteUrl(`/works/${input.id}`),
    composer: {
      "@type": "Person",
      name: input.composer.completeName,
      url: absoluteUrl(`/composers/${input.composer.id}`),
    },
  }
  const subtitle = input.subtitle?.trim()
  if (subtitle) data.alternateName = subtitle
  const genre = input.genre?.trim()
  if (genre) data.genre = genre
  const year = exactCompositionYear(input.compositionDate)
  if (year != null) data.dateCreated = String(year)
  return data
}
