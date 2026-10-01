import composerEpochs from "../data/composer-epochs.json" with { type: "json" }
import catalog from "../data/form-works.json" with { type: "json" }
import { EPOCHS } from "./epochs.ts"
import { browsePageForForm, catalogGenreFromSlug } from "./forms.ts"
import { absoluteUrl } from "./seo.ts"

/**
 * Google allows 50,000 URLs and 50MB per sitemap file. These caps stay
 * well under both, and under the size that makes one /sitemap.xml body
 * fail in caches and clients.
 */
export const SITEMAP_URL_LIMIT = 10_000
export const SITEMAP_BYTE_BUDGET = 1_000_000

export type SitemapChangeFrequency = "weekly" | "monthly"

export type SitemapEntry = {
  loc: string
  lastModified?: string
  changeFrequency: SitemapChangeFrequency
  priority: number
}

export type SitemapWork = {
  id: string
  composerId: string
  form: string
  genre: string
}

const URLSET_OPEN = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
const URLSET_CLOSE = `</urlset>\n`
const URLSET_WRAPPER_BYTES = URLSET_OPEN.length + URLSET_CLOSE.length

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** ISO timestamp, or undefined when the catalog date cannot be serialized. */
export function sitemapLastModified(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function byNumericId(a: string, b: string): number {
  return Number(a) - Number(b) || a.localeCompare(b)
}

/** Genre pages that actually have works. Same pages as the genres index. */
export function indexableGenreSlugs(works: readonly Pick<SitemapWork, "form" | "genre">[]): string[] {
  const slugs = new Set<string>()
  for (const work of works) {
    const slug = browsePageForForm(work.form, work.genre)
    if (slug && catalogGenreFromSlug(slug)) slugs.add(slug)
  }
  return [...slugs].sort((a, b) => a.localeCompare(b))
}

function entry(
  path: string,
  priority: number,
  changeFrequency: SitemapChangeFrequency,
  lastModified?: string
): SitemapEntry {
  return { loc: absoluteUrl(path), lastModified, changeFrequency, priority }
}

export function buildSitemapEntries(input: {
  works: readonly SitemapWork[]
  composerIds: readonly string[]
  epochSlugs: readonly string[]
  genreSlugs: readonly string[]
  lastModified?: string
}): SitemapEntry[] {
  const lastModified = input.lastModified
  const workIds = [...new Set(input.works.map((work) => work.id.trim()).filter(Boolean))].sort(byNumericId)
  const composerIds = [...new Set(input.composerIds.map((id) => id.trim()).filter(Boolean))].sort(byNumericId)

  return [
    entry("/", 1, "weekly", lastModified),
    entry("/periods", 0.8, "weekly", lastModified),
    entry("/genres", 0.8, "weekly", lastModified),
    entry("/composers", 0.8, "weekly", lastModified),
    entry("/search", 0.4, "weekly", lastModified),
    ...input.epochSlugs.map((slug) => entry(`/periods/${slug}`, 0.7, "weekly", lastModified)),
    ...input.genreSlugs.map((slug) => entry(`/genres/${slug}`, 0.7, "weekly", lastModified)),
    ...composerIds.map((id) => entry(`/composers/${id}`, 0.6, "monthly", lastModified)),
    ...workIds.map((id) => entry(`/works/${id}`, 0.5, "monthly", lastModified)),
  ]
}

export function entryXml(item: SitemapEntry): string {
  let xml = "<url>\n"
  xml += `<loc>${xmlEscape(item.loc)}</loc>\n`
  if (item.lastModified) xml += `<lastmod>${xmlEscape(item.lastModified)}</lastmod>\n`
  xml += `<changefreq>${item.changeFrequency}</changefreq>\n`
  xml += `<priority>${item.priority}</priority>\n`
  xml += "</url>\n"
  return xml
}

export function urlSetXml(entries: readonly SitemapEntry[]): string {
  return URLSET_OPEN + entries.map(entryXml).join("") + URLSET_CLOSE
}

export function sitemapIndexXml(locs: readonly string[], lastModified?: string): string {
  const lastmod = lastModified ? `<lastmod>${xmlEscape(lastModified)}</lastmod>\n` : ""
  const body = locs
    .map((loc) => `<sitemap>\n<loc>${xmlEscape(loc)}</loc>\n${lastmod}</sitemap>\n`)
    .join("")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}</sitemapindex>\n`
}

/**
 * Split a urlset so each file stays within the URL count and the rendered
 * byte budget. One oversized entry is emitted alone rather than dropped.
 */
export function chunkSitemapEntries(
  entries: readonly SitemapEntry[],
  limits: { urlLimit?: number; byteBudget?: number } = {}
): SitemapEntry[][] {
  const urlLimit = limits.urlLimit ?? SITEMAP_URL_LIMIT
  const byteBudget = limits.byteBudget ?? SITEMAP_BYTE_BUDGET
  const chunks: SitemapEntry[][] = []
  let current: SitemapEntry[] = []
  let bytes = URLSET_WRAPPER_BYTES

  for (const item of entries) {
    const piece = entryXml(item).length
    const overflows =
      current.length > 0 && (current.length >= urlLimit || bytes + piece > byteBudget)
    if (overflows) {
      chunks.push(current)
      current = []
      bytes = URLSET_WRAPPER_BYTES
    }
    current.push(item)
    bytes += piece
  }

  if (current.length) chunks.push(current)
  return chunks
}

export function sitemapChunkPath(index: number): string {
  return `/sitemap/${index}.xml`
}

export type SitemapPlan = {
  lastModified?: string
  entries: SitemapEntry[]
  chunks: SitemapEntry[][]
}

export function sitemapPlanFromWorks(input: {
  works: readonly SitemapWork[]
  composerIds: Iterable<string>
  epochSlugs: readonly string[]
  generatedAt?: string | null
}): SitemapPlan {
  const lastModified = sitemapLastModified(input.generatedAt)
  const composerIds = new Set<string>(input.composerIds)
  for (const work of input.works) {
    const id = work.composerId?.trim()
    if (id) composerIds.add(id)
  }
  const entries = buildSitemapEntries({
    works: input.works,
    composerIds: [...composerIds],
    epochSlugs: input.epochSlugs,
    genreSlugs: indexableGenreSlugs(input.works),
    lastModified,
  })
  return { lastModified, entries, chunks: chunkSitemapEntries(entries) }
}

let cachedPlan: SitemapPlan | undefined

/** Local catalog only. No recording search and no remote catalog calls. */
export function catalogSitemapPlan(): SitemapPlan {
  if (!cachedPlan) {
    cachedPlan = sitemapPlanFromWorks({
      works: catalog.works,
      composerIds: Object.keys(composerEpochs),
      epochSlugs: EPOCHS.map((epoch) => epoch.slug),
      generatedAt: catalog.generatedAt,
    })
  }
  return cachedPlan
}

export function catalogSitemapIndexXml(): string {
  const plan = catalogSitemapPlan()
  const locs = plan.chunks.map((_, index) => absoluteUrl(sitemapChunkPath(index)))
  return sitemapIndexXml(locs, plan.lastModified)
}
