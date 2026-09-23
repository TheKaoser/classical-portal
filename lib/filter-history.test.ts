import assert from "node:assert/strict"
import { test } from "node:test"
import { applyFilterHistory, filterPath } from "./filter-history.ts"

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

  assert.deepEqual(calls, [
    { method: "replace", data: {}, url: "/genres/chamber?filter=quartet" },
    { method: "replace", data: {}, url: "/periods/romantic" },
  ])
})
