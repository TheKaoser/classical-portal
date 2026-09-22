"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { writeAppHistoryMarker } from "@/lib/navigation-history"

/**
 * Marks that this tab has performed at least one in-app client navigation.
 * Used by BackLink so genre → work → Back returns to that genre instead of a
 * hardcoded parent, while deep links still fall back to the known parent href.
 */
export function AppNavigationMarker() {
  const pathname = usePathname()
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    writeAppHistoryMarker(typeof sessionStorage === "undefined" ? null : sessionStorage)
  }, [pathname])

  return null
}
