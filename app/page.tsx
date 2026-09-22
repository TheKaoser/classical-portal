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
        "inline-flex items-center justify-center rounded-full bg-surface-blue px-10 py-4",
        "text-lg font-medium tracking-tight text-primary sm:px-12 sm:py-5 sm:text-xl",
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
        <h1
          className={cn(
            "font-serif text-5xl tracking-tight sm:text-6xl",
            "bg-linear-to-r from-foreground to-primary bg-clip-text text-transparent"
          )}
        >
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
