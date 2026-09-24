import assert from "node:assert/strict"
import { test } from "node:test"
import { imslpPageMatchesComposer, imslpTitleLabel, imslpWorkFields } from "./imslp-dates.ts"

const PAGE = `
{{ComposerWork
|Opus/Catalogue Number=BWV 140 ; BC A 166
|Year/Date of Composition=1731 in Leipzig
|Year of First Publication=1847
}}
`

test("reads the composition field and ignores publication", () => {
  assert.deepEqual(imslpWorkFields(PAGE), {
    composition: "1731 in Leipzig",
    catalogue: "BWV 140 ; BC A 166",
  })
  assert.deepEqual(imslpWorkFields("|Year/Date of Composition=\n|Year of First Publication=1741"), {
    composition: null,
    catalogue: null,
  })
  assert.equal(
    imslpTitleLabel("Wachet_auf,_ruft_uns_die_Stimme,_BWV_140_(Bach,_Johann_Sebastian)"),
    "Wachet auf, ruft uns die Stimme, BWV 140"
  )
  assert.equal(
    imslpTitleLabel(
      "Orchestral_Suite_No.3,_BWV_1068_(Bach,_Johann_Sebastian)#For_Violin,_Piano_and_Strings_(Wilhelmj)"
    ),
    "Orchestral Suite No.3, BWV 1068"
  )
})

test("an IMSLP page is used only when it credits that composer", () => {
  const page = "Toccata and Fugue in D minor, BWV 565 (Bach, Johann Sebastian)"
  assert.equal(imslpPageMatchesComposer(page, "Johann Sebastian Bach"), true)
  assert.equal(imslpPageMatchesComposer(page, "Carl Philipp Emanuel Bach"), false)
  assert.equal(
    imslpPageMatchesComposer("Keyboard Concerto in D major, Hob.XVIII:11 (Haydn, Joseph)", "Franz Joseph Haydn"),
    true
  )
  assert.equal(
    imslpPageMatchesComposer("Symphony in G major (Haydn, Michael)", "Franz Joseph Haydn"),
    false
  )
  assert.equal(imslpPageMatchesComposer("Waltz (Strauss, Johann II)", "Johann Strauss Jr"), true)
  assert.equal(imslpPageMatchesComposer("Waltz (Strauss, Johann I)", "Johann Strauss Jr"), false)
  assert.equal(imslpPageMatchesComposer("Cantata, BWV 147 (Bach, J. S.)", "Johann Sebastian Bach"), true)
  assert.equal(imslpPageMatchesComposer("Notes on Bach", "Johann Sebastian Bach"), false)
})
