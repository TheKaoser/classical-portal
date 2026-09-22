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
    tone: "text-primary",
  },
  {
    href: "/genres",
    title: "Genres",
    text: "Browse works by form — symphonies, sonatas, operas, and more.",
    icon: Music,
    wash: "entry-card-genres",
    tone: "text-brand-green",
  },
] as const

const COMPOSERS = {
  href: "/composers",
  title: "Composers",
  text: "Browse the most popular composers in the catalog.",
  icon: Users,
  wash: "entry-card-composers",
  tone: "text-brand-amber",
} as const

function EntryCard({
  href,
  title,
  text,
  icon: Icon,
  wash,
  tone,
  layout,
}: {
  href: string
  title: string
  text: string
  icon: LucideIcon
  wash: string
  tone: string
  layout: "stack" | "row"
}) {
  const arrow = (
    <ArrowRight
      className={cn("h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5", tone)}
      aria-hidden
    />
  )

  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-3xl shadow-card outline-none transition-shadow hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        wash,
        layout === "row"
          ? "flex items-center gap-5 px-6 py-7 sm:px-8 sm:py-8"
          : "flex h-full min-h-52 flex-col justify-between gap-8 p-6 sm:min-h-56 sm:p-7"
      )}
    >
      <span
        className={cn(
          "relative z-10 flex shrink-0 items-start gap-4",
          layout === "stack" && "w-full justify-between"
        )}
      >
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-card", tone)}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        {layout === "stack" ? arrow : null}
      </span>
      <span className={cn("relative z-10 min-w-0", layout === "row" && "flex-1")}>
        <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">{title}</h2>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground sm:text-base">{text}</span>
      </span>
      {layout === "row" ? <span className="relative z-10">{arrow}</span> : null}
    </Link>
  )
}

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-3 py-20 text-center sm:py-28">
        <h1 className="font-serif text-5xl tracking-tight text-foreground sm:text-6xl">
          Classical <span className="text-primary">Portal</span>
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Explore classical music your way
        </p>
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
