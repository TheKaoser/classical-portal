"use client"

import { FilterChips } from "@/components/filter-chips"
import { WorkList } from "@/components/work-list"
import { useFilterSelection } from "@/hooks/use-filter-selection"
import type { OpenOpusWork } from "@/lib/openopus"

type BrowserWork = OpenOpusWork & {
  composerLabel?: string
  compositionYear?: number | null
  subtype: string | null
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
      <WorkList works={active === "all" ? works : works.filter((work) => work.subtype === active)} />
    </>
  )
}
