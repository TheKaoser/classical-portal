import { SearchComponent } from "./search-component"
import { PeriodsGrid } from "./periods-grid"
import { getCachedPeriods } from "@/services/periods.service"

export default async function PeriodsPage() {
  const periods = await getCachedPeriods()
  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#29323E]" >
            Musical Periods
          </h1>
        </div>
      </div>

      <SearchComponent />
      <PeriodsGrid periods={periods} />
    </div>
  )
}
