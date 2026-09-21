import assert from "node:assert/strict"
import { test } from "node:test"
import { classifyWork } from "./forms.ts"
import { compareWorksByPopularity, dedupeWorks, isPopular } from "./openopus.ts"

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

test("popularity order is flagged first, then title", () => {
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
