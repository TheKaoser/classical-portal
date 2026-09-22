/**
 * Helpers for the in-app Back control: prefer real browser history when the
 * user arrived via client navigation (including genre pages), otherwise fall
 * back to a known parent route.
 */

export const APP_NAV_SESSION_KEY = "cp_has_app_history"

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
