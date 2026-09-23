import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { cleanSpotifySearchTitle, spotifyTitleQueryVariants } from "./spotify-title.ts"

const catalog = JSON.parse(
  readFileSync(new URL("../data/form-works.json", import.meta.url), "utf8")
) as { works: { title: string; composerName: string }[] }

test("Stabat Mater drops the scoring list and keeps the name", () => {
  const title = "Stabat mater, for soloists, chorus, and orchestra"
  assert.equal(cleanSpotifySearchTitle(title), "Stabat mater")
  assert.deepEqual(spotifyTitleQueryVariants(title), ["Stabat mater"])
})

test("scoring suffixes are removed while catalogue, key, and number stay", () => {
  assert.equal(
    cleanSpotifySearchTitle("Messa di Gloria, for soloists, chorus, and orchestra"),
    "Messa di Gloria"
  )
  assert.equal(
    cleanSpotifySearchTitle("Cantus Arcticus, for orchestra and taped bird songs, op. 61"),
    "Cantus Arcticus, op. 61"
  )
  assert.ok(
    spotifyTitleQueryVariants("Cantus Arcticus, for orchestra and taped bird songs, op. 61").includes(
      "Cantus Arcticus"
    )
  )
  assert.equal(
    cleanSpotifySearchTitle("Partita no. 2 for Solo Violin in D minor, BWV.1004"),
    "Partita no. 2 in D minor, BWV.1004"
  )
  assert.equal(
    cleanSpotifySearchTitle(
      "Concerto a cinque, for Solo Violin, 2 Violins, 2 Violas, Cello, and Continuo no. 1 in B flat major, op. 5, no. 1"
    ),
    "Concerto a cinque, no. 1 in B flat major, op. 5, no. 1"
  )
  assert.equal(
    cleanSpotifySearchTitle(
      "Sinfonia in D major, for Violin, 3 Trumpets, Timpani, 2 Tboes, Strings and Continuo, BWV.1045"
    ),
    "Sinfonia in D major, BWV.1045"
  )
  assert.equal(
    cleanSpotifySearchTitle("Fantasia, for keyboard in G major, MB 62"),
    "Fantasia, in G major, MB 62"
  )
  assert.equal(
    cleanSpotifySearchTitle("March for the Sultan Abdul Madjid, for band"),
    "March for the Sultan Abdul Madjid"
  )
  assert.equal(
    cleanSpotifySearchTitle(
      "Cantata for the Coronation of Nicholas II, for chorus and orchestra"
    ),
    "Cantata for the Coronation of Nicholas II"
  )
  assert.equal(
    cleanSpotifySearchTitle("Giunone, cantata for the birthday of Ferdinando IV, for soprano, chorus and orchestra"),
    "Giunone, cantata for the birthday of Ferdinando IV"
  )
  assert.equal(
    cleanSpotifySearchTitle("Concerto in E flat major, for piano left hand"),
    "Concerto in E flat major, left hand"
  )
  assert.equal(cleanSpotifySearchTitle("6 Lieder with Orchestra, EG 177"), "6 Lieder, EG 177")
  assert.equal(
    cleanSpotifySearchTitle("Symphony no. 5 in C minor, op. 67"),
    "Symphony no. 5 in C minor, op. 67"
  )
})

test("a for-phrase that is the title itself is kept", () => {
  for (const title of [
    "Concerto for Orchestra",
    "Concerto for Orchestra, BB123, Sz.116",
    "Piano Concerto for the Left Hand",
    "Music for the Royal Fireworks",
    "Mass for the Parishes",
    "Waiting for the Barbarians",
    "Three Piano Sonatas for the Young, op. 118",
    "Young Person's Guide to the Orchestra, op. 34",
    "Music for the Theatre, suite for small orchestra",
  ]) {
    assert.equal(cleanSpotifySearchTitle(title), title, title)
  }
})

test("Open Opus titles keep their opening name, catalogue number, and real for-titles", () => {
  const catalogue = /\b(?:op(?:us)?|bwv|buxwv|swwv|hwv|twv|woo|hob|sz|qr|trv|lwv|mb|sv|bb|eg|js)\.?\s*\d+/i
  for (const work of catalog.works) {
    const cleaned = cleanSpotifySearchTitle(work.title)
    assert.equal(cleanSpotifySearchTitle(cleaned), cleaned, work.title)

    const opening = work.title
      .split(/[,;]/)[0]
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .split(/[^a-z0-9]+/)
      .find((word) => word.length > 2 && !["the", "for", "with", "and"].includes(word))
    if (opening) {
      const folded = cleaned
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
      assert.ok(folded.includes(opening), `${work.title} => ${cleaned}`)
    }

    const hit = work.title.match(catalogue)
    if (hit) {
      const digits = hit[0].replace(/\D/g, "")
      assert.ok(cleaned.toLowerCase().includes(digits), `${work.title} => ${cleaned}`)
    }

    if (/concerto for orchestra/i.test(work.title)) {
      assert.match(cleaned, /concerto for orchestra/i, work.title)
    }
    if (/left hand/i.test(work.title)) {
      assert.match(cleaned, /left hand/i, work.title)
    }
    if (/royal fireworks/i.test(work.title)) {
      assert.equal(cleaned, work.title)
    }
  }
})
