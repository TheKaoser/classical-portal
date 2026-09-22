import Link from "next/link"
import { EPOCHS } from "@/lib/epochs"

export function PeriodList({ showBlurb = false }: { showBlurb?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {EPOCHS.map((epoch) => (
        <li key={epoch.slug}>
          <Link
            href={`/periods/${epoch.slug}`}
            className="block py-4 hover:bg-accent/70 -mx-2 px-2 rounded-md"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-serif text-xl tracking-tight text-navy">{epoch.name}</span>
              <span className="shrink-0 text-sm text-muted-foreground">{epoch.years}</span>
            </div>
            {showBlurb ? (
              <p className="mt-1 text-sm text-muted-foreground">{epoch.blurb}</p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}
