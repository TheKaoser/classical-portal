import catalog from "@/data/form-works.json"
import { compareWorksByPopularity, isFlagged } from "@/lib/openopus"
import { WORK_FORMS, formFromSlug, type WorkForm } from "@/lib/forms"

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

export type FormSummary = WorkForm & {
  total: number
  popular: number
  recommended: number
}

export function loadFormWorks(): FormWork[] {
  return catalog.works
}

export function formSummaries(): FormSummary[] {
  const counts = new Map<string, { total: number; popular: number; recommended: number }>()

  for (const work of loadFormWorks()) {
    const row = counts.get(work.form) ?? { total: 0, popular: 0, recommended: 0 }
    row.total += 1
    if (isFlagged(work.popular)) row.popular += 1
    if (isFlagged(work.recommended)) row.recommended += 1
    counts.set(work.form, row)
  }

  return WORK_FORMS.flatMap((form) => {
    const row = counts.get(form.slug)
    if (!row?.total) return []
    return [{ ...form, ...row }]
  }).sort(
    (a, b) =>
      b.popular - a.popular ||
      b.recommended - a.recommended ||
      b.total - a.total ||
      a.name.localeCompare(b.name)
  )
}

export function worksForForm(slug: string): FormWork[] {
  if (!formFromSlug(slug)) return []
  return loadFormWorks()
    .filter((work) => work.form === slug)
    .sort(compareWorksByPopularity)
}
