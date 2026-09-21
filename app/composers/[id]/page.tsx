import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { FilterChips } from "@/components/filter-chips"
import { WorkList } from "@/components/work-list"
import { epochHref } from "@/lib/epochs"
import {
  getComposer,
  groupWorksByGenre,
  isFlagged,
  listWorksByComposer,
  lifeSpan,
  WORK_GENRES,
} from "@/lib/openopus"

export const revalidate = 3600

type Filter = "all" | "popular" | "recommended" | string

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

  const works = worksResult.works
  const popularCount = works.filter((work) => isFlagged(work.popular)).length
  const recommendedCount = works.filter((work) => isFlagged(work.recommended)).length
  const genreCounts = Object.fromEntries(
    WORK_GENRES.map((genre) => [genre, works.filter((work) => work.genre === genre).length])
  )

  const available: Filter[] = [
    "all",
    ...(recommendedCount ? (["recommended"] as const) : []),
    ...(popularCount ? (["popular"] as const) : []),
    ...WORK_GENRES.filter((genre) => genreCounts[genre] > 0),
  ]

  const requested = (rawFilter || "").trim()
  const filter: Filter =
    requested && available.includes(requested)
      ? requested
      : recommendedCount
        ? "recommended"
        : popularCount
          ? "popular"
          : "all"

  const filtered =
    filter === "all"
      ? works
      : filter === "popular"
        ? works.filter((work) => isFlagged(work.popular))
        : filter === "recommended"
          ? works.filter((work) => isFlagged(work.recommended))
          : works.filter((work) => work.genre === filter)

  const grouped = filter === "all" || filter === "popular" || filter === "recommended"
    ? groupWorksByGenre(filtered)
    : [{ genre: filter, works: filtered }]

  const years = lifeSpan(composer)
  const hrefFor = (value: Filter) =>
    value === (recommendedCount ? "recommended" : popularCount ? "popular" : "all")
      ? `/composers/${composer.id}`
      : `/composers/${composer.id}?filter=${encodeURIComponent(value)}`

  const chips = [
    { href: hrefFor("all"), label: "All", active: filter === "all", count: works.length },
    ...(recommendedCount
      ? [{ href: hrefFor("recommended"), label: "Essential", active: filter === "recommended", count: recommendedCount }]
      : []),
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

      <div className="space-y-8">
        {grouped.map((group) => (
          <section key={group.genre}>
            {grouped.length > 1 && (
              <h2 className="mb-2 font-serif text-lg tracking-tight">{group.genre}</h2>
            )}
            <WorkList works={group.works} />
          </section>
        ))}
      </div>
    </div>
  )
}
