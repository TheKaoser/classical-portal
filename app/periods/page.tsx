import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { PeriodList } from "@/components/period-list"

export const metadata: Metadata = {
  title: "Periods",
}

export default function PeriodsPage() {
  return (
    <div>
      <PageHeader title="Periods" backHref="/" backLabel="Home" />
      <PeriodList showBlurb />
    </div>
  )
}
