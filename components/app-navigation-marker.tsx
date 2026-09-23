"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import {
  notifyScreenStack,
  readScreenStack,
  recordScreen,
  SCREEN_HREF_EVENT,
  screenLabel,
  writeAppHistoryMarker,
  writeScreenStack,
} from "@/lib/navigation-history"

/**
 * Remembers each screen this tab opens, and that an in-app navigation happened.
 * Back uses the remembered label so genre → work says the genre, not the
 * composer fallback. Deep links still fall back to the known parent href.
 * Chip changes share a pathname, so they update the current screen instead of
 * pushing another one.
 */
export function AppNavigationMarker() {
  const pathname = usePathname()
  const isFirst = useRef(true)

  useEffect(() => {
    const storage = typeof sessionStorage === "undefined" ? null : sessionStorage

    function remember() {
      const label = screenLabel(pathname, document.querySelector("main h1")?.textContent)
      const href = `${window.location.pathname}${window.location.search}`
      writeScreenStack(storage, recordScreen(readScreenStack(storage), { path: pathname, href, label }))
      notifyScreenStack()
    }

    remember()
    if (isFirst.current) isFirst.current = false
    else writeAppHistoryMarker(storage)

    window.addEventListener(SCREEN_HREF_EVENT, remember)
    return () => window.removeEventListener(SCREEN_HREF_EVENT, remember)
  }, [pathname])

  return null
}
