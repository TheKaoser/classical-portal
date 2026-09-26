import catalog from "@/data/form-works.json"
import {
  FORM_GROUPS,
  WORK_FORMS,
  browsePageForForm,
  catalogGenreFromSlug,
  groupForForm,
  type CatalogGenre,
} from "@/lib/forms"
import { compareWorksByPopularity, dedupeWorks, isPopular } from "@/lib/openopus"

export type FormWork = {
  id: string
  title: string
  subtitle: string
  genre: string
  popular: string
  recommended: string
  composerId: string
  composerName: string
  form: string
}

export type FormSummary = CatalogGenre & {
  total: number
  popular: number
}

export function loadFormWorks(): FormWork[] {
  return catalog.works
}

function bump(counts: Map<string, { total: number; popular: number }>, slug: string, popular: boolean) {
  const row = counts.get(slug) ?? { total: 0, popular: 0 }
  row.total += 1
  if (popular) row.popular += 1
  counts.set(slug, row)
}

/**
 * Genre page for this work. Open Opus genre chooses the page; the stored
 * form is only the chip. Null when the title form has no compatible page.
 */
export function browseSlugForWork(work: FormWork): string | null {
  return browsePageForForm(work.form, work.genre)
}

export function formSummaries(): FormSummary[] {
  const counts = new Map<string, { total: number; popular: number }>()

  for (const work of loadFormWorks()) {
    const slug = browseSlugForWork(work)
    if (slug) bump(counts, slug, isPopular(work))
  }

  const summaries: FormSummary[] = []

  for (const form of WORK_FORMS) {
    if (groupForForm(form.slug)) continue
    const row = counts.get(form.slug)
    if (!row?.total) continue
    summaries.push({ slug: form.slug, name: form.name, blurb: form.blurb, ...row })
  }

  for (const group of FORM_GROUPS) {
    const row = counts.get(group.slug)
    if (!row?.total) continue
    summaries.push({ slug: group.slug, name: group.name, blurb: group.blurb, ...row })
  }

  return summaries.sort((a, b) => b.popular - a.popular || b.total - a.total || a.name.localeCompare(b.name))
}

export function worksForForm(slug: string): FormWork[] {
  if (!catalogGenreFromSlug(slug)) return []
  return dedupeWorks(loadFormWorks().filter((work) => browseSlugForWork(work) === slug)).sort(
    compareWorksByPopularity
  )
}
