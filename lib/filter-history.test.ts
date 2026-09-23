import assert from "node:assert/strict"
import { test } from "node:test"
import { applyFilterHistory, filterPath, readFilterSlug } from "./filter-history.ts"

test("filter paths set or clear the chip query", () => {
  assert.equal(
    filterPath("https://example.com/periods/romantic?filter=early", "late"),
    "/periods/romantic?filter=late"
  )
  assert.equal(filterPath("https://example.com/genres/chamber?filter=trio", "all"), "/genres/chamber")
  assert.equal(
    filterPath("https://example.com/genres/piano", "nocturne"),
    "/genres/piano?filter=nocturne"
  )
  assert.equal(
    filterPath("https://example.com/genres/stage?sort=popular", "opera"),
    "/genres/stage?sort=popular&filter=opera"
  )
})

test("composer chips clear the default slug and set the others", () => {
  assert.equal(
    filterPath("https://example.com/composers/87?filter=Chamber", "popular", "popular"),
    "/composers/87"
  )
  assert.equal(
    filterPath("https://example.com/composers/87", "all", "popular"),
    "/composers/87?filter=all"
  )
  assert.equal(
    filterPath("https://example.com/composers/87?filter=all", "Keyboard", "popular"),
    "/composers/87?filter=Keyboard"
  )
})

test("readFilterSlug honors the empty slug, allow-list, and aliases", () => {
  const allowed = new Set(["all", "popular", "Chamber"])
  assert.equal(readFilterSlug("", allowed, "popular"), "popular")
  assert.equal(readFilterSlug("?filter=Chamber", allowed, "popular"), "Chamber")
  assert.equal(readFilterSlug("?filter=all", allowed, "popular"), "all")
  assert.equal(readFilterSlug("?filter=nope", allowed, "popular"), "popular")
  assert.equal(
    readFilterSlug("?filter=recommended", allowed, "popular", { recommended: "popular" }),
    "popular"
  )
  assert.equal(
    readFilterSlug("?filter=recommended", new Set(["all"]), "all", { recommended: "popular" }),
    "all"
  )
  assert.equal(readFilterSlug("?filter=trio", new Set(["all", "trio"])), "trio")
  assert.equal(readFilterSlug("", new Set(["all", "trio"])), "all")
})

test("chip changes replace the current history entry", () => {
  const calls: { method: string; data: unknown; url?: string | null }[] = []
  const history = {
    pushState() {
      calls.push({ method: "push", data: null })
    },
    replaceState(data: unknown, _unused: string, url?: string | null) {
      calls.push({ method: "replace", data, url })
    },
  }

  applyFilterHistory(history, "https://example.com/genres/chamber?filter=trio", "quartet")
  applyFilterHistory(history, "https://example.com/periods/romantic?filter=early", "all")
  applyFilterHistory(history, "https://example.com/composers/87?filter=Chamber", "popular", "popular")
  applyFilterHistory(history, "https://example.com/composers/87", "Orchestral", "popular")

  assert.deepEqual(calls, [
    { method: "replace", data: {}, url: "/genres/chamber?filter=quartet" },
    { method: "replace", data: {}, url: "/periods/romantic" },
    { method: "replace", data: {}, url: "/composers/87" },
    { method: "replace", data: {}, url: "/composers/87?filter=Orchestral" },
  ])
})
