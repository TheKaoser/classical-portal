"use client"

import { useEffect, useState } from "react"
import { FilterChips } from "@/components/filter-chips"
import { WorkList } from "@/components/work-list"
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
  const [active, setActive] = useState("all")

  useEffect(() => {
    const apply = () => {
      const slug = new URLSearchParams(window.location.search).get("filter")
      setActive(slug && filters.some((item) => item.slug === slug) ? slug : "all")
    }
    apply()
    window.addEventListener("popstate", apply)
    return () => window.removeEventListener("popstate", apply)
  }, [filters])

  function select(slug: string) {
    if (slug === active) return
    setActive(slug)
    const url = new URL(window.location.href)
    if (slug === "all") url.searchParams.delete("filter")
    else url.searchParams.set("filter", slug)
    // Avoid passing Next's __NA state through: the patched history.pushState
    // then copies internals and syncs search params into the App Router, so
    // Back from a work restores this filtered genre URL cleanly.
    window.history.pushState({}, "", `${url.pathname}${url.search}`)
  }

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
