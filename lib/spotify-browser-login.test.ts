import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  DESKTOP_LOGIN_PROMPT_DELAY_MS,
  EMBED_FULL_TRACK_MIN_MS,
  SPOTIFY_BROWSER_LOGIN_FEATURES,
  SPOTIFY_BROWSER_LOGIN_LABEL,
  SPOTIFY_BROWSER_LOGIN_PENDING_KEY,
  SPOTIFY_BROWSER_LOGIN_PENDING_MAX_MS,
  clearSpotifyBrowserLoginPending,
  embedSessionHasFullTracks,
  openSpotifyBrowserLogin,
  shouldReloadEmbedForLogin,
  spotifyBrowserLoginHref,
  spotifyBrowserLoginIsNewDocument,
  spotifyBrowserLoginIsPending,
  spotifyBrowserLoginPromptDelayMs,
  type BrowserLoginStorage,
} from "./spotify-browser-login.ts"

function memoryStorage(): BrowserLoginStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

test("browser login is an https link on accounts.spotify.com", () => {
  const href = spotifyBrowserLoginHref()
  const url = new URL(href)
  assert.equal(url.protocol, "https:")
  assert.equal(url.host, "accounts.spotify.com")
  assert.equal(url.pathname, "/en/login")
  assert.equal(url.searchParams.get("continue"), "https://accounts.spotify.com/en/status")
  assert.equal(href.includes("open.spotify.com"), false)
  assert.equal(href.includes("spotify:"), false)
  assert.equal(href.includes("intent:"), false)
  assert.equal(href.includes("authorize"), false)
  assert.equal(href.includes("client_id"), false)
  assert.equal(href.includes("redirect_uri"), false)
  assert.equal(href.includes("classicalportal.app"), false)
})

test("full tracks are longer than a 30 second preview", () => {
  assert.equal(embedSessionHasFullTracks(30_000), false)
  assert.equal(embedSessionHasFullTracks(EMBED_FULL_TRACK_MIN_MS), false)
  assert.equal(embedSessionHasFullTracks(EMBED_FULL_TRACK_MIN_MS + 1), true)
  assert.equal(embedSessionHasFullTracks(180_000), true)
  assert.equal(embedSessionHasFullTracks(0), false)
  assert.equal(embedSessionHasFullTracks(-1), false)
  assert.equal(embedSessionHasFullTracks(Number.NaN), false)
  assert.equal(embedSessionHasFullTracks(undefined), false)
  assert.equal(embedSessionHasFullTracks(null), false)
})

test("touch screens show the login prompt immediately and desktops wait", () => {
  assert.equal(spotifyBrowserLoginPromptDelayMs(true), 0)
  assert.equal(spotifyBrowserLoginPromptDelayMs(false), DESKTOP_LOGIN_PROMPT_DELAY_MS)
  assert.ok(DESKTOP_LOGIN_PROMPT_DELAY_MS >= 500)
})

test("sign-in opens a browser window and falls back to this page", () => {
  const storage = memoryStorage()
  const opened: Array<{ url: string; target: string; features: string }> = []
  const assigned: string[] = []
  const popup = { closed: false, focus() {} }
  const openedWindow = openSpotifyBrowserLogin({
    open: (url, target, features) => {
      opened.push({ url, target, features })
      return popup
    },
    assign: (url) => assigned.push(url),
    storage,
    now: () => 1_000,
  })
  assert.equal(openedWindow, popup)
  assert.equal(opened.length, 1)
  assert.equal(opened[0].url, spotifyBrowserLoginHref())
  assert.equal(opened[0].target, "spotify-browser-login")
  assert.equal(opened[0].features, SPOTIFY_BROWSER_LOGIN_FEATURES)
  assert.equal(opened[0].features.includes("noopener"), false)
  assert.equal(opened[0].features.includes("noreferrer"), false)
  assert.equal(opened[0].url.includes("open.spotify.com"), false)
  assert.equal(opened[0].url.includes("spotify:"), false)
  assert.equal(opened[0].url.includes("intent:"), false)
  assert.equal(assigned.length, 0)
  assert.equal(spotifyBrowserLoginIsPending(storage, 1_000), true)
  assert.equal(spotifyBrowserLoginIsNewDocument(storage, 0), false)
  assert.equal(spotifyBrowserLoginIsNewDocument(storage, 50), true)

  const blocked = memoryStorage()
  const fallback: string[] = []
  const result = openSpotifyBrowserLogin({
    open: () => null,
    assign: (url) => fallback.push(url),
    storage: blocked,
    now: () => 5_000,
  })
  assert.equal(result, null)
  assert.deepEqual(fallback, [spotifyBrowserLoginHref()])
  assert.equal(spotifyBrowserLoginIsPending(blocked, 5_000), true)
  assert.equal(spotifyBrowserLoginIsPending(blocked, 5_000 + SPOTIFY_BROWSER_LOGIN_PENDING_MAX_MS + 1), false)
  assert.equal(blocked.getItem(SPOTIFY_BROWSER_LOGIN_PENDING_KEY), null)
})

test("the embed reloads when sign-in ends, not while the login window is still the only thing open", () => {
  assert.equal(
    shouldReloadEmbedForLogin({
      pending: true,
      popupClosed: false,
      becameVisible: false,
      restoredFromCache: false,
    }),
    false
  )
  assert.equal(
    shouldReloadEmbedForLogin({
      pending: false,
      popupClosed: true,
      becameVisible: false,
      restoredFromCache: false,
    }),
    true
  )
  assert.equal(
    shouldReloadEmbedForLogin({
      pending: true,
      popupClosed: false,
      becameVisible: true,
      restoredFromCache: false,
    }),
    true
  )
  assert.equal(
    shouldReloadEmbedForLogin({
      pending: true,
      popupClosed: false,
      becameVisible: false,
      restoredFromCache: true,
    }),
    true
  )
  assert.equal(
    shouldReloadEmbedForLogin({
      pending: false,
      popupClosed: false,
      becameVisible: true,
      restoredFromCache: true,
    }),
    false
  )
  const storage = memoryStorage()
  storage.setItem(SPOTIFY_BROWSER_LOGIN_PENDING_KEY, "10")
  clearSpotifyBrowserLoginPending(storage)
  assert.equal(storage.getItem(SPOTIFY_BROWSER_LOGIN_PENDING_KEY), null)
})

test("the login control sits on the player, not the home page", () => {
  const player = readFileSync(new URL("../components/spotify-embed-player.tsx", import.meta.url), "utf8")
  const home = readFileSync(new URL("../components/home-portal.tsx", import.meta.url), "utf8")
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8")
  assert.match(player, /data-spotify-browser-login/)
  assert.match(player, /href=\{spotifyBrowserLoginHref\(\)\}/)
  assert.match(player, /openSpotifyBrowserLogin/)
  assert.match(player, /preventDefault/)
  assert.match(player, /shouldReloadEmbedForLogin/)
  assert.match(player, /spotifyBrowserLoginIsNewDocument/)
  assert.match(player, /controller\.destroy\(\)/)
  assert.match(player, /SPOTIFY_BROWSER_LOGIN_LABEL/)
  assert.match(player, /embedSessionHasFullTracks/)
  assert.equal(player.includes("spotify:"), false)
  assert.equal(player.includes("intent://"), false)
  assert.equal(player.includes("open.spotify.com"), false)
  assert.equal(player.includes("/authorize"), false)
  assert.equal(player.includes('target="_blank"'), false)
  assert.equal(player.includes("{SPOTIFY_BROWSER_LOGIN_LABEL}"), true)
  const shellAt = player.indexOf("data-player-shell")
  const loginAt = player.indexOf("data-spotify-browser-login")
  const hostAt = player.indexOf("pointer-events-auto h-[152px]")
  assert.ok(shellAt >= 0 && loginAt > shellAt && hostAt > loginAt)
  assert.equal(home.includes(SPOTIFY_BROWSER_LOGIN_LABEL), false)
  assert.equal(home.includes("spotifyBrowserLoginHref"), false)
  assert.equal(header.includes(SPOTIFY_BROWSER_LOGIN_LABEL), false)
  assert.equal(header.includes("spotifyBrowserLoginHref"), false)
})
