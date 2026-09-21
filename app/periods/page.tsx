import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { EPOCHS } from "@/lib/epochs"

export const metadata: Metadata = {
  title: "Periods",
}

export default function PeriodsPage() {
  return (
    <div>
      <PageHeader title="Periods" backHref="/" backLabel="Home" />
      <ul className="divide-y divide-border">
        {EPOCHS.map((epoch) => (
          <li key={epoch.slug}>
            <Link
              href={`/periods/${epoch.slug}`}
              className="block py-4 hover:bg-accent/40 -mx-2 px-2 rounded-md"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-serif text-xl tracking-tight">{epoch.name}</span>
                <span className="text-sm text-muted-foreground">{epoch.years}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{epoch.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
