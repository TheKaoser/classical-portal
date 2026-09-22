import { ListLink } from "@/components/list-link"
import { catalogAccent } from "@/lib/accents"
import { EPOCHS } from "@/lib/epochs"
import { cn } from "@/lib/utils"

export function PeriodList({ showBlurb = false }: { showBlurb?: boolean }) {
  return (
    <ul className="space-y-1">
      {EPOCHS.map((epoch, index) => {
        const accent = catalogAccent(index)
        return (
          <li key={epoch.slug}>
            <ListLink href={`/periods/${epoch.slug}`}>
              <span
                aria-hidden
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-medium",
                  accent.tile
                )}
              >
                {epoch.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="flex items-baseline justify-between gap-4">
                  <span className="text-base font-medium text-foreground group-hover:text-primary">{epoch.name}</span>
                  <span className="shrink-0 text-sm text-muted-foreground">{epoch.years}</span>
                </span>
                {showBlurb ? <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{epoch.blurb}</p> : null}
              </span>
            </ListLink>
          </li>
        )
      })}
    </ul>
  )
}
