import Link from "next/link"
import { EPOCHS } from "@/lib/epochs"
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

export function PeriodList({ showBlurb = false }: { showBlurb?: boolean }) {
  return (
    <ul className="grid gap-3">
      {EPOCHS.map((epoch, index) => {
        const accent = ACCENTS[index % ACCENTS.length]
        return (
          <li key={epoch.slug}>
            <Link
              href={`/periods/${epoch.slug}`}
              className={cn(
                "flex w-full items-stretch overflow-hidden rounded-xl border shadow-sm transition-colors",
                accent.surface
              )}
            >
              <span aria-hidden className={cn("w-1.5 shrink-0", accent.bar)} />
              <span
                className={cn(
                  "flex min-w-0 flex-1 flex-col justify-center px-5 sm:px-6",
                  showBlurb ? "py-4" : "py-3.5"
                )}
              >
                <span className="flex items-baseline justify-between gap-4">
                  <span
                    className={cn(
                      "text-navy",
                      showBlurb ? "font-serif text-xl tracking-tight" : "font-medium"
                    )}
                  >
                    {epoch.name}
                  </span>
                  <span className={cn("shrink-0 text-sm", accent.meta)}>{epoch.years}</span>
                </span>
                {showBlurb ? (
                  <span className="mt-1 text-sm text-muted-foreground">{epoch.blurb}</span>
                ) : null}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
