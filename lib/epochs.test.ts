import assert from "node:assert/strict"
import { test } from "node:test"
import {
  EPOCHS,
  epochFromName,
  epochFromSlug,
  epochHref,
  legacyEpochName,
  openOpusEpochNames,
  relocatedEpochHref,
} from "./epochs.ts"

test("browse periods are the eight eras, with one Romantic", () => {
  assert.deepEqual(
    EPOCHS.map((epoch) => epoch.slug),
    [
      "medieval",
      "renaissance",
      "baroque",
      "classical",
      "romantic",
      "20th-century",
      "post-war",
      "21st-century",
    ]
  )
  assert.equal(EPOCHS.some((epoch) => epoch.slug === "early-romantic"), false)
  assert.equal(EPOCHS.some((epoch) => epoch.slug === "late-romantic"), false)
})

test("romantic spans the early and late Open Opus eras", () => {
  const romantic = epochFromSlug("romantic")
  assert.equal(romantic?.years, "c. 1800–1920")
  assert.match(romantic?.blurb ?? "", /orchestra/i)
  assert.deepEqual(
    romantic?.sources?.map((source) => [source.slug, source.label, source.name]),
    [
      ["early", "Early", "Early Romantic"],
      ["romantic", "Romantic", "Romantic"],
      ["late", "Late", "Late Romantic"],
    ]
  )
})

test("old romantic urls and composer tags land on the matching chip", () => {
  assert.equal(relocatedEpochHref("early-romantic"), "/periods/romantic?filter=early")
  assert.equal(relocatedEpochHref("late-romantic"), "/periods/romantic?filter=late")
  assert.equal(relocatedEpochHref("romantic"), null)
  assert.equal(relocatedEpochHref("baroque"), null)
  assert.equal(legacyEpochName("early-romantic"), "Early Romantic")
  assert.equal(legacyEpochName("late-romantic"), "Late Romantic")
  assert.equal(epochFromName("Early Romantic")?.slug, "romantic")
  assert.equal(epochFromName("Late Romantic")?.slug, "romantic")
  assert.equal(epochFromName("Romantic")?.slug, "romantic")
  assert.equal(epochHref("Early Romantic"), "/periods/romantic?filter=early")
  assert.equal(epochHref("Late Romantic"), "/periods/romantic?filter=late")
  assert.equal(epochHref("Romantic"), "/periods/romantic?filter=romantic")
  assert.equal(epochHref("Baroque"), "/periods/baroque")
  assert.equal(epochHref("Unknown Era"), "/periods/unknown%20era")
})

test("Open Opus fetches still include the folded romantic epochs", () => {
  assert.deepEqual(openOpusEpochNames(), [
    "Medieval",
    "Renaissance",
    "Baroque",
    "Classical",
    "Early Romantic",
    "Romantic",
    "Late Romantic",
    "20th Century",
    "Post-War",
    "21st Century",
  ])
})
