/**
 * Browser sign-in for the Spotify embed. Not an OAuth login for this app.
 *
 * The embed plays full tracks when this browser already has a Spotify Premium
 * session. Otherwise it plays a 30-second preview. A normal https link to
 * accounts.spotify.com stays in the mobile browser: /en/login is not an iOS
 * universal-link path, and open.spotify.com is, so the app would open instead.
 *
 * Spotify does not honor a continue target outside its own sites (a
 * classicalportal.app value is dropped, and it is not an OAuth redirect_uri).
 * Continuing to the accounts status page keeps the page after login in the
 * browser. Back returns to Classical Portal.
 */

export const SPOTIFY_BROWSER_LOGIN_LABEL = "Sign in for full tracks"

export const SPOTIFY_BROWSER_LOGIN_TITLE =
  "Sign in to Spotify in this browser, then use Back to return. Premium plays full tracks here."

const SPOTIFY_ACCOUNTS_LOGIN = "https://accounts.spotify.com/en/login"
const SPOTIFY_ACCOUNTS_STATUS = "https://accounts.spotify.com/en/status"

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
