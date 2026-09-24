import assert from "node:assert/strict"
import { test } from "node:test"
import {
  clampDescription,
  composerDescription,
  composerJsonLd,
  exactCompositionYear,
  genreDescription,
  pageMetadata,
  periodDescription,
  schemaDate,
  searchDescription,
  websiteJsonLd,
  workDescription,
  workJsonLd,
  workPageTitle,
} from "./seo.ts"

test("composer description uses only the name, years, and epoch", () => {
  const text = composerDescription({
    completeName: "Ludwig van Beethoven",
    years: "1770–1827",
    epoch: "Classical",
  })
  assert.equal(
    text,
    "Ludwig van Beethoven (1770–1827), Classical. Browse works and play recordings on Classical Portal."
  )
  assert.equal(text.includes("Bonn"), false)
})

test("composer description omits a lifespan the catalog does not have", () => {
  const text = composerDescription({ completeName: "Guillaume Dufay", epoch: "Renaissance" })
  assert.equal(text.startsWith("Guillaume Dufay, Renaissance."), true)
  assert.equal(text.includes("("), false)
})

test("work title puts the composer before the catalog title", () => {
  assert.equal(
    workPageTitle("Beethoven", 'Symphony no. 9 in D minor, op. 125, "Choral"'),
    'Beethoven – Symphony no. 9 in D minor, op. 125, "Choral"'
  )
})

test("work description keeps subtitle, genre, and a real composition label", () => {
  const text = workDescription({
    composerName: "Ludwig van Beethoven",
    title: 'Symphony no. 9 in D minor, op. 125, "Choral"',
    subtitle: "",
    genre: "Orchestral",
    compositionLabel: "1824",
  })
  assert.equal(
    text,
    'Symphony no. 9 in D minor, op. 125, "Choral" by Ludwig van Beethoven. 1824 · Orchestral. Play recordings on Classical Portal.'
  )
})

test("schema dates and composition years stay blank when the source is not exact", () => {
  assert.equal(schemaDate(null), undefined)
  assert.equal(schemaDate("unknown"), undefined)
  assert.equal(schemaDate("1770-12-17"), "1770-12-17")
  assert.equal(schemaDate("1770-01-01"), "1770")
  assert.equal(schemaDate("1770"), "1770")
  assert.equal(schemaDate("1770-13-40"), "1770")
  assert.equal(exactCompositionYear(null), null)
  assert.equal(exactCompositionYear({ start: 1824, end: null, circa: false }), 1824)
  assert.equal(exactCompositionYear({ start: 1822, end: 1824, circa: false }), null)
  assert.equal(exactCompositionYear({ start: 1740, end: null, circa: true }), null)
})

test("composer structured data skips a portrait that is not an absolute URL", () => {
  const data = composerJsonLd({
    id: "145",
    completeName: "Ludwig van Beethoven",
    birth: "1770-12-17",
    death: null,
    portrait: "/portrait.jpg",
  })
  assert.equal(data.birthDate, "1770-12-17")
  assert.equal("deathDate" in data, false)
  assert.equal("image" in data, false)
  assert.equal(data.url, "https://classicalportal.app/composers/145")
})

test("work structured data omits dateCreated for a range", () => {
  const data = workJsonLd({
    id: "16238",
    title: 'Symphony no. 9 in D minor, op. 125, "Choral"',
    genre: "Orchestral",
    compositionDate: { start: 1822, end: 1824, circa: false },
    composer: { id: "145", completeName: "Ludwig van Beethoven" },
  })
  assert.equal(data["@type"], "MusicComposition")
  assert.equal("dateCreated" in data, false)
  assert.equal(data.genre, "Orchestral")
})

test("descriptions clamp on a word boundary", () => {
  const text = clampDescription(`${"word ".repeat(40)}end`, 80)
  assert.ok(text.length <= 80)
  assert.ok(text.endsWith("…"))
  assert.equal(text.includes("  "), false)
})

test("search descriptions and indexing", () => {
  assert.equal(searchDescription(""), "Search composers and works in the Open Opus catalog.")
  assert.equal(searchDescription("  "), "Search composers and works in the Open Opus catalog.")
  const meta = pageMetadata({
    title: "Search “bach”",
    description: searchDescription("bach"),
    path: "/search",
    socialPath: "/search?q=bach",
    index: false,
  })
  assert.deepEqual(meta.alternates, { canonical: "/search" })
  assert.equal(meta.openGraph && "url" in meta.openGraph ? meta.openGraph.url : null, "/search?q=bach")
  assert.deepEqual(meta.robots, { index: false, follow: true })
})

test("period and genre descriptions quote the catalog copy and the work count", () => {
  assert.equal(
    periodDescription({
      name: "Baroque",
      years: "c. 1600–1750",
      blurb: "Opera, concerto, and the high art of the figured bass.",
    }),
    "Baroque (c. 1600–1750). Opera, concerto, and the high art of the figured bass."
  )
  assert.equal(
    genreDescription({ name: "Orchestral", blurb: "Symphonies, suites, serenades, and divertimenti." }, 1200),
    "Orchestral: 1,200 works. Symphonies, suites, serenades, and divertimenti. Ordered by Spotify popularity."
  )
})

test("website structured data points search at the search page", () => {
  const data = websiteJsonLd()
  assert.equal(data.url, "https://classicalportal.app")
  assert.equal(
    data.potentialAction.target.urlTemplate,
    "https://classicalportal.app/search?q={search_term_string}"
  )
})
