import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  DESKTOP_LOGIN_PROMPT_DELAY_MS,
  EMBED_FULL_TRACK_MIN_MS,
  SPOTIFY_BROWSER_LOGIN_LABEL,
  embedSessionHasFullTracks,
  spotifyBrowserLoginHref,
  spotifyBrowserLoginPromptDelayMs,
} from "./spotify-browser-login.ts"

test("browser login is a same-tab https link on accounts.spotify.com", () => {
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

test("the login control sits on the player, not the home page", () => {
  const player = readFileSync(new URL("../components/spotify-embed-player.tsx", import.meta.url), "utf8")
  const home = readFileSync(new URL("../components/home-portal.tsx", import.meta.url), "utf8")
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8")
  assert.match(player, /data-spotify-browser-login/)
  assert.match(player, /href=\{spotifyBrowserLoginHref\(\)\}/)
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
