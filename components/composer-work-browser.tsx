"use client"

import { FilterChips } from "@/components/filter-chips"
import { WorkList } from "@/components/work-list"
import { WorkListPlayback } from "@/components/work-list-playback"
import { useFilterSelection } from "@/hooks/use-filter-selection"
import { isPopular } from "@/lib/popularity"

const FILTER_ALIASES = { recommended: "popular" }

type BrowserWork = {
  id: string
  title: string
  subtitle?: string
  genre: string
  popular?: string | number
  recommended?: string | number
  compositionYear?: number | null
  popularityOrder: number
  chronoOrder: number
}

function byOrder(order: "popularityOrder" | "chronoOrder") {
  return (a: BrowserWork, b: BrowserWork) => a[order] - b[order]
}

function groupsFor(works: BrowserWork[]) {
  const groups = new Map<string, BrowserWork[]>()
  for (const work of works) {
    const genre = work.genre || "Other"
    const list = groups.get(genre)
    if (list) list.push(work)
    else groups.set(genre, [work])
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([genre, list]) => ({
      genre,
      works: list.sort(byOrder("popularityOrder")),
    }))
}

export function ComposerWorkBrowser({
  works,
  filters,
  defaultFilter,
  initialFilter,
  oauthConfigured,
}: {
  works: BrowserWork[]
  filters: { slug: string; label: string; count: number }[]
  defaultFilter: string
  initialFilter: string
  oauthConfigured: boolean
}) {
  const { active, select } = useFilterSelection(
    filters.map((item) => item.slug),
    { emptySlug: defaultFilter, initialSlug: initialFilter, aliases: FILTER_ALIASES }
  )

  const filtered =
    active === "all"
      ? works
      : active === "popular"
        ? works.filter((work) => isPopular(work))
        : works.filter((work) => work.genre === active)

  const grouped = active === "popular" ? groupsFor(filtered) : null
  const sections =
    grouped && grouped.length > 0
      ? grouped
      : [
          {
            genre: active,
            works: [...filtered].sort(byOrder(active === "all" ? "chronoOrder" : "popularityOrder")),
          },
        ]
  const visible = sections.flatMap((section) => section.works)

  return (
    <>
      <FilterChips
        items={filters.map((item) => ({
          label: item.label,
          active: active === item.slug,
          count: item.count,
          onSelect: () => select(item.slug),
        }))}
      />
      <WorkListPlayback oauthConfigured={oauthConfigured} works={visible}>
        {active === "all" ? (
          <WorkList works={visible} showGenre />
        ) : (
          <div className="space-y-8">
            {sections.map((group) => (
              <section key={group.genre}>
                {grouped && grouped.length > 1 ? (
                  <h2 className="mb-2 px-3 text-sm font-medium text-primary">{group.genre}</h2>
                ) : null}
                <WorkList works={group.works} />
              </section>
            ))}
          </div>
        )}
      </WorkListPlayback>
    </>
  )
}
