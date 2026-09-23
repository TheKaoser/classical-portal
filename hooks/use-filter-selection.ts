"use client"

import { useEffect, useState } from "react"
import { applyFilterHistory, readFilterSlug } from "@/lib/filter-history"
import { notifyScreenHref } from "@/lib/navigation-history"

type FilterSelectionOptions = {
  /** Slug stored as the absence of `?filter=`. Defaults to `all`. */
  emptySlug?: string
  /** Server-resolved chip for the first paint. Falls back to `emptySlug`. */
  initialSlug?: string
  /** Legacy query values rewritten before the allow-list check. */
  aliases?: Readonly<Record<string, string>>
}

/** Chip selection stored in `?filter=`, replaced in place so Back leaves the page. */
export function useFilterSelection(slugs: readonly string[], options?: FilterSelectionOptions) {
  const emptySlug = options?.emptySlug ?? "all"
  const initialSlug = options?.initialSlug ?? emptySlug
  const aliasKey = JSON.stringify(options?.aliases ?? {})
  const allowedKey = slugs.join("\0")
  const [active, setActive] = useState(initialSlug)

  useEffect(() => {
    const allowed = new Set(allowedKey ? allowedKey.split("\0") : [])
    const aliases = JSON.parse(aliasKey) as Record<string, string>
    const apply = () => {
      setActive(readFilterSlug(window.location.search, allowed, emptySlug, aliases))
    }
    apply()
    window.addEventListener("popstate", apply)
    return () => window.removeEventListener("popstate", apply)
  }, [allowedKey, aliasKey, emptySlug])

  function select(slug: string) {
    if (slug === active) return
    setActive(slug)
    applyFilterHistory(window.history, window.location.href, slug, emptySlug)
    notifyScreenHref()
  }

  return { active, select }
}
