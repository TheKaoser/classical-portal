"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSyncExternalStore } from "react"
import { ArrowLeft } from "lucide-react"
import type { MouseEvent } from "react"
import {
  previousScreen,
  readAppHistoryMarker,
  readHistoryIndex,
  readScreenStack,
  SCREEN_STACK_EVENT,
  shouldUseHistoryBack,
} from "@/lib/navigation-history"

function historyBackTarget(): { href: string; label: string } | null {
  const useHistory = shouldUseHistoryBack({
    hasAppHistoryMarker: readAppHistoryMarker(sessionStorage),
    historyLength: window.history.length,
    historyIndex: readHistoryIndex(window.history.state),
    referrer: document.referrer,
    currentOrigin: window.location.origin,
  })
  if (!useHistory) return null
  return previousScreen(readScreenStack(sessionStorage), window.location.pathname)
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(SCREEN_STACK_EVENT, onStoreChange)
  window.addEventListener("popstate", onStoreChange)
  return () => {
    window.removeEventListener(SCREEN_STACK_EVENT, onStoreChange)
    window.removeEventListener("popstate", onStoreChange)
  }
}

function clientSnapshot(): string {
  const target = historyBackTarget()
  return target ? `${target.label}\n${target.href}` : ""
}

function serverSnapshot(): string {
  return ""
}

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
  const serialized = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  const splitAt = serialized.indexOf("\n")
  const historyLabel = splitAt >= 0 ? serialized.slice(0, splitAt) : ""
  const historyHref = splitAt >= 0 ? serialized.slice(splitAt + 1) : ""
  const shownLabel = historyLabel || label || "Back"
  const shownHref = historyHref || href

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented) return
    if (event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (!historyBackTarget()) return

    event.preventDefault()
    router.back()
  }

  return (
    <Link href={shownHref} onClick={onClick} className={className}>
      <ArrowLeft className="pointer-events-none h-4 w-4" aria-hidden="true" />
      {shownLabel}
    </Link>
  )
}
