import assert from "node:assert/strict"
import test from "node:test"
import {
  APP_NAV_SESSION_KEY,
  isSameOriginReferrer,
  previousScreen,
  readAppHistoryMarker,
  readHistoryIndex,
  readScreenStack,
  recordScreen,
  screenLabel,
  shouldUseHistoryBack,
  writeAppHistoryMarker,
  writeScreenStack,
  type ScreenRecord,
} from "./navigation-history.ts"

test("readHistoryIndex reads Next-style history.state.idx", () => {
  assert.equal(readHistoryIndex(null), null)
  assert.equal(readHistoryIndex(undefined), null)
  assert.equal(readHistoryIndex({}), null)
  assert.equal(readHistoryIndex({ idx: "1" }), null)
  assert.equal(readHistoryIndex({ idx: 0 }), 0)
  assert.equal(readHistoryIndex({ idx: 3 }), 3)
})

test("same-origin referrer detection", () => {
  assert.equal(isSameOriginReferrer("https://example.com/genres/concertos", "https://example.com"), true)
  assert.equal(isSameOriginReferrer("https://example.com/genres/concertos?filter=piano", "https://example.com"), true)
  assert.equal(isSameOriginReferrer("https://google.com/", "https://example.com"), false)
  assert.equal(isSameOriginReferrer("", "https://example.com"), false)
  assert.equal(isSameOriginReferrer("not-a-url", "https://example.com"), false)
})

test("history idx > 0 prefers browser back", () => {
  assert.equal(
    shouldUseHistoryBack({
      hasAppHistoryMarker: false,
      historyLength: 1,
      historyIndex: 2,
      referrer: "",
      currentOrigin: "https://example.com",
    }),
    true
  )
  assert.equal(
    shouldUseHistoryBack({
      hasAppHistoryMarker: true,
      historyLength: 5,
      historyIndex: 0,
      referrer: "https://example.com/",
      currentOrigin: "https://example.com",
    }),
    false
  )
})

test("session marker enables back after in-app navigations", () => {
  assert.equal(
    shouldUseHistoryBack({
      hasAppHistoryMarker: true,
      historyLength: 2,
      historyIndex: null,
      referrer: "",
      currentOrigin: "https://example.com",
    }),
    true
  )
  assert.equal(
    shouldUseHistoryBack({
      hasAppHistoryMarker: true,
      historyLength: 1,
      historyIndex: null,
      referrer: "",
      currentOrigin: "https://example.com",
    }),
    false
  )
  assert.equal(
    shouldUseHistoryBack({
      hasAppHistoryMarker: false,
      historyLength: 4,
      historyIndex: null,
      referrer: "",
      currentOrigin: "https://example.com",
    }),
    false
  )
})

test("same-origin referrer enables back without a session marker", () => {
  assert.equal(
    shouldUseHistoryBack({
      hasAppHistoryMarker: false,
      historyLength: 2,
      historyIndex: null,
      referrer: "https://example.com/genres/concertos",
      currentOrigin: "https://example.com",
    }),
    true
  )
  assert.equal(
    shouldUseHistoryBack({
      hasAppHistoryMarker: false,
      historyLength: 2,
      historyIndex: null,
      referrer: "https://google.com/search?q=mozart",
      currentOrigin: "https://example.com",
    }),
    false
  )
})

test("deep link with no history falls back", () => {
  assert.equal(
    shouldUseHistoryBack({
      hasAppHistoryMarker: false,
      historyLength: 1,
      historyIndex: null,
      referrer: "",
      currentOrigin: "https://example.com",
    }),
    false
  )
})

test("screen labels prefer the page heading, and home stays Home", () => {
  assert.equal(screenLabel("/", "Classical Portal assical Portal"), "Home")
  assert.equal(screenLabel("/genres/piano", " Piano "), "Piano")
  assert.equal(screenLabel("/genres/chamber", "Chamber"), "Chamber")
  assert.equal(screenLabel("/periods/romantic", "Romantic"), "Romantic")
  assert.equal(screenLabel("/works/1", ""), "Back")
})

test("screen stack follows pages and lets a chip replace the current URL", () => {
  const home: ScreenRecord = { path: "/", href: "/", label: "Home" }
  const genres: ScreenRecord = { path: "/genres", href: "/genres", label: "Genres" }
  const piano: ScreenRecord = { path: "/genres/piano", href: "/genres/piano", label: "Piano" }
  const filtered: ScreenRecord = {
    path: "/genres/piano",
    href: "/genres/piano?filter=nocturne",
    label: "Piano",
  }
  const work: ScreenRecord = { path: "/works/1", href: "/works/1", label: "Nocturne" }

  let stack = recordScreen([], home)
  stack = recordScreen(stack, genres)
  stack = recordScreen(stack, piano)
  stack = recordScreen(stack, filtered)
  assert.deepEqual(stack.map((entry) => entry.href), ["/", "/genres", "/genres/piano?filter=nocturne"])
  assert.equal(previousScreen(stack, "/genres/piano")?.label, "Genres")

  stack = recordScreen(stack, work)
  assert.equal(previousScreen(stack, "/works/1")?.label, "Piano")
  assert.equal(previousScreen(stack, "/works/1")?.href, "/genres/piano?filter=nocturne")
  assert.equal(previousScreen(stack, "/works/2")?.label, "Nocturne")

  stack = recordScreen(stack, filtered)
  assert.deepEqual(stack.map((entry) => entry.path), ["/", "/genres", "/genres/piano"])
  assert.equal(previousScreen(stack, "/genres/piano")?.label, "Genres")
  assert.equal(previousScreen([], "/works/1"), null)
  assert.equal(previousScreen([home], "/") , null)
})

test("screen stack survives a storage round trip", () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
  writeScreenStack(storage, [{ path: "/genres/chamber", href: "/genres/chamber?filter=trio", label: "Chamber" }])
  assert.deepEqual(readScreenStack(storage), [
    { path: "/genres/chamber", href: "/genres/chamber?filter=trio", label: "Chamber" },
  ])
  store.set("cp_screen_stack", "not-json")
  assert.deepEqual(readScreenStack(storage), [])
  assert.deepEqual(readScreenStack(null), [])
})

test("session marker read/write", () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
  assert.equal(readAppHistoryMarker(storage), false)
  writeAppHistoryMarker(storage)
  assert.equal(store.get(APP_NAV_SESSION_KEY), "1")
  assert.equal(readAppHistoryMarker(storage), true)
  assert.equal(readAppHistoryMarker(null), false)
})
