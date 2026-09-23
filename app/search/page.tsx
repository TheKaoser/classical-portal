import type { Metadata } from "next"
import { ListLink } from "@/components/list-link"
import { PageHeader } from "@/components/page-header"
import { SearchForm } from "@/components/search-form"
import { CompositionYear } from "@/components/work-list"
import { attachCompositionYearsByComposer } from "@/lib/composition-years"
import { omniSearch } from "@/lib/openopus"

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}): Promise<Metadata> {
  const { q } = await searchParams
  return { title: q ? `Search “${q}”` : "Search" }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = "" } = await searchParams
  const query = q.trim()
  const results = query.length >= 2 ? await omniSearch(query) : []

  const composers = results.filter((hit) => !hit.work)
  const workHits = results.filter((hit) => hit.work)
  const works = await attachCompositionYearsByComposer(
    workHits.map((hit) => ({
      ...hit.work!,
      composer: hit.composer,
    }))
  )

  return (
    <div>
      <PageHeader title="Search" backHref="/" backLabel="Home" />
      <SearchForm defaultValue={query} autoFocus className="mb-8 max-w-md" size="lg" />

      {query.length > 0 && query.length < 2 && (
        <p className="text-sm text-muted-foreground">Type at least two characters.</p>
      )}

      {query.length >= 2 && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No composers or works matched “{query}”.</p>
      )}

      {composers.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 px-3 text-sm font-medium text-primary">Composers</h2>
          <ul className="space-y-0.5">
            {composers.map((hit) => (
              <li key={hit.composer.id}>
                <ListLink href={`/composers/${hit.composer.id}`} className="block">
                  <div className="font-medium text-foreground group-hover:text-primary">{hit.composer.complete_name}</div>
                  <div className="text-sm text-muted-foreground">{hit.composer.epoch}</div>
                </ListLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {works.length > 0 && (
        <section>
          <h2 className="mb-2 px-3 text-sm font-medium text-primary">Works</h2>
          <ul className="space-y-0.5">
            {works.map((work) => (
              <li key={work.id}>
                <ListLink href={`/works/${work.id}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-foreground group-hover:text-primary">{work.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {work.composer.complete_name}
                      {work.genre ? ` · ${work.genre}` : ""}
                    </span>
                  </span>
                  <CompositionYear date={work.compositionDate} />
                </ListLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
