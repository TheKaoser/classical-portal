import { PageHeader } from "@/components/page-header"
import { PeriodList } from "@/components/period-list"
import { EPOCHS } from "@/lib/epochs"
import { pageMetadata, periodsIndexDescription } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Periods",
  description: periodsIndexDescription(EPOCHS.map((epoch) => epoch.name)),
  path: "/periods",
})

export default function PeriodsPage() {
  return (
    <div>
      <PageHeader title="Periods" backHref="/" backLabel="Home" />
      <PeriodList showBlurb />
    </div>
  )
}
