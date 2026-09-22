"use client"

import { ComposerList } from "@/components/composer-list"
import { FilterChips } from "@/components/filter-chips"
import { useFilterSelection } from "@/hooks/use-filter-selection"
import type { OpenOpusComposer } from "@/lib/openopus"

export function PeriodComposerBrowser({
  composers,
  filters,
}: {
  composers: OpenOpusComposer[]
  filters: { slug: string; label: string; epoch: string; count: number }[]
}) {
  const { active, select } = useFilterSelection(filters.map((item) => item.slug))
  const epoch = filters.find((item) => item.slug === active)?.epoch
  const shown = epoch ? composers.filter((composer) => composer.epoch === epoch) : composers

  return (
    <>
      <FilterChips
        items={[
          { label: "All", active: active === "all", count: composers.length, onSelect: () => select("all") },
          ...filters.map((item) => ({
            label: item.label,
            active: active === item.slug,
            count: item.count,
            onSelect: () => select(item.slug),
          })),
        ]}
      />
      <ComposerList composers={shown} />
    </>
  )
}
