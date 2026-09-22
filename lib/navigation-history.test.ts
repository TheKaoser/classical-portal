import assert from "node:assert/strict"
import test from "node:test"
import {
  APP_NAV_SESSION_KEY,
  isSameOriginReferrer,
  readAppHistoryMarker,
  readHistoryIndex,
  shouldUseHistoryBack,
  writeAppHistoryMarker,
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
