import { CatalogTile } from "@/components/catalog-icon"
import { ListLink } from "@/components/list-link"
import { catalogAccent } from "@/lib/accents"
import { EPOCHS } from "@/lib/epochs"

export function PeriodList({ showBlurb = false }: { showBlurb?: boolean }) {
  return (
    <ul className="space-y-1">
      {EPOCHS.map((epoch, index) => {
        const accent = catalogAccent(index)
        return (
          <li key={epoch.slug}>
            <ListLink href={`/periods/${epoch.slug}`}>
              <CatalogTile kind="period" slug={epoch.slug} label={epoch.name} className={accent.tile} />
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
