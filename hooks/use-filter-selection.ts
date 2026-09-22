"use client"

import { useEffect, useState } from "react"
import { applyFilterHistory } from "@/lib/filter-history"

/** Chip selection stored in `?filter=`, replaced in place so Back leaves the page. */
export function useFilterSelection(slugs: readonly string[]) {
  const allowedKey = slugs.join("\0")
  const [active, setActive] = useState("all")

  useEffect(() => {
    const allowed = new Set(allowedKey ? allowedKey.split("\0") : [])
    const apply = () => {
      const slug = new URLSearchParams(window.location.search).get("filter")
      setActive(slug && allowed.has(slug) ? slug : "all")
    }
    apply()
    window.addEventListener("popstate", apply)
    return () => window.removeEventListener("popstate", apply)
  }, [allowedKey])

  function select(slug: string) {
    if (slug === active) return
    setActive(slug)
    applyFilterHistory(window.history, window.location.href, slug)
  }

  return { active, select }
}
