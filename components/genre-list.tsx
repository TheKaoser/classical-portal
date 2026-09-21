import Link from "next/link"
import { genreHref, type GenreSummary } from "@/lib/openopus"
import { cn } from "@/lib/utils"

const ACCENTS = [
  {
    bar: "bg-navy",
    surface: "border-navy/15 bg-white/75 hover:border-navy/30 hover:bg-navy/5",
    meta: "text-navy/70",
  },
  {
    bar: "bg-blue-mid",
    surface: "border-blue-mid/20 bg-white/75 hover:border-blue-mid/40 hover:bg-blue-mid/5",
    meta: "text-blue-mid",
  },
  {
    bar: "bg-blue-bright",
    surface: "border-blue-bright/20 bg-white/75 hover:border-blue-bright/40 hover:bg-blue-bright/5",
    meta: "text-blue-bright",
  },
] as const

export function GenreList({ genres }: { genres: GenreSummary[] }) {
  return (
    <ul className="grid gap-3">
      {genres.map((genre, index) => {
        const accent = ACCENTS[index % ACCENTS.length]
        return (
          <li key={genre.slug}>
            <Link
              href={genreHref(genre.name)}
              className={cn(
                "flex w-full items-stretch overflow-hidden rounded-xl border shadow-sm transition-colors",
                accent.surface
              )}
            >
              <span aria-hidden className={cn("w-1.5 shrink-0", accent.bar)} />
              <span className="flex min-w-0 flex-1 items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6">
                <span className="font-medium text-navy">{genre.name}</span>
                <span className={cn("shrink-0 text-sm", accent.meta)}>
                  {genre.popularCount} popular
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
