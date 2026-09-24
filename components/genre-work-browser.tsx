"use client"

import { FilterChips } from "@/components/filter-chips"
import { WorkList } from "@/components/work-list"
import { useFilterSelection } from "@/hooks/use-filter-selection"
import type { CompositionDate } from "@/lib/composition-label"
import type { OpenOpusWork } from "@/lib/openopus"
import { filterWorksByListedFilter } from "@/lib/work-subtypes"

type BrowserWork = OpenOpusWork & {
  composerLabel?: string
  compositionDate?: CompositionDate | null
  compositionYear?: number | null
  subtype: string | null
  instrument?: string | null
  composer?: { name: string; complete_name?: string }
}

export function GenreWorkBrowser({
  works,
  filters,
}: {
  works: BrowserWork[]
  filters: { slug: string; label: string; count: number }[]
}) {
  const { active, select } = useFilterSelection(filters.map((item) => item.slug))

  return (
    <>
      <FilterChips
        items={[
          { label: "All", active: active === "all", count: works.length, onSelect: () => select("all") },
          ...filters.map((item) => ({
            label: item.label,
            active: active === item.slug,
            count: item.count,
            onSelect: () => select(item.slug),
          })),
        ]}
      />
      <WorkList works={filterWorksByListedFilter(works, active)} />
    </>
  )
}
