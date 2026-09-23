import assert from "node:assert/strict"
import { test } from "node:test"
import cache from "../data/spotify-popularity.json" with { type: "json" }
import {
  DISCOVERY_MIN_SCORE,
  discoveryWorkHref,
  discoveryWorkId,
  discoveryWorkIds,
  utcDayKey,
} from "./discovery.ts"

const cachedWorks = (cache as { works?: Record<string, number> }).works ?? {}

test("utc day key stays on the calendar date in UTC", () => {
  assert.equal(utcDayKey(new Date("2026-09-23T00:00:00.000Z")), "2026-09-23")
  assert.equal(utcDayKey(new Date("2026-09-23T23:59:59.999Z")), "2026-09-23")
  assert.equal(utcDayKey(new Date("2026-09-24T00:00:00.000Z")), "2026-09-24")
})

test("discovery ignores scores below the Spotify floor", () => {
  assert.deepEqual(
    discoveryWorkIds({
      "10": 0,
      "2": 12,
      "4": Number.NaN,
      "9": -1,
      "5": 1,
      "7": Number.POSITIVE_INFINITY,
    }),
    ["2", "5"]
  )
})

test("the same UTC day always picks the same work", () => {
  const ids = ["2", "9", "27", "40", "55"]
  const morning = discoveryWorkId(new Date("2026-09-23T01:15:00.000Z"), ids)
  const evening = discoveryWorkId(new Date("2026-09-23T22:40:00.000Z"), ids)
  assert.equal(morning, evening)
  assert.equal(discoveryWorkHref(new Date("2026-09-23T22:40:00.000Z"), ids), `/works/${morning}`)
  assert.ok(morning && ids.includes(morning))
})

test("a new UTC day can choose a different work", () => {
  const ids = Array.from({ length: 64 }, (_, index) => String(index + 1))
  const first = discoveryWorkId(new Date("2026-01-01T12:00:00.000Z"), ids)
  const second = discoveryWorkId(new Date("2026-01-02T12:00:00.000Z"), ids)
  assert.notEqual(first, second)
})

test("an empty pool has no destination", () => {
  assert.equal(discoveryWorkId(new Date("2026-09-23T12:00:00.000Z"), []), null)
  assert.equal(discoveryWorkHref(new Date("2026-09-23T12:00:00.000Z"), []), null)
})

test("the catalog pool is Spotify-matched works at or above the floor", () => {
  const ids = discoveryWorkIds()
  assert.ok(ids.length > 1000)
  assert.equal(DISCOVERY_MIN_SCORE, 1)
  for (const id of ids) {
    const score = cachedWorks[id]
    assert.equal(typeof score, "number")
    assert.ok(score >= DISCOVERY_MIN_SCORE)
  }
  const sorted = [...ids].sort((a, b) => Number(a) - Number(b))
  assert.deepEqual(ids, sorted)
  const today = discoveryWorkId(new Date("2026-09-23T12:00:00.000Z"))
  assert.ok(today && ids.includes(today))
})
