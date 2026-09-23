/**
 * Helpers for the in-app Back control: prefer real browser history when the
 * user arrived via client navigation (including genre pages), otherwise fall
 * back to a known parent route.
 */

export const APP_NAV_SESSION_KEY = "cp_has_app_history"

/** In-tab record of screens the listener has actually opened. */
export const SCREEN_STACK_KEY = "cp_screen_stack"

/** Fired after the screen stack changes so Back can refresh its label. */
export const SCREEN_STACK_EVENT = "cp-screen-stack"

/** Fired when a chip replaceState updates the current screen URL. */
export const SCREEN_HREF_EVENT = "cp-screen-href"

export type ScreenRecord = {
  /** Pathname only. Chip queries stay on this same screen. */
  path: string
  /** Path plus query, so a filtered genre is the URL Back returns to. */
  href: string
  label: string
}

const SCREEN_STACK_LIMIT = 40

export function screenLabel(pathname: string, heading: string | null | undefined): string {
  if (pathname === "/") return "Home"
  const text = heading?.replace(/\s+/g, " ").trim()
  return text || "Back"
}

export function recordScreen(stack: readonly ScreenRecord[], screen: ScreenRecord): ScreenRecord[] {
  const top = stack[stack.length - 1]
  if (top && top.path === screen.path) {
    if (top.href === screen.href && top.label === screen.label) return stack.slice()
    return [...stack.slice(0, -1), screen]
  }

  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].path === screen.path) {
      return [...stack.slice(0, index), screen]
    }
  }

  const next = [...stack, screen]
  return next.length > SCREEN_STACK_LIMIT ? next.slice(next.length - SCREEN_STACK_LIMIT) : next
}

/**
 * Screen Back returns to. If this pathname is not recorded yet (the visit
 * just started), the stack top is that previous screen.
 */
export function previousScreen(
  stack: readonly ScreenRecord[],
  pathname: string
): ScreenRecord | null {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].path !== pathname) continue
    return index > 0 ? stack[index - 1] : null
  }
  return stack[stack.length - 1] ?? null
}

export function readScreenStack(
  storage: Pick<Storage, "getItem"> | null | undefined
): ScreenRecord[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(SCREEN_STACK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return []
      const record = entry as { path?: unknown; href?: unknown; label?: unknown }
      if (typeof record.path !== "string" || typeof record.href !== "string") return []
      if (typeof record.label !== "string" || !record.label) return []
      return [{ path: record.path, href: record.href, label: record.label }]
    })
  } catch {
    return []
  }
}

export function writeScreenStack(
  storage: Pick<Storage, "setItem"> | null | undefined,
  stack: readonly ScreenRecord[]
): void {
  if (!storage) return
  try {
    storage.setItem(SCREEN_STACK_KEY, JSON.stringify(stack))
  } catch {
    // Ignore quota / private-mode failures; Back keeps the fallback label.
  }
}

export function notifyScreenHref(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SCREEN_HREF_EVENT))
}

export function notifyScreenStack(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SCREEN_STACK_EVENT))
}

export function readHistoryIndex(state: unknown): number | null {
  if (!state || typeof state !== "object") return null
  const idx = (state as { idx?: unknown }).idx
  return typeof idx === "number" && Number.isFinite(idx) ? idx : null
}

export function isSameOriginReferrer(referrer: string, currentOrigin: string): boolean {
  if (!referrer || !currentOrigin) return false
  try {
    return new URL(referrer).origin === currentOrigin
  } catch {
    return false
  }
}

/**
 * Decide whether Back should call history.back() / router.back().
 * Prefer history for in-app navigations; avoid sending deep-link users to
 * an external previous tab entry (e.g. a search engine).
 */
export function shouldUseHistoryBack(input: {
  hasAppHistoryMarker: boolean
  historyLength: number
  historyIndex: number | null
  referrer: string
  currentOrigin: string
}): boolean {
  if (typeof input.historyIndex === "number") {
    return input.historyIndex > 0
  }

  if (input.hasAppHistoryMarker && input.historyLength > 1) {
    return true
  }

  if (input.historyLength > 1 && isSameOriginReferrer(input.referrer, input.currentOrigin)) {
    return true
  }

  return false
}

export function readAppHistoryMarker(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  if (!storage) return false
  try {
    return storage.getItem(APP_NAV_SESSION_KEY) === "1"
  } catch {
    return false
  }
}

export function writeAppHistoryMarker(storage: Pick<Storage, "setItem"> | null | undefined): void {
  if (!storage) return
  try {
    storage.setItem(APP_NAV_SESSION_KEY, "1")
  } catch {
    // Ignore quota / private-mode failures; Back falls back to href.
  }
}
