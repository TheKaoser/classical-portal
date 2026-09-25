import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function source(path: string): string {
  return readFileSync(join(root, path), "utf8")
}

const SEO_PATHS = [
  "app/sitemap.ts",
  "app/robots.ts",
  "app/opengraph-image.tsx",
  "app/twitter-image.tsx",
  "lib/seo.ts",
  "app/works/[id]/page.tsx",
  "app/composers/[id]/page.tsx",
  "app/genres/[slug]/page.tsx",
]

test("metadata, sitemap, and page renders do not call the Spotify Web API", () => {
  for (const path of SEO_PATHS) {
    const text = source(path)
    assert.equal(text.includes("searchSpotifyForWork"), false, path)
    assert.equal(text.includes("api.spotify.com"), false, path)
  }
})

test("robots.txt disallows /api/ and does not set Crawl-delay", () => {
  const text = source("app/robots.ts")
  assert.match(text, /disallow:\s*\["\/api\/"\]/)
  assert.equal(text.toLowerCase().includes("crawl-delay"), false)
})

test("work recordings are loaded from the client API, not during render", () => {
  const page = source("app/works/[id]/page.tsx")
  assert.match(page, /WorkSpotifyRecordings/)
  assert.match(page, /catalogSpotifySearchUrl/)
  const route = source("app/api/spotify/recordings/route.ts")
  assert.match(route, /isCrawlerUserAgent/)
  assert.match(route, /SPOTIFY_RECORDINGS_UNAVAILABLE/)
})
