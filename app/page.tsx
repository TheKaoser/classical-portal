import Link from "next/link"
import { SearchForm } from "@/components/search-form"
import { ComposerList } from "@/components/composer-list"
import { EPOCHS } from "@/lib/epochs"
import { listPopularComposers } from "@/lib/openopus"

export const revalidate = 3600

export default async function HomePage() {
  const popular = await listPopularComposers()

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-2xl border border-primary/10 bg-card/70 px-5 py-8 shadow-sm sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--shell-from)] via-[var(--shell-via)] to-[var(--shell-to)]"
        />
        <div className="relative space-y-4">
          <h1 className="font-serif text-4xl tracking-tight text-brand-gradient sm:text-5xl">
            Classical Portal
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Browse composers and works by period, then open a matching recording on Spotify.
          </p>
          <SearchForm size="lg" className="max-w-md" />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-serif text-xl tracking-tight text-navy">Periods</h2>
          <Link href="/periods" className="text-sm text-primary hover:text-primary-hover">
            All periods
          </Link>
        </div>
        <ul className="divide-y divide-border">
          {EPOCHS.map((epoch) => (
            <li key={epoch.slug}>
              <Link
                href={`/periods/${epoch.slug}`}
                className="flex items-baseline justify-between gap-4 py-2.5 hover:bg-accent/70 -mx-2 px-2 rounded-md"
              >
                <span className="font-medium text-navy">{epoch.name}</span>
                <span className="text-sm text-muted-foreground">{epoch.years}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl tracking-tight text-navy">Popular composers</h2>
        <ComposerList composers={popular} />
      </section>
    </div>
  )
}
