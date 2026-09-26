import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { navigateIframeWithoutHistory, type IframeHistoryTarget } from "./iframe-history.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

test("an in-document iframe loads the next URL with location.replace", () => {
  const replaced: string[] = []
  const assigned: string[] = []
  const iframe: IframeHistoryTarget = {
    contentWindow: {
      location: {
        replace(url: string) {
          replaced.push(url)
        },
      },
    },
  }

  navigateIframeWithoutHistory(iframe, "https://open.spotify.com/embed/track/aaa", (url) => assigned.push(url))
  navigateIframeWithoutHistory(iframe, "https://open.spotify.com/embed/track/bbb", (url) => assigned.push(url))
  navigateIframeWithoutHistory(iframe, "https://open.spotify.com/embed/track/ccc", (url) => assigned.push(url))

  assert.deepEqual(replaced, [
    "https://open.spotify.com/embed/track/aaa",
    "https://open.spotify.com/embed/track/bbb",
    "https://open.spotify.com/embed/track/ccc",
  ])
  assert.deepEqual(assigned, [])
})

test("a frame with no window still receives src", () => {
  const assigned: string[] = []
  navigateIframeWithoutHistory({ contentWindow: null }, "https://open.spotify.com/embed/track/aaa", (url) =>
    assigned.push(url)
  )
  assert.deepEqual(assigned, ["https://open.spotify.com/embed/track/aaa"])
})

test("a refused location.replace falls back to src", () => {
  const assigned: string[] = []
  const iframe: IframeHistoryTarget = {
    contentWindow: {
      location: {
        replace() {
          throw new Error("detached")
        },
      },
    },
  }
  navigateIframeWithoutHistory(iframe, "https://open.spotify.com/embed/track/aaa", (url) => assigned.push(url))
  assert.deepEqual(assigned, ["https://open.spotify.com/embed/track/aaa"])
})

test("an empty URL does not navigate", () => {
  let calls = 0
  const iframe: IframeHistoryTarget = {
    contentWindow: {
      location: {
        replace() {
          calls += 1
        },
      },
    },
  }
  navigateIframeWithoutHistory(iframe, "", () => {
    calls += 1
  })
  assert.equal(calls, 0)
})

test("the embed player guards src and does not seed the controller with a URI", () => {
  const text = readFileSync(join(root, "components/spotify-embed-player.tsx"), "utf8")
  assert.match(text, /installIframeHistoryGuard/)
  assert.equal(text.includes("uri: initialUri"), false)
  assert.equal(text.includes("router.push"), false)
  assert.equal(text.includes("history.pushState"), false)
})
