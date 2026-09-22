"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import type { MouseEvent } from "react"
import {
  readAppHistoryMarker,
  readHistoryIndex,
  shouldUseHistoryBack,
} from "@/lib/navigation-history"

export function BackLink({
  href,
  label,
  className,
}: {
  href: string
  label?: string
  className?: string
}) {
  const router = useRouter()

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented) return
    if (event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const useHistory = shouldUseHistoryBack({
      hasAppHistoryMarker: readAppHistoryMarker(
        typeof sessionStorage === "undefined" ? null : sessionStorage
      ),
      historyLength: window.history.length,
      historyIndex: readHistoryIndex(window.history.state),
      referrer: document.referrer,
      currentOrigin: window.location.origin,
    })

    if (!useHistory) return

    event.preventDefault()
    router.back()
  }

  return (
    <Link href={href} onClick={onClick} className={className}>
      <ArrowLeft className="pointer-events-none h-4 w-4" aria-hidden="true" />
      {label || "Back"}
    </Link>
  )
}
