import Link from "next/link"
import { EPOCHS } from "@/lib/epochs"
import { cn } from "@/lib/utils"

const ACCENTS = [
  {
    surface:
      "border-navy/15 bg-gradient-to-br from-navy/10 via-white to-blue-mid/[0.07] hover:border-navy/30",
    meta: "text-navy/70",
  },
  {
    surface:
      "border-blue-mid/20 bg-gradient-to-br from-blue-mid/10 via-white to-blue-bright/[0.08] hover:border-blue-mid/40",
    meta: "text-blue-mid",
  },
  {
    surface:
      "border-blue-bright/25 bg-gradient-to-br from-blue-bright/10 via-white to-blue-mid/[0.08] hover:border-blue-bright/45",
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
                "block w-full rounded-xl border px-5 shadow-sm transition-colors sm:px-6",
                showBlurb ? "py-4" : "py-3.5",
                accent.surface
              )}
            >
              <span className="flex min-w-0 flex-col justify-center">
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
