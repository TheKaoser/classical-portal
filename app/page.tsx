import Link from "next/link"
import { BrandMark } from "@/components/brand-mark"

const ENTRIES = [
  { href: "/periods", title: "Periods" },
  { href: "/genres", title: "Genres" },
  { href: "/composers", title: "Composers" },
] as const

export default function HomePage() {
  return (
    <div className="pt-24 text-center sm:pt-32 md:pt-40">
      <section className="space-y-8 sm:space-y-12 md:space-y-16">
        <h1 className="font-serif text-[clamp(2rem,(100vw-2.5rem)/7.35,3rem)] leading-none tracking-tight sm:text-6xl">
          <span className="sr-only">Classical Portal</span>
          <span
            className="inline-flex items-baseline justify-center whitespace-nowrap"
            aria-hidden="true"
          >
            {/* Lower curl is the open C. Half of the 3.05em cap-height match; a deeper translate sits the bowl under the wordmark baseline, with a hairline gap before “lassical”. */}
            <BrandMark
              decorative
              className="mr-[0.02em] h-[1.525em] w-auto shrink-0 translate-y-[0.11em]"
            />
            <span className="title-gradient">lassical Portal</span>
          </span>
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Explore classical music your way.
        </p>
      </section>

      <nav
        className="mt-40 flex flex-nowrap items-center justify-center gap-8 sm:mt-48 sm:gap-16 md:mt-52 md:gap-24"
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
