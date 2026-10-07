"use client"

import { useCallback, useEffect, useState } from "react"
import { Share, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SITE_NAME } from "@/lib/site"

const STORAGE_KEY = "cp-install-prompt"
const DISMISS_MS = 21 * 24 * 60 * 60 * 1000
const SHOW_DELAY_MS = 8000

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string }
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

function isSuppressed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    if (raw === "installed") return true
    const at = Number(raw)
    return Number.isFinite(at) && Date.now() - at < DISMISS_MS
  } catch {
    return false
  }
}

function remember(value: string) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {}
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const iPadDesktop = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
  if (!/iPhone|iPad|iPod/.test(ua) && !iPadDesktop) return false
  // Exclude in-app browsers and Firefox/Opera/Edge/Chrome wrappers.
  return /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\/|GSA\//.test(ua)
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (isStandalone() || isSuppressed()) return

    setIos(isIosSafari())

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      remember("installed")
      setDeferred(null)
      setClosed(true)
    }
    const onEngage = () => setEngaged(true)

    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    window.addEventListener("scroll", onEngage, { once: true, passive: true })
    window.addEventListener("pointerdown", onEngage, { once: true, passive: true })
    const timer = window.setTimeout(() => setTimeUp(true), SHOW_DELAY_MS)

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
      window.removeEventListener("scroll", onEngage)
      window.removeEventListener("pointerdown", onEngage)
      window.clearTimeout(timer)
    }
  }, [])

  const dismiss = useCallback(() => {
    remember(String(Date.now()))
    setClosed(true)
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    setClosed(true)
    try {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      remember(outcome === "accepted" ? "installed" : String(Date.now()))
    } catch {
      remember(String(Date.now()))
    }
    setDeferred(null)
  }, [deferred])

  if (closed || !timeUp || !engaged || (!deferred && !ios)) return null

  return (
    <div
      role="region"
      aria-label={`Install ${SITE_NAME}`}
      className="fixed inset-x-3 z-40 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 sm:left-auto sm:right-4 sm:w-80"
      style={{ top: "calc(4.5rem + env(safe-area-inset-top, 0px))" }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Close"
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" />
      </button>
      <p className="pr-6 text-sm font-medium">Install {SITE_NAME}</p>
      {deferred ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Add it to your device for quick access in its own window.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Tap <Share className="mx-0.5 inline size-4 align-text-bottom" aria-label="Share" /> Share, then
          &ldquo;Add to Home Screen&rdquo;.
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Not now
        </Button>
        {deferred ? (
          <Button size="sm" onClick={install}>
            Install
          </Button>
        ) : null}
      </div>
    </div>
  )
}
