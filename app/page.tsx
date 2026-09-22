import Link from "next/link"

const ENTRIES = [
  { href: "/periods", title: "Periods" },
  { href: "/genres", title: "Genres" },
  { href: "/composers", title: "Composers" },
] as const

export default function HomePage() {
  return (
    <div className="space-y-14">
      <section className="space-y-3 py-20 text-center sm:py-28">
        <h1 className="title-gradient font-serif text-5xl tracking-tight sm:text-6xl">
          Classical Portal
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Explore classical music your way.
        </p>
      </section>

      <nav
        className="flex flex-nowrap items-center justify-center gap-8 sm:gap-14 md:gap-20"
        aria-label="Browse catalog"
      >
        {ENTRIES.map(({ href, title }) => (
          <Link
            key={href}
            href={href}
            className="shrink-0 text-xl font-medium tracking-tight text-primary outline-none transition-colors hover:text-primary-hover focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-2xl md:text-3xl"
          >
            {title}
          </Link>
        ))}
      </nav>
    </div>
  )
}
