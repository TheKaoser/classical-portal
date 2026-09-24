import Link from "next/link"
import { Sparkles } from "lucide-react"
import { BrandMark } from "@/components/brand-mark"
import { HomePortal, type PortalVariant } from "@/components/home-portal"
import { Button } from "@/components/ui/button"

const ENTRIES = [
  { href: "/periods", title: "Periods" },
  { href: "/genres", title: "Genres" },
  { href: "/composers", title: "Composers" },
] as const

/** Default ring. Preview the other with `?portal=modern` or `?portal=antique`. */
const DEFAULT_PORTAL_VARIANT = "modern" satisfies PortalVariant

function portalVariant(value: string | string[] | undefined): PortalVariant {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === "modern" || raw === "antique") return raw
  return DEFAULT_PORTAL_VARIANT
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string | string[] }>
}) {
  const { portal } = await searchParams
  const variant = portalVariant(portal)

  return (
    <div className="pt-24 text-center sm:pt-32 md:pt-40">
      <HomePortal variant={variant}>
        <section className="space-y-3 sm:space-y-4 md:space-y-5">
          <h1 className="font-serif text-[clamp(2rem,(100vw-2.5rem)/6.35,4rem)] leading-none tracking-tight sm:text-7xl">
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
          className="mt-14 flex flex-col items-center gap-24 sm:mt-16 sm:gap-32 md:mt-20 md:gap-40"
          aria-label="Browse catalog"
        >
          <Button
            asChild
            className="mx-auto h-11 w-fit self-center px-6 text-base shadow-raised has-[>svg]:px-6 sm:h-12 sm:px-7 sm:has-[>svg]:px-7"
          >
            <Link href="/discover">
              <Sparkles aria-hidden="true" />
              Discovery of the day
            </Link>
          </Button>
          <div className="mx-auto grid w-full max-w-2xl grid-cols-3">
            {ENTRIES.map(({ href, title }) => (
              <Link
                key={href}
                href={href}
                className="justify-self-center whitespace-nowrap text-center text-base font-medium tracking-tight text-primary outline-none transition-colors hover:text-primary-hover focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-[360px]:text-xl sm:text-2xl md:text-3xl"
              >
                {title}
              </Link>
            ))}
          </div>
        </nav>
      </HomePortal>
    </div>
  )
}
