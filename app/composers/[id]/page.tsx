import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { FilterChips } from "@/components/filter-chips"
import { WorkList } from "@/components/work-list"
import { sortWorksChronologically } from "@/lib/composition-date"
import { attachCompositionYears } from "@/lib/composition-years"
import { epochHref } from "@/lib/epochs"
import {
  compareWorksByPopularity,
  dedupeWorks,
  getComposer,
  groupWorksByGenre,
  isPopular,
  listWorksByComposer,
  lifeSpan,
  WORK_GENRES,
} from "@/lib/openopus"

export const revalidate = 3600

type Filter = "all" | "popular" | string

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const composer = await getComposer(id)
  return { title: composer?.complete_name ?? "Composer" }
}

export default async function ComposerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ filter?: string }>
}) {
  const { id } = await params
  const { filter: rawFilter } = await searchParams
  const [composer, worksResult] = await Promise.all([getComposer(id), listWorksByComposer(id)])

  if (!composer) notFound()

  const works = await attachCompositionYears(dedupeWorks(worksResult.works), {
    id: composer.id,
    name: composer.name,
    complete_name: composer.complete_name,
    birth: composer.birth ?? worksResult.composer?.birth ?? null,
    death: composer.death ?? worksResult.composer?.death ?? null,
  })
  const popularCount = works.filter((work) => isPopular(work)).length
  const genreCounts = Object.fromEntries(
    WORK_GENRES.map((genre) => [genre, works.filter((work) => work.genre === genre).length])
  )

  const available: Filter[] = [
    "all",
    ...(popularCount ? (["popular"] as const) : []),
    ...WORK_GENRES.filter((genre) => genreCounts[genre] > 0),
  ]

  const requestedRaw = (rawFilter || "").trim()
  const requested = requestedRaw === "recommended" ? "popular" : requestedRaw
  const filter: Filter =
    requested && available.includes(requested)
      ? requested
      : popularCount
        ? "popular"
        : "all"

  const filtered =
    filter === "all"
      ? works
      : filter === "popular"
        ? works.filter((work) => isPopular(work))
        : works.filter((work) => work.genre === filter)

  const grouped =
    filter === "all" || filter === "popular"
      ? groupWorksByGenre(filtered)
      : [{ genre: filter, works: [...filtered].sort(compareWorksByPopularity) }]

  const years = lifeSpan(composer)
  const hrefFor = (value: Filter) =>
    value === (popularCount ? "popular" : "all")
      ? `/composers/${composer.id}`
      : `/composers/${composer.id}?filter=${encodeURIComponent(value)}`

  const chips = [
    { href: hrefFor("all"), label: "All", active: filter === "all", count: works.length },
    ...(popularCount
      ? [{ href: hrefFor("popular"), label: "Popular", active: filter === "popular", count: popularCount }]
      : []),
    ...WORK_GENRES.filter((genre) => genreCounts[genre] > 0).map((genre) => ({
      href: hrefFor(genre),
      label: genre,
      active: filter === genre,
      count: genreCounts[genre],
    })),
  ]

  return (
    <div>
      <PageHeader
        title={composer.complete_name}
        subtitle={[years, composer.epoch].filter(Boolean).join(" · ")}
        portrait={composer.portrait}
        backHref={epochHref(composer.epoch)}
        backLabel={composer.epoch}
      />

      <FilterChips items={chips} />

      {filter === "all" ? (
        <WorkList works={sortWorksChronologically(filtered)} showGenre />
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.genre}>
              {grouped.length > 1 && (
                <h2 className="mb-2 px-3 text-sm font-medium text-primary">{group.genre}</h2>
              )}
              <WorkList works={group.works} />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
