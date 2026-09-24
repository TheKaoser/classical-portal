import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { GenreWorkBrowser } from "@/components/genre-work-browser"
import { PageHeader } from "@/components/page-header"
import { WorkList } from "@/components/work-list"
import { attachCompositionYearsByComposer } from "@/lib/composition-years"
import { formSummaries, worksForForm } from "@/lib/form-catalog"
import {
  catalogGenreFromSlug,
  formFromSlug,
  legacyBaroqueKeyboardHref,
  legacyKeyboardInstrumentHref,
  legacyKeyboardInstrumentLabel,
  relocatedGenreHref,
} from "@/lib/forms"
import { classifyListedSubtype, keyboardInstrumentOf, listedSubtypeFilters } from "@/lib/work-subtypes"

export function generateStaticParams() {
  return formSummaries().map((form) => ({ slug: form.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const form = catalogGenreFromSlug(slug) ?? (relocatedGenreHref(slug) ? formFromSlug(slug) : undefined)
  return { title: form?.name ?? legacyKeyboardInstrumentLabel(slug) ?? "Genre" }
}

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ filter?: string }>
}) {
  const { slug } = await params
  const { filter } = await searchParams
  if (slug === "baroque-keyboard") permanentRedirect(legacyBaroqueKeyboardHref(filter))

  const legacyInstrument = legacyKeyboardInstrumentHref(slug, filter)
  if (legacyInstrument) permanentRedirect(legacyInstrument)

  const moved = relocatedGenreHref(slug)
  if (moved) permanentRedirect(moved)

  const form = catalogGenreFromSlug(slug)
  if (!form) notFound()

  const listed = worksForForm(slug)
  if (!listed.length) notFound()
  const filters = listedSubtypeFilters(listed)
  const works = await attachCompositionYearsByComposer(
    listed.map((work) => ({
      id: work.id,
      title: work.title,
      subtitle: work.subtitle,
      genre: work.genre,
      popular: work.popular,
      recommended: work.recommended,
      composerLabel: work.composerName,
      subtype: classifyListedSubtype(work)?.slug ?? null,
      instrument: keyboardInstrumentOf(work),
      composer: {
        id: work.composerId,
        name: work.composerName,
        complete_name: work.composerName,
      },
    }))
  )

  return (
    <div>
      <PageHeader
        title={form.name}
        subtitle={`${works.length.toLocaleString()} ${works.length === 1 ? "work" : "works"}`}
        description={`${form.blurb} Ordered by Spotify popularity.`}
        backHref="/genres"
        backLabel="Genres"
      />
      {filters.length ? <GenreWorkBrowser works={works} filters={filters} /> : <WorkList works={works} />}
    </div>
  )
}
