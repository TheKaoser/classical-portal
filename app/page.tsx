import Link from "next/link"
import { ArrowRight, Library, Music } from "lucide-react"

const BANNERS = [
  {
    href: "/periods",
    title: "Periods",
    text: "Browse composers by era, from medieval chant to music written today.",
    icon: Library,
    accent: "bg-navy",
    wash: "from-white via-white to-slate-100",
  },
  {
    href: "/genres",
    title: "Genres",
    text: "Browse works by form — symphonies, sonatas, operas, and more.",
    icon: Music,
    accent: "bg-blue-bright",
    wash: "from-white via-white to-blue-50",
  },
] as const

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-card/80 px-6 py-10 shadow-sm sm:px-10 sm:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-navy via-blue-mid to-blue-bright"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--shell-from)] via-[var(--shell-via)] to-[var(--shell-to)]"
        />
        <div className="relative space-y-3 pl-3">
          <h1 className="font-serif text-4xl tracking-tight text-brand-gradient sm:text-5xl">
            Classical Portal
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Explore classical music your way, listen on Spotify
          </p>
        </div>
      </section>

      <div className="grid gap-4">
        {BANNERS.map((banner) => {
          const Icon = banner.icon
          return (
            <Link
              key={banner.href}
              href={banner.href}
              className={`group relative flex items-center gap-5 overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-r ${banner.wash} px-6 py-8 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 sm:px-8 sm:py-10`}
            >
              <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${banner.accent}`} />
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/80 text-primary shadow-sm ring-1 ring-primary/10">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <h2 className="font-serif text-3xl tracking-tight text-navy sm:text-4xl">{banner.title}</h2>
                <span className="mt-1 block text-sm text-muted-foreground sm:text-base">{banner.text}</span>
              </span>
              <ArrowRight
                className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
