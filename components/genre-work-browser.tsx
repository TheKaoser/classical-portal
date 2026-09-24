"use client"

import { FilterChips } from "@/components/filter-chips"
import { WorkList } from "@/components/work-list"
import { WorkListPlayback } from "@/components/work-list-playback"
import { useFilterSelection } from "@/hooks/use-filter-selection"
import type { CompositionDate } from "@/lib/composition-label"
import type { OpenOpusWork } from "@/lib/openopus"
import { filterWorksByListedFilter } from "@/lib/work-subtypes"

type BrowserWork = OpenOpusWork & {
  composerLabel?: string
  compositionDate?: CompositionDate | null
  compositionYear?: number | null
  subtype: string | null
  composer?: { name: string; complete_name?: string }
}

export function GenreWorkBrowser({
  works,
  filters,
  oauthConfigured,
}: {
  works: BrowserWork[]
  filters: { slug: string; label: string; count: number }[]
  oauthConfigured: boolean
}) {
  const { active, select } = useFilterSelection(filters.map((item) => item.slug))
  const visible = filterWorksByListedFilter(works, active)

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
      <WorkListPlayback oauthConfigured={oauthConfigured} works={visible}>
        <WorkList works={visible} />
      </WorkListPlayback>
    </>
  )
}
