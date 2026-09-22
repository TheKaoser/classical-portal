import type { Metadata } from "next"
import { ListLink } from "@/components/list-link"
import { PageHeader } from "@/components/page-header"
import { SearchForm } from "@/components/search-form"
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
  const works = results.filter((hit) => hit.work)

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
            {works.map((hit) => (
              <li key={hit.work!.id}>
                <ListLink href={`/works/${hit.work!.id}`} className="block">
                  <div className="text-sm text-foreground group-hover:text-primary">{hit.work!.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {hit.composer.complete_name}
                    {hit.work!.genre ? ` · ${hit.work!.genre}` : ""}
                  </div>
                </ListLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
