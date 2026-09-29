/**
 * Browser sign-in for the Spotify embed. Not an OAuth login for this app.
 *
 * The embed decides full track vs 30-second preview when its document loads.
 * A Premium cookie (`sp_dc` on `.spotify.com`, `SameSite=None`) is sent to
 * `open.spotify.com` only when this browser still allows third-party cookies.
 * The frame then has to be created again; going Back restores the anonymous
 * frame from memory and it keeps playing previews.
 *
 * Spotify drops a `continue` value that is not on `*.spotify.com` or
 * `*.spotify.net`, so the login page cannot land on classicalportal.app.
 * Continuing to the accounts status page stays in the browser: `/en/login`
 * and `/en/status` are not iOS universal-link paths, and `open.spotify.com`
 * is, so that host would open the Spotify app. The portal opens this URL in
 * a separate window and reloads the embed when that window closes or this
 * page is shown again.
 *
 * Spotify's embed still forces preview playback for a phone or Safari user
 * agent even when the session is not anonymous. Signing in cannot unlock
 * full tracks there. This module does not start the Web Playback SDK.
 */

export const SPOTIFY_BROWSER_LOGIN_LABEL = "Sign in for full tracks"

export const SPOTIFY_BROWSER_LOGIN_TITLE =
  "Sign in to Spotify in this browser. This page stays open — close the Spotify window or switch back here. Premium plays full tracks on desktop Chrome and Edge."

const SPOTIFY_ACCOUNTS_LOGIN = "https://accounts.spotify.com/en/login"
const SPOTIFY_ACCOUNTS_STATUS = "https://accounts.spotify.com/en/status"

/** Separate window, not a new history entry on this page. No `noopener`: the opener has to see when it closes. */
export const SPOTIFY_BROWSER_LOGIN_FEATURES = "popup=yes,width=480,height=720"

export const SPOTIFY_BROWSER_LOGIN_PENDING_KEY = "cp-spotify-browser-login"

/** Ignore a sign-in flag left over from a previous visit. */
export const SPOTIFY_BROWSER_LOGIN_PENDING_MAX_MS = 30 * 60 * 1000

/**
 * Previews last 30 seconds. Anything longer is a full track, with a small
 * margin so a preview timestamp is not treated as one.
 */
export const EMBED_FULL_TRACK_MIN_MS = 31_000

/**
 * Fine-pointer desktops wait briefly so a Premium session can hide the prompt
 * before it paints. Touch screens show it immediately.
 */
export const DESKTOP_LOGIN_PROMPT_DELAY_MS = 1_000

export type BrowserLoginStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type BrowserLoginWindow = {
  closed: boolean
  focus?: () => void
}

export type BrowserLoginHost = {
  open: (url: string, target: string, features: string) => BrowserLoginWindow | null
  assign: (url: string) => void
  storage: BrowserLoginStorage
  now?: () => number
  /** `performance.timeOrigin`. A new document gets a new value; a restored page does not. */
  documentOrigin?: number
}

export function spotifyBrowserLoginHref(): string {
  const url = new URL(SPOTIFY_ACCOUNTS_LOGIN)
  url.searchParams.set("continue", SPOTIFY_ACCOUNTS_STATUS)
  return url.toString()
}

export function embedSessionHasFullTracks(durationMs: number | null | undefined): boolean {
  return typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > EMBED_FULL_TRACK_MIN_MS
}

export function spotifyBrowserLoginPromptDelayMs(coarsePointer: boolean): number {
  return coarsePointer ? 0 : DESKTOP_LOGIN_PROMPT_DELAY_MS
}

function pendingRecord(raw: string | null): { documentOrigin: number; at: number } | null {
  if (!raw) return null
  const [originText, atText] = raw.split(":")
  const documentOrigin = Number(originText)
  const at = Number(atText)
  if (!Number.isFinite(documentOrigin) || !Number.isFinite(at)) return null
  return { documentOrigin, at }
}

export function markSpotifyBrowserLoginPending(
  storage: BrowserLoginStorage,
  now = Date.now(),
  documentOrigin = 0
): void {
  try {
    storage.setItem(SPOTIFY_BROWSER_LOGIN_PENDING_KEY, `${documentOrigin}:${now}`)
  } catch {
    // Private mode can reject sessionStorage. Closing the login window still reloads the embed.
  }
}

export function spotifyBrowserLoginIsPending(
  storage: BrowserLoginStorage,
  now = Date.now(),
  maxAgeMs = SPOTIFY_BROWSER_LOGIN_PENDING_MAX_MS
): boolean {
  let raw: string | null
  try {
    raw = storage.getItem(SPOTIFY_BROWSER_LOGIN_PENDING_KEY)
  } catch {
    return false
  }
  const record = pendingRecord(raw)
  if (!record || now - record.at > maxAgeMs) {
    if (raw) clearSpotifyBrowserLoginPending(storage)
    return false
  }
  return true
}

/**
 * True when the pending sign-in was started on a different document. A fresh
 * load already creates a new embed. A back-forward cache restore keeps
 * `performance.timeOrigin`, so this stays false and the anonymous frame is
 * rebuilt instead.
 */
export function spotifyBrowserLoginIsNewDocument(storage: BrowserLoginStorage, documentOrigin: number): boolean {
  let raw: string | null
  try {
    raw = storage.getItem(SPOTIFY_BROWSER_LOGIN_PENDING_KEY)
  } catch {
    return false
  }
  const record = pendingRecord(raw)
  if (!record) return false
  return record.documentOrigin !== documentOrigin
}

export function clearSpotifyBrowserLoginPending(storage: BrowserLoginStorage): void {
  try {
    storage.removeItem(SPOTIFY_BROWSER_LOGIN_PENDING_KEY)
  } catch {
    // Ignore a storage area that is already unavailable.
  }
}

/**
 * Open Spotify sign-in without navigating this page away. Returns the new
 * window, or null when the browser blocked it and this page is navigating
 * instead (Back then restores it).
 */
export function openSpotifyBrowserLogin(host: BrowserLoginHost): BrowserLoginWindow | null {
  const now = host.now ?? Date.now
  markSpotifyBrowserLoginPending(host.storage, now(), host.documentOrigin ?? 0)
  const href = spotifyBrowserLoginHref()
  let opened: BrowserLoginWindow | null = null
  try {
    opened = host.open(href, "spotify-browser-login", SPOTIFY_BROWSER_LOGIN_FEATURES)
  } catch {
    opened = null
  }
  if (opened) {
    try {
      opened.focus?.()
    } catch {
      // A blocked focus call still leaves the window open.
    }
    return opened
  }
  host.assign(href)
  return null
}

export type LoginReturnWatch = {
  /** This page asked for a browser sign-in recently. */
  pending: boolean
  /** The sign-in window has closed. */
  popupClosed: boolean
  /** This page was hidden and is visible again. */
  becameVisible: boolean
  /** The back-forward cache restored this page. */
  restoredFromCache: boolean
}

/**
 * Recreate the embed after sign-in. While the login window is still open,
 * switching back also counts: on a phone that window is another tab, and
 * closing it is easy to miss. The caller clears the pending flag so a later
 * tab switch does not restart playback.
 */
export function shouldReloadEmbedForLogin(watch: LoginReturnWatch): boolean {
  if (watch.popupClosed) return true
  if (!watch.pending) return false
  return watch.becameVisible || watch.restoredFromCache
}
