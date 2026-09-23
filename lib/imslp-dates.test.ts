import assert from "node:assert/strict"
import { test } from "node:test"
import { imslpTitleLabel, imslpWorkFields } from "./imslp-dates.ts"

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
})
