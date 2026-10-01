import type { MetadataRoute } from "next"
import { catalogSitemapPlan, type SitemapEntry } from "@/lib/sitemap-catalog"

function toMetadata(entry: SitemapEntry): MetadataRoute.Sitemap[number] {
  return {
    url: entry.loc,
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }
}

/** Unknown chunk ids 404. Only the ids from generateSitemaps are files. */
export const dynamicParams = false

/** One id per chunk. Next serves these at /sitemap/[id].xml. */
export async function generateSitemaps() {
  return catalogSitemapPlan().chunks.map((_, id) => ({ id }))
}

export default async function sitemap({
  id,
}: {
  id: string | Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  const raw = await id
  if (!/^\d+$/.test(raw)) return []
  const chunk = catalogSitemapPlan().chunks[Number(raw)]
  if (!chunk) return []
  return chunk.map(toMetadata)
}
