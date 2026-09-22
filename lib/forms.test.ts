import assert from "node:assert/strict"
import { test } from "node:test"
import { classifyWork } from "./forms.ts"
import {
  compareSpotifyThenFallback,
  compareWorksByPopularity,
  dedupeWorks,
  isPopular,
  sortComposersByImportance,
  sortComposersBySpotify,
} from "./popularity.ts"

test("classifies common forms from the title", () => {
  assert.equal(classifyWork("Symphony no. 5 in C minor, op. 67"), "symphony")
  assert.equal(classifyWork("Piano Sonata no. 14 in C sharp minor, op. 27 no. 2"), "sonata")
  assert.equal(classifyWork("String Quartet no. 14 in C sharp minor, op. 131"), "quartet")
  assert.equal(classifyWork("Piano Concerto no. 5 in E flat major, op. 73"), "concerto")
  assert.equal(classifyWork("Nocturne in E flat major, op. 9 no. 2"), "nocturne")
  assert.equal(classifyWork("Missa solemnis in D major, op. 123"), "mass")
  assert.equal(classifyWork("Étude in C minor, op. 10 no. 12"), "etude")
})

test("subtitle supplies the form when the title does not", () => {
  assert.equal(classifyWork("Carmen", "Opera"), "opera")
  assert.equal(classifyWork("The Rite of Spring", "Ballet"), "ballet")
  assert.equal(classifyWork("Das Lied von der Erde", "Symphony for alto, tenor and orchestra"), "symphony")
})

test("blank stage works are operas unless the title says otherwise", () => {
  assert.equal(classifyWork("Carmen", "", "Stage"), "opera")
  assert.equal(classifyWork("Il barbiere di Siviglia", "", "Stage"), "opera")
  assert.equal(classifyWork("The Sea Hawk", "Film score", "Stage"), null)
  assert.equal(classifyWork("L'Arlésienne, incidental music", "", "Stage"), null)
  assert.equal(classifyWork("Carmen, suite for orchestra from the opera"), "suite")
  assert.equal(classifyWork("Sinfonia concertante in E flat major, K.364"), "concerto")
  assert.equal(
    classifyWork("Cantus Arcticus, for orchestra and taped bird songs, op. 61"),
    null
  )
})

test("a form named in the title wins over a conflicting subtitle", () => {
  assert.equal(
    classifyWork("Cantata no. 201: Der Streit zwischen Phoebus und Pan, BWV.201", "Opera"),
    "cantata"
  )
  assert.equal(classifyWork('Symphony no. 3, op. 36, "Symphony of Sorrowful Songs"'), "symphony")
  assert.equal(classifyWork("Trio Sonata in C major"), "sonata")
})

test("either Open Opus flag counts as popular, and duplicates collapse to one work", () => {
  assert.equal(isPopular({ popular: "1", recommended: "0" }), true)
  assert.equal(isPopular({ popular: "0", recommended: "1" }), true)
  assert.equal(isPopular({ popular: "1", recommended: "1" }), true)
  assert.equal(isPopular({ popular: "0", recommended: "0" }), false)

  const works = [
    { id: "1", title: "A", popular: "1", recommended: "1" },
    { id: "1", title: "A duplicate", popular: "0", recommended: "1" },
    { id: "2", title: "B", popular: "0", recommended: "0" },
  ]
  const unique = dedupeWorks(works)
  assert.equal(unique.length, 2)
  assert.equal(unique[0].id, "1")
  assert.equal(isPopular(unique[0]), true)
})

test("period composers rank pop, then essential, then the rest by complete name", () => {
  const composers = [
    { id: "98", name: "Vivaldi", complete_name: "Antonio Vivaldi" },
    { id: "97", name: "Scarlatti", complete_name: "Domenico Scarlatti" },
    { id: "128", name: "Couperin", complete_name: "François Couperin" },
    { id: "67", name: "Handel", complete_name: "George Frideric Handel" },
    { id: "87", name: "Bach", complete_name: "Johann Sebastian Bach" },
    { id: "139", name: "Corelli", complete_name: "Arcangelo Corelli" },
    { id: "65", name: "Scarlatti, A.", complete_name: "Alessandro Scarlatti" },
  ]
  const popularIds = new Set(["87", "67", "98"])
  const essentialIds = new Set(["87", "97", "128"])

  const names = sortComposersByImportance(composers, popularIds, essentialIds).map(
    (composer) => composer.complete_name
  )

  assert.deepEqual(names, [
    "Antonio Vivaldi",
    "George Frideric Handel",
    "Johann Sebastian Bach",
    "Domenico Scarlatti",
    "François Couperin",
    "Alessandro Scarlatti",
    "Arcangelo Corelli",
  ])
  assert.deepEqual(
    composers.map((composer) => composer.id),
    ["98", "97", "128", "67", "87", "139", "65"]
  )
})

test("works with no Spotify score stay flagged first, then title", () => {
  const works = [
    { title: "B", popular: "0", recommended: "0" },
    { title: "C", popular: "1", recommended: "0" },
    { title: "A", popular: "1", recommended: "1" },
    { title: "D", popular: "0", recommended: "1" },
    { title: "E", popular: "0", recommended: "0" },
  ]
  const titles = [...works].sort(compareWorksByPopularity).map((work) => work.title)
  assert.deepEqual(titles, ["A", "C", "D", "B", "E"])
})

test("spotify score outranks the Open Opus flag, then name; unmatched rows follow", () => {
  const works = [
    { id: "low", title: "Zebra", popular: "1", score: 10 },
    { id: "high", title: "Alpha", popular: "0", score: 90 },
    { id: "tie", title: "Bravo", popular: "0", score: 90 },
    { id: "none-flagged", title: "Delta", popular: "0" },
    { id: "none-popular", title: "Charlie", popular: "1" },
  ]
  const titles = [...works]
    .sort((a, b) =>
      compareWorksByPopularity(a, b, (work) => (work.score == null ? null : work.score))
    )
    .map((work) => work.title)
  assert.deepEqual(titles, ["Alpha", "Bravo", "Zebra", "Charlie", "Delta"])
})

test("composer lists use Spotify score before Open Opus tier, then complete name", () => {
  const composers = [
    { id: "98", name: "Vivaldi", complete_name: "Antonio Vivaldi", score: 40 },
    { id: "67", name: "Handel", complete_name: "George Frideric Handel", score: 70 },
    { id: "87", name: "Bach", complete_name: "Johann Sebastian Bach", score: 70 },
    { id: "139", name: "Corelli", complete_name: "Arcangelo Corelli" },
    { id: "128", name: "Couperin", complete_name: "François Couperin" },
  ]
  const popularIds = new Set(["87"])
  const essentialIds = new Set(["128"])
  const names = sortComposersBySpotify(
    composers,
    (composer) => composer.score ?? null,
    popularIds,
    essentialIds
  ).map((composer) => composer.complete_name)

  assert.deepEqual(names, [
    "George Frideric Handel",
    "Johann Sebastian Bach",
    "Antonio Vivaldi",
    "François Couperin",
    "Arcangelo Corelli",
  ])
  assert.ok(compareSpotifyThenFallback(10, 10, "B", "A") > 0)
  assert.ok(compareSpotifyThenFallback(90, 10, "Z", "A") < 0)
  assert.equal(compareSpotifyThenFallback(null, 5, "A", "B"), 1)
  assert.equal(compareSpotifyThenFallback(null, null, "B", "A", 0, 1), -1)
})
