import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildDateIndex,
  extractCatalogueKeys,
  extractFormKey,
  matchCompositionYear,
  selectComposerQid,
  sortWorksChronologically,
  type DatedWorkLabels,
} from "./composition-date.ts"

const beethoven: DatedWorkLabels[] = [
  {
    year: 1807,
    labels: ["Symphony No. 5", "Symphony No. 5 in C Minor, Op. 67", "Fate Symphony"],
  },
  {
    year: 1808,
    labels: ["Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio"],
  },
  {
    year: 1824,
    labels: ["Symphony No. 9 in D minor, Op. 125", "Ode to Joy", "Symphony No. 9"],
  },
  {
    year: 1797,
    labels: ["Piano Sonata No. 8", 'Piano Sonata No. 8 in C Minor, Op. 13, "Pathétique"'],
  },
  { year: 1795, labels: ["Piano Sonata No. 1 in F Minor, Op. 2, No. 1"] },
  { year: 1796, labels: ["Piano Sonata No. 2 in A Major, Op. 2, No. 2"] },
  { year: 1806, labels: ["String Quartet No. 7 in F major, Op. 59, No. 1", "Razumovsky"] },
  { year: 1810, labels: ['Bagatelle in A Minor, WoO 59, "Für Elise"', "Für Elise"] },
  { year: 1809, labels: ['Piano Concerto No. 5 in E-flat Major, Op. 73, "Emperor"'] },
  { year: 1725, labels: ["The Four Seasons", "Le quattro stagioni"] },
]

test("catalogue keys keep opus subnumbers and ignore the work number", () => {
  assert.deepEqual(extractCatalogueKeys("Symphony no. 5 in C minor, op. 67"), ["op:67"])
  assert.deepEqual(extractCatalogueKeys("String Quartet no. 7 in F major, op. 59 no. 1"), ["op:59:1"])
  assert.ok(extractCatalogueKeys("Piano Sonata no. 1 in F minor, op. 2, no. 1").includes("op:2:1"))
  assert.equal(extractCatalogueKeys("Piano Sonata no. 1 in F minor, op. 2, no. 1").includes("op:2"), false)
  assert.ok(extractCatalogueKeys("Leonore Overture no. 3, op. 72b").includes("op:72b"))
  assert.ok(extractCatalogueKeys("Fantasia in F minor, D.940, op. posth.103").includes("op.posth:103"))
  assert.ok(extractCatalogueKeys("Fantasia in F minor, D.940, op. posth.103").includes("d:940"))
})

test("catalogue keys normalize common numbering systems", () => {
  assert.ok(extractCatalogueKeys("Cantata no. 140, BWV.140").includes("bwv:140"))
  assert.ok(extractCatalogueKeys("BWV 1047").includes("bwv:1047"))
  assert.deepEqual(extractCatalogueKeys("K.550").sort(), extractCatalogueKeys("KV 550").sort())
  assert.ok(extractCatalogueKeys("Symphony no. 94, Hob.I:94").includes("hob:i:94"))
  assert.ok(extractCatalogueKeys("Keyboard Concerto, Hob.XVIII:11").includes("hob:xviii:11"))
  assert.ok(extractCatalogueKeys('Bagatelle, WoO 59').includes("woo:59"))
  assert.ok(extractCatalogueKeys("Gloria, RV.589").includes("rv:589"))
  assert.ok(extractCatalogueKeys("3 Minuets, BWV.841-843").includes("bwv:841-843"))
})

test("form keys keep the ensemble so sonata 8 does not match every sonata 8", () => {
  assert.equal(extractFormKey("Symphony no. 5 in C minor, op. 67"), "symphony:5")
  assert.equal(extractFormKey("Piano Sonata no. 8 in C minor, op. 13"), "piano sonata:8")
  assert.equal(extractFormKey("Violin Sonata no. 9 in A major, op. 47"), "violin sonata:9")
  assert.equal(extractFormKey("String Quartet no. 14 in D minor, D.810"), "string quartet:14")
  assert.equal(extractFormKey("Piano Concerto no. 20 in D minor, K.466"), "piano concerto:20")
  assert.equal(extractFormKey("Nocturnes, op. 9"), null)
})

test("matches a unique catalogue year and ignores movement rows", () => {
  const index = buildDateIndex(beethoven)
  assert.equal(matchCompositionYear("Symphony no. 5 in C minor, op. 67", index), 1807)
  assert.equal(matchCompositionYear('Piano Concerto no. 5 in E flat major, op. 73, "Emperor"', index), 1809)
  assert.equal(matchCompositionYear('Bagatelle in A minor, WoO 59, "Für Elise"', index), 1810)
  assert.equal(matchCompositionYear("Piano Sonata no. 1 in F minor, op. 2, no. 1", index), 1795)
  assert.equal(matchCompositionYear("Piano Sonata no. 2 in A major, op. 2, no. 2", index), 1796)
  assert.equal(matchCompositionYear("3 Piano Sonatas, op. 2", index), null)
})

test("does not treat a nickname or a different number as the same work", () => {
  const index = buildDateIndex(beethoven)
  assert.equal(matchCompositionYear("Ode to Joy", index), null)
  assert.equal(matchCompositionYear("Für Elise", index), null)
  assert.equal(matchCompositionYear("Symphony no. 50 in C major, op. 500", index), null)
  assert.equal(matchCompositionYear("Symphony no. 15", index), null)
  assert.equal(matchCompositionYear("Symphony no. 9 in D minor, op. 125, \"Choral\"", index), 1824)
})

test("uses form or the full title only when that year is unique", () => {
  const mahler = buildDateIndex([
    { year: 1902, labels: ["Symphony No. 5", "Symphony No. 5 in C-sharp minor"] },
    { year: 1888, labels: ["Symphony No. 1", 'Symphony No. 1 in D major, "Titan"'] },
  ])
  assert.equal(matchCompositionYear("Symphony no. 5 in C sharp minor", mahler), 1902)
  assert.equal(matchCompositionYear('Symphony no. 1 in D major, "Titan"', mahler), 1888)

  const ambiguous = buildDateIndex([
    { year: 1807, labels: ["Symphony No. 5", "Symphony No. 5 in C Minor, Op. 67"] },
    { year: 1902, labels: ["Symphony No. 5"] },
  ])
  assert.equal(matchCompositionYear("Symphony no. 5", ambiguous), null)
  assert.equal(matchCompositionYear("Symphony no. 5 in C minor, op. 67", ambiguous), 1807)

  const index = buildDateIndex(beethoven)
  assert.equal(matchCompositionYear("The Four Seasons", index), 1725)
  assert.equal(matchCompositionYear("Concerto", index, "Le quattro stagioni"), 1725)
})

test("a movement with its own year does not hide the parent work", () => {
  const index = buildDateIndex([
    { year: 1839, labels: ["Piano Sonata No. 2 in B-flat minor, Op. 35"] },
    { year: 1837, labels: ["Sonatas, piano, no. 2, op. 35, B-flat minor. Marche funèbre"] },
  ])
  assert.equal(matchCompositionYear("Sonata no. 2 in B flat minor, op. 35", index), 1839)
})

test("titles match a unique Wikidata label used as a prefix, suffix, or nickname", () => {
  const mozart = buildDateIndex([
    { year: 1791, labels: ["The Magic Flute", "Magic Flute"] },
    { year: 1795, labels: ["The Magic Flute Part Two"] },
    { year: 1787, labels: ["Eine kleine Nachtmusik"] },
  ])
  assert.equal(matchCompositionYear("The Magic Flute, K.620", mozart), 1791)
  assert.equal(matchCompositionYear('Serenade in G major, K.525, "Eine Kleine Nachtmusik"', mozart), 1787)

  const mahler = buildDateIndex([{ year: 1888, labels: ["Symphony No. 1"] }])
  assert.equal(matchCompositionYear('Symphony no. 1 in D major, "Titan"', mahler), 1888)
  assert.equal(matchCompositionYear("Symphony no. 15 in D minor", mahler), null)
  assert.equal(matchCompositionYear("Symphony no. 10", mahler), null)
})

test("disagreement between catalogue numbers yields no year", () => {
  const index = buildDateIndex([
    { year: 1815, labels: ["Erlkönig, D.328"] },
    { year: 1821, labels: ["A different piece, Op. 1"] },
  ])
  assert.equal(matchCompositionYear("Erlkönig, D.328, op. 1", index), null)
})

test("All-list sort is chronological, then undated titles A–Z", () => {
  const sorted = sortWorksChronologically([
    { title: "Zulu", compositionYear: null },
    { title: "Alpha", compositionYear: null },
    { title: "Middle", compositionYear: 1800 },
    { title: "Early", compositionYear: 1790 },
    { title: "Also Early", compositionYear: 1790 },
  ])
  assert.deepEqual(
    sorted.map((work) => work.title),
    ["Also Early", "Early", "Middle", "Alpha", "Zulu"]
  )
})

test("composer resolution prefers the person with a matching birth year", () => {
  const candidates = [
    {
      id: "Q255",
      label: "Ludwig van Beethoven",
      description: "German composer (1770-1827)",
      birthYear: 1770,
      composerOccupation: true,
    },
    {
      id: "Q12368917",
      label: "Ludwig van Beethoven",
      description: "grandfather of composer Ludwig van Beethoven",
      birthYear: 1712,
      composerOccupation: false,
    },
    {
      id: "Qfilm",
      label: "Ludwig van Beethoven",
      description: "1954 film directed by Max Jaap",
      birthYear: null,
      composerOccupation: false,
    },
  ]
  assert.equal(selectComposerQid("Ludwig van Beethoven", 1770, candidates), "Q255")
  assert.equal(
    selectComposerQid("Franz Joseph Haydn", 1732, [
      {
        id: "Q7349",
        label: "Joseph Haydn",
        description: "Austrian composer (1732–1809)",
        birthYear: 1732,
        composerOccupation: true,
      },
      {
        id: "Qpainting",
        label: "Franz Joseph Haydn (1732-1809)",
        description: "painting by John Hoppner",
        birthYear: null,
        composerOccupation: false,
      },
    ]),
    "Q7349"
  )
  assert.equal(
    selectComposerQid("Wolfgang Amadeus Mozart", 1756, [
      {
        id: "Q254",
        label: "Wolfgang Amadeus Mozart",
        description: "Austrian composer of the Classical period (1756-1791)",
        birthYear: 1756,
        composerOccupation: true,
      },
      {
        id: "Q156023",
        label: "Franz Xaver Wolfgang Mozart",
        description: "Austrian composer, youngest son of Wolfgang Amadeus Mozart",
        birthYear: 1791,
        composerOccupation: true,
      },
    ]),
    "Q254"
  )
  assert.equal(
    selectComposerQid("William Byrd", 1540, [
      {
        id: "Q208375",
        label: "William Byrd",
        description: "English composer (ca. 1540-1623)",
        birthYear: 1543,
        composerOccupation: true,
      },
      {
        id: "Qball",
        label: "William Byrd",
        description: "American basketball player (born 1985)",
        birthYear: 1985,
        composerOccupation: false,
      },
    ]),
    "Q208375"
  )
  assert.equal(
    selectComposerQid("Marc-Antoine Charpentier", 1636, [
      {
        id: "Q55524",
        label: "Marc-Antoine Charpentier",
        description: "17th-century French composer",
        birthYear: 1643,
        composerOccupation: true,
      },
    ]),
    "Q55524"
  )
  assert.equal(
    selectComposerQid("Mily Balakirev", 1837, [
      {
        id: "Q185040",
        label: "Mily Alexeyevich Balakirev",
        description: "Russian composer, pianist, and conductor (1837–1910)",
        birthYear: 1836,
        composerOccupation: true,
      },
    ]),
    "Q185040"
  )
  assert.equal(
    selectComposerQid("Johann Strauss Jr", 1825, [
      {
        id: "Q138564",
        label: "Johann Strauss II",
        description: "Austrian composer (1825–1899)",
        birthYear: 1825,
        composerOccupation: true,
      },
      {
        id: "Q119112",
        label: "Johann Strauss I",
        description: "Austrian composer (1804–1849)",
        birthYear: 1804,
        composerOccupation: true,
      },
    ]),
    "Q138564"
  )
  assert.equal(
    selectComposerQid("Witold Lutoslawski", 1913, [
      {
        id: "Q156472",
        label: "Witold Lutosławski",
        description: "Polish composer and conductor (1913-1994)",
        birthYear: 1913,
        composerOccupation: true,
      },
    ]),
    "Q156472"
  )
  assert.equal(
    selectComposerQid("Alexander Glazunov", 1865, [
      {
        id: "Q25872",
        label: "Alexander Glazounov",
        description: "Russian composer, music teacher and conductor (1865-1936)",
        birthYear: 1865,
        composerOccupation: true,
      },
    ]),
    "Q25872"
  )
  assert.equal(
    selectComposerQid("Mikhail Ivanovich Glinka", 1804, [
      {
        id: "Q181885",
        label: "Michael Glinka",
        description: "Russian composer (1804–1857)",
        birthYear: 1804,
        composerOccupation: true,
      },
    ]),
    "Q181885"
  )
})
