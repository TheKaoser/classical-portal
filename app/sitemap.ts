import type { MetadataRoute } from "next"
import composerEpochs from "@/data/composer-epochs.json"
import catalog from "@/data/form-works.json"
import { EPOCHS } from "@/lib/epochs"
import { formSummaries, loadFormWorks } from "@/lib/form-catalog"
import { absoluteUrl } from "@/lib/seo"

/** Google’s limit for one sitemap file. The catalog is well under this. */
const SITEMAP_URL_LIMIT = 50_000

const lastModified = catalog.generatedAt ? new Date(catalog.generatedAt) : undefined

function entry(
  path: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(path),
    lastModified,
    changeFrequency,
    priority,
  }
}

function byNumericId(a: string, b: string): number {
  return Number(a) - Number(b) || a.localeCompare(b)
}

export default function sitemap(): MetadataRoute.Sitemap {
  const works = loadFormWorks()
  const composerIds = new Set<string>(Object.keys(composerEpochs))
  for (const work of works) composerIds.add(work.composerId)

  const entries: MetadataRoute.Sitemap = [
    entry("/", 1, "weekly"),
    entry("/periods", 0.8, "weekly"),
    entry("/genres", 0.8, "weekly"),
    entry("/composers", 0.8, "weekly"),
    entry("/search", 0.4, "weekly"),
    ...EPOCHS.map((epoch) => entry(`/periods/${epoch.slug}`, 0.7, "weekly")),
    ...formSummaries().map((form) => entry(`/genres/${form.slug}`, 0.7, "weekly")),
    ...[...composerIds].sort(byNumericId).map((id) => entry(`/composers/${id}`, 0.6, "monthly")),
    ...works.map((work) => work.id).sort(byNumericId).map((id) => entry(`/works/${id}`, 0.5, "monthly")),
  ]

  if (entries.length > SITEMAP_URL_LIMIT) {
    throw new Error(
      `sitemap has ${entries.length} URLs, over the ${SITEMAP_URL_LIMIT} limit. Split app/sitemap.ts.`
    )
  }

  return entries
}
