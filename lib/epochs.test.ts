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

test("browse periods are six eras, with one Romantic and one Modern", () => {
  assert.deepEqual(
    EPOCHS.map((epoch) => epoch.slug),
    ["medieval", "renaissance", "baroque", "classical", "romantic", "modern"]
  )
  assert.equal(EPOCHS.some((epoch) => epoch.slug === "early-romantic"), false)
  assert.equal(EPOCHS.some((epoch) => epoch.slug === "late-romantic"), false)
  assert.equal(EPOCHS.some((epoch) => epoch.slug === "20th-century"), false)
  assert.equal(EPOCHS.some((epoch) => epoch.slug === "post-war"), false)
  assert.equal(EPOCHS.some((epoch) => epoch.slug === "21st-century"), false)
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

test("modern spans the twentieth century through living composers", () => {
  const modern = epochFromSlug("modern")
  assert.equal(modern?.name, "Modern")
  assert.equal(modern?.years, "c. 1900–")
  assert.match(modern?.blurb ?? "", /modernism/i)
  assert.match(modern?.blurb ?? "", /living composers/i)
  assert.deepEqual(
    modern?.sources?.map((source) => [source.slug, source.label, source.name]),
    [
      ["20th", "20th", "20th Century"],
      ["post-war", "Post-War", "Post-War"],
      ["21st", "21st", "21st Century"],
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

test("old modern urls and composer tags land on the matching chip", () => {
  assert.equal(relocatedEpochHref("20th-century"), "/periods/modern?filter=20th")
  assert.equal(relocatedEpochHref("post-war"), "/periods/modern?filter=post-war")
  assert.equal(relocatedEpochHref("21st-century"), "/periods/modern?filter=21st")
  assert.equal(relocatedEpochHref("modern"), null)
  assert.equal(legacyEpochName("20th-century"), "20th Century")
  assert.equal(legacyEpochName("post-war"), "Post-War")
  assert.equal(legacyEpochName("21st-century"), "21st Century")
  assert.equal(epochFromName("20th Century")?.slug, "modern")
  assert.equal(epochFromName("Post-War")?.slug, "modern")
  assert.equal(epochFromName("21st Century")?.slug, "modern")
  assert.equal(epochHref("20th Century"), "/periods/modern?filter=20th")
  assert.equal(epochHref("Post-War"), "/periods/modern?filter=post-war")
  assert.equal(epochHref("21st Century"), "/periods/modern?filter=21st")
  assert.equal(epochHref("Modern"), "/periods/modern")
})

test("Open Opus fetches still include the folded romantic and modern epochs", () => {
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
