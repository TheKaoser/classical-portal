import catalog from "@/data/form-works.json"
import { compareWorksByPopularity, dedupeWorks, isPopular } from "@/lib/openopus"
import {
  FORM_GROUPS,
  WORK_FORMS,
  formsForBrowseSlug,
  groupForForm,
  type CatalogGenre,
} from "@/lib/forms"

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

export function formSummaries(): FormSummary[] {
  const counts = new Map<string, { total: number; popular: number }>()

  for (const work of loadFormWorks()) {
    const row = counts.get(work.form) ?? { total: 0, popular: 0 }
    row.total += 1
    if (isPopular(work)) row.popular += 1
    counts.set(work.form, row)
  }

  const summaries: FormSummary[] = []

  for (const form of WORK_FORMS) {
    if (groupForForm(form.slug)) continue
    const row = counts.get(form.slug)
    if (!row?.total) continue
    summaries.push({ slug: form.slug, name: form.name, blurb: form.blurb, ...row })
  }

  for (const group of FORM_GROUPS) {
    let total = 0
    let popular = 0
    for (const child of group.children) {
      const row = counts.get(child)
      if (!row) continue
      total += row.total
      popular += row.popular
    }
    if (!total) continue
    summaries.push({ slug: group.slug, name: group.name, blurb: group.blurb, total, popular })
  }

  return summaries.sort((a, b) => b.popular - a.popular || b.total - a.total || a.name.localeCompare(b.name))
}

export function worksForForm(slug: string): FormWork[] {
  const forms = new Set(formsForBrowseSlug(slug))
  if (!forms.size) return []
  return dedupeWorks(loadFormWorks().filter((work) => forms.has(work.form))).sort(compareWorksByPopularity)
}
