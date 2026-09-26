import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { mergeIframeAllow, SPOTIFY_EMBED_ALLOW_ORIGIN } from "./iframe-allow.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const origin = SPOTIFY_EMBED_ALLOW_ORIGIN

const spotifyAllow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"

const withOrigin = [
  `autoplay ${origin}`,
  `clipboard-write ${origin}`,
  `encrypted-media ${origin}`,
  `fullscreen ${origin}`,
  `picture-in-picture ${origin}`,
].join("; ")

test("a bare Spotify allow list grants playback features to the embed origin", () => {
  assert.equal(mergeIframeAllow(spotifyAllow), withOrigin)
})

test("a missing allow list still grants encrypted-media and autoplay", () => {
  assert.equal(mergeIframeAllow(null), withOrigin)
  assert.equal(mergeIframeAllow(undefined), withOrigin)
  assert.equal(mergeIframeAllow(""), withOrigin)
  assert.equal(mergeIframeAllow("   ;  "), withOrigin)
})

test("an explicit origin or star is not duplicated", () => {
  const starred = "encrypted-media *; autoplay *"
  const merged = mergeIframeAllow(starred)
  assert.match(merged, /encrypted-media \*/)
  assert.equal(merged.includes(`encrypted-media ${origin}`), false)
  assert.match(merged, /autoplay \*/)
  assert.equal(merged.split("autoplay").length - 1, 1)

  const already = mergeIframeAllow(`encrypted-media ${origin}; autoplay ${origin}`)
  assert.equal(already.split(origin).length - 1, 5)
})

test("existing tokens and unrelated features are preserved", () => {
  const merged = mergeIframeAllow(
    "camera 'self'; encrypted-media 'src'; clipboard-write https://example.com; autoplay 'self'"
  )
  assert.match(merged, /^camera 'self'; /)
  assert.match(merged, /encrypted-media 'src' https:\/\/open\.spotify\.com/)
  assert.match(merged, /clipboard-write https:\/\/example\.com https:\/\/open\.spotify\.com/)
  assert.match(merged, /autoplay 'self' https:\/\/open\.spotify\.com/)
  assert.match(merged, /fullscreen https:\/\/open\.spotify\.com/)
  assert.match(merged, /picture-in-picture https:\/\/open\.spotify\.com/)
})

test("merging twice is stable", () => {
  const once = mergeIframeAllow(spotifyAllow)
  assert.equal(mergeIframeAllow(once), once)
})

test("feature names are matched case-insensitively", () => {
  const merged = mergeIframeAllow("Encrypted-Media; AUTOPLAY https://open.spotify.com")
  assert.match(merged, /encrypted-media https:\/\/open\.spotify\.com/)
  assert.match(merged, /autoplay https:\/\/open\.spotify\.com/)
  assert.equal(merged.split(origin).length - 1, 5)
})

test("the player merges allow before navigation instead of skipping Spotify's value", () => {
  const player = readFileSync(join(root, "components/spotify-embed-player.tsx"), "utf8")
  const history = readFileSync(join(root, "lib/iframe-history.ts"), "utf8")
  assert.equal(player.includes('if (!iframe.getAttribute("allow"))'), false)
  assert.match(player, /instrumentEmbedIframeCreation/)
  assert.match(player, /MutationObserver/)
  assert.match(history, /applyMergedIframeAllow/)
})
