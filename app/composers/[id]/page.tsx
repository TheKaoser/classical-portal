import { notFound } from "next/navigation"
import { ComposerWorkBrowser } from "@/components/composer-work-browser"
import { JsonLd } from "@/components/json-ld"
import { PageHeader } from "@/components/page-header"
import { sortWorksChronologically } from "@/lib/composition-date"
import { attachCompositionYears } from "@/lib/composition-years"
import { epochHref } from "@/lib/epochs"
import { isSpotifyOAuthConfigured } from "@/lib/spotify-model"
import {
  compareWorksByPopularity,
  dedupeWorks,
  getComposer,
  isPopular,
  listWorksByComposer,
  lifeSpan,
  WORK_GENRES,
} from "@/lib/openopus"
import { composerDescription, composerJsonLd, pageMetadata } from "@/lib/seo"

export const revalidate = 3600
export const dynamic = "force-static"
export const dynamicParams = true

// Generate composer pages on demand, then serve subsequent requests from ISR.
export function generateStaticParams() {
  return []
}


export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const composer = await getComposer(id)
  // Missing records must abort metadata too, not publish a generic 200 page.
  if (!composer) notFound()
  return pageMetadata({
    title: composer.complete_name,
    description: composerDescription({
      completeName: composer.complete_name,
      years: lifeSpan(composer),
      epoch: composer.epoch,
    }),
    path: `/composers/${composer.id}`,
  })
}

export default async function ComposerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [composer, worksResult] = await Promise.all([getComposer(id), listWorksByComposer(id)])

  if (!composer) notFound()

  const works = await attachCompositionYears(dedupeWorks(worksResult.works), {
    id: composer.id,
    name: composer.name,
    complete_name: composer.complete_name,
    birth: composer.birth ?? worksResult.composer?.birth ?? null,
    death: composer.death ?? worksResult.composer?.death ?? null,
  })
  const genreCounts = new Map<string, number>()
  let popularCount = 0
  for (const work of works) {
    if (isPopular(work)) popularCount += 1
    genreCounts.set(work.genre, (genreCounts.get(work.genre) ?? 0) + 1)
  }
  const genreFilters = WORK_GENRES.flatMap((genre) => {
    const count = genreCounts.get(genre) ?? 0
    return count ? [{ slug: genre, label: genre, count }] : []
  })
  const filters = [
    { slug: "all", label: "All", count: works.length },
    ...(popularCount ? [{ slug: "popular", label: "Popular", count: popularCount }] : []),
    ...genreFilters,
  ]
  const defaultFilter = popularCount ? "popular" : "all"
  const popularityOrder = new Map(
    [...works].sort(compareWorksByPopularity).map((work, index) => [work.id, index])
  )
  const chronoOrder = new Map(sortWorksChronologically(works).map((work, index) => [work.id, index]))
  const years = lifeSpan(composer)

  return (
    <div>
      <JsonLd
        data={composerJsonLd({
          id: composer.id,
          completeName: composer.complete_name,
          birth: composer.birth,
          death: composer.death,
          portrait: composer.portrait,
        })}
      />
      <PageHeader
        title={composer.complete_name}
        subtitle={[years, composer.epoch].filter(Boolean).join(" · ")}
        portrait={composer.portrait}
        backHref={epochHref(composer.epoch)}
        backLabel={composer.epoch}
      />
      <ComposerWorkBrowser
        works={works.map((work) => ({
          id: work.id,
          title: work.title,
          subtitle: work.subtitle,
          genre: work.genre,
          popular: work.popular,
          recommended: work.recommended,
          compositionYear: work.compositionYear,
          popularityOrder: popularityOrder.get(work.id) ?? 0,
          chronoOrder: chronoOrder.get(work.id) ?? 0,
        }))}
        filters={filters}
        defaultFilter={defaultFilter}
        initialFilter={defaultFilter}
        oauthConfigured={isSpotifyOAuthConfigured()}
      />
    </div>
  )
}
