import Link from "next/link"
import { PeriodList } from "@/components/period-list"
import { SearchForm } from "@/components/search-form"

export const revalidate = 3600

export default function HomePage() {
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
        <PeriodList />
      </section>
    </div>
  )
}
