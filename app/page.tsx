import Link from "next/link"
import { cn } from "@/lib/utils"

const ENTRIES = [
  {
    href: "/periods",
    title: "Periods",
  },
  {
    href: "/genres",
    title: "Genres",
  },
  {
    href: "/composers",
    title: "Composers",
  },
] as const

function EntryButton({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-w-44 items-center justify-center rounded-2xl bg-surface-blue px-12 py-5",
        "text-xl font-medium tracking-tight text-primary sm:min-w-52 sm:px-14 sm:py-6 sm:text-2xl",
        "outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      {title}
    </Link>
  )
}

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
        className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5"
        aria-label="Browse catalog"
      >
        {ENTRIES.map((entry) => (
          <EntryButton key={entry.href} {...entry} />
        ))}
      </nav>
    </div>
  )
}
