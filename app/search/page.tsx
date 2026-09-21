import type { Metadata } from "next"
import Link from "next/link"
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
          <h2 className="mb-3 font-serif text-lg tracking-tight">Composers</h2>
          <ul className="divide-y divide-border">
            {composers.map((hit) => (
              <li key={hit.composer.id}>
                <Link
                  href={`/composers/${hit.composer.id}`}
                  className="block py-2.5 hover:bg-accent/40 -mx-2 px-2 rounded-md"
                >
                  <div className="font-medium">{hit.composer.complete_name}</div>
                  <div className="text-sm text-muted-foreground">{hit.composer.epoch}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {works.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-lg tracking-tight">Works</h2>
          <ul className="divide-y divide-border">
            {works.map((hit) => (
              <li key={hit.work!.id}>
                <Link
                  href={`/works/${hit.work!.id}`}
                  className="block py-2.5 hover:bg-accent/40 -mx-2 px-2 rounded-md"
                >
                  <div className="text-sm text-foreground">{hit.work!.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {hit.composer.complete_name}
                    {hit.work!.genre ? ` · ${hit.work!.genre}` : ""}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
