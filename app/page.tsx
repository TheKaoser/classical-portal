import Link from "next/link"
import { ArrowRight, Library, Music, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const PAIR = [
  {
    href: "/periods",
    title: "Periods",
    text: "Browse composers by era, from medieval chant to music written today.",
    icon: Library,
    wash: "entry-card-periods",
  },
  {
    href: "/genres",
    title: "Genres",
    text: "Browse works by form — symphonies, sonatas, operas, and more.",
    icon: Music,
    wash: "entry-card-genres",
  },
] as const

const COMPOSERS = {
  href: "/composers",
  title: "Composers",
  text: "Browse the most popular composers in the catalog.",
  icon: Users,
  wash: "entry-card-composers",
} as const

function EntryCard({
  href,
  title,
  text,
  icon: Icon,
  wash,
  layout,
}: {
  href: string
  title: string
  text: string
  icon: LucideIcon
  wash: string
  layout: "stack" | "row"
}) {
  const arrow = (
    <ArrowRight
      className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
      aria-hidden
    />
  )

  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-primary/20 shadow-sm transition-[border-color,box-shadow] hover:border-primary/45 hover:shadow-md",
        wash,
        layout === "row"
          ? "flex items-center gap-5 px-6 py-8 sm:px-8 sm:py-10"
          : "flex h-full min-h-56 flex-col justify-between gap-8 p-6 sm:min-h-64 sm:p-8"
      )}
    >
      <span
        className={cn(
          "relative z-10 flex shrink-0 items-start gap-4",
          layout === "stack" && "w-full justify-between"
        )}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/80 text-primary shadow-sm ring-1 ring-white/80">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        {layout === "stack" ? arrow : null}
      </span>
      <span className={cn("relative z-10 min-w-0", layout === "row" && "flex-1")}>
        <h2 className="font-serif text-3xl tracking-tight text-navy sm:text-4xl">{title}</h2>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground sm:text-base">{text}</span>
      </span>
      {layout === "row" ? <span className="relative z-10">{arrow}</span> : null}
    </Link>
  )
}

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-card/80 px-6 py-10 shadow-sm sm:px-10 sm:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--shell-from)] via-[var(--shell-via)] to-[var(--shell-to)]"
        />
        <div className="relative space-y-3">
          <h1 className="font-serif text-4xl tracking-tight text-brand-gradient sm:text-5xl">
            Classical Portal
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Explore classical music your way, listen on Spotify
          </p>
        </div>
      </section>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PAIR.map((banner) => (
            <EntryCard key={banner.href} {...banner} layout="stack" />
          ))}
        </div>
        <EntryCard {...COMPOSERS} layout="row" />
      </div>
    </div>
  )
}
