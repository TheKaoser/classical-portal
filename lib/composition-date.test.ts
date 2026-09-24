import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildDateIndex,
  catalogueKeyLabel,
  dateFromInceptionClaim,
  dateFromWikidataPrecision,
  mergeDateIndexes,
  suppressDisputedSetKeys,
  dateWithinLife,
  extractCatalogueKeys,
  extractFormKey,
  mergeExactYears,
  formatCompositionDate,
  labelsForCatalogueCode,
  matchCompositionYear,
  normalizeDateIndex,
  parseCompositionDateText,
  prefixFromCatalogueLabels,
  selectComposerQid,
  sortWorksChronologically,
  type DateIndex,
  type DatedWorkLabels,
} from "./composition-date.ts"

function year(title: string, index: DateIndex, extra?: string | string[] | null) {
  return matchCompositionYear(title, index, extra)?.start ?? null
}

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
  assert.ok(extractCatalogueKeys("Cello Concerto no. 1, Hob.VIIb:1").includes("hob:viib:1"))
  assert.ok(extractCatalogueKeys("2 Marches, Hob.VIII:1-2").includes("hob:viii:1-2"))
  assert.equal(extractCatalogueKeys("2 Marches, Hob.VIII:1-2").includes("hob:viii:1"), false)
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
  assert.equal(year("Symphony no. 5 in C minor, op. 67", index), 1807)
  assert.equal(year('Piano Concerto no. 5 in E flat major, op. 73, "Emperor"', index), 1809)
  assert.equal(year('Bagatelle in A minor, WoO 59, "Für Elise"', index), 1810)
  assert.equal(year("Piano Sonata no. 1 in F minor, op. 2, no. 1", index), 1795)
  assert.equal(year("Piano Sonata no. 2 in A major, op. 2, no. 2", index), 1796)
  assert.equal(year("3 Piano Sonatas, op. 2", index), null)
})

test("does not treat a nickname or a different number as the same work", () => {
  const index = buildDateIndex(beethoven)
  assert.equal(year("Ode to Joy", index), null)
  assert.equal(year("Für Elise", index), null)
  assert.equal(year("Symphony no. 50 in C major, op. 500", index), null)
  assert.equal(year("Symphony no. 15", index), null)
  assert.equal(year("Symphony no. 9 in D minor, op. 125, \"Choral\"", index), 1824)
})

test("uses form or the full title only when that year is unique", () => {
  const mahler = buildDateIndex([
    { year: 1902, labels: ["Symphony No. 5", "Symphony No. 5 in C-sharp minor"] },
    { year: 1888, labels: ["Symphony No. 1", 'Symphony No. 1 in D major, "Titan"'] },
  ])
  assert.equal(year("Symphony no. 5 in C sharp minor", mahler), 1902)
  assert.equal(year('Symphony no. 1 in D major, "Titan"', mahler), 1888)

  const ambiguous = buildDateIndex([
    { year: 1807, labels: ["Symphony No. 5", "Symphony No. 5 in C Minor, Op. 67"] },
    { year: 1902, labels: ["Symphony No. 5"] },
  ])
  assert.equal(year("Symphony no. 5", ambiguous), null)
  assert.equal(year("Symphony no. 5 in C minor, op. 67", ambiguous), 1807)

  const index = buildDateIndex(beethoven)
  assert.equal(year("The Four Seasons", index), 1725)
  assert.equal(year("Concerto", index, "Le quattro stagioni"), 1725)
})

test("a movement with its own year does not hide the parent work", () => {
  const index = buildDateIndex([
    { year: 1839, labels: ["Piano Sonata No. 2 in B-flat minor, Op. 35"] },
    { year: 1837, labels: ["Sonatas, piano, no. 2, op. 35, B-flat minor. Marche funèbre"] },
  ])
  assert.equal(year("Sonata no. 2 in B flat minor, op. 35", index), 1839)
})

test("titles match a unique Wikidata label used as a prefix, suffix, or nickname", () => {
  const mozart = buildDateIndex([
    { year: 1791, labels: ["The Magic Flute", "Magic Flute", "K. 620"] },
    { year: 1795, labels: ["The Magic Flute Part Two"] },
    { year: 1787, labels: ["Eine kleine Nachtmusik", "K. 525"] },
  ])
  assert.equal(year("The Magic Flute, K.620", mozart), 1791)
  assert.equal(year('Serenade in G major, "Eine Kleine Nachtmusik"', mozart), 1787)
  assert.equal(year('Serenade in G major, K.525, "Eine Kleine Nachtmusik"', mozart), 1787)
  assert.equal(year("The Magic Flute Part Two", mozart), 1795)

  const mahler = buildDateIndex([{ year: 1888, labels: ["Symphony No. 1"] }])
  assert.equal(year('Symphony no. 1 in D major, "Titan"', mahler), 1888)
  assert.equal(year("Symphony no. 15 in D minor", mahler), null)
  assert.equal(year("Symphony no. 10", mahler), null)
})

test("disagreement between catalogue numbers yields no year", () => {
  const index = buildDateIndex([
    { year: 1815, labels: ["Erlkönig, D.328"] },
    { year: 1821, labels: ["A different piece, Op. 1"] },
  ])
  assert.equal(year("Erlkönig, D.328, op. 1", index), null)
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

test("a catalogue suffix still dates the distinctive title", () => {
  const index = buildDateIndex([{ year: 1997, labels: ["Asyla, Op. 17"] }])
  assert.equal(year("Asyla", index), 1997)
  assert.equal(year("Asyla, op. 18", index), null)
  assert.equal(year("Symphony no. 5", buildDateIndex([{ year: 1808, labels: ["Symphony No. 5, Op. 67"] }])), 1808)
})

test("a catalogue span is dated only when every number in it is dated", () => {
  const index = buildDateIndex([
    { year: 1720, labels: ["Minuet, BWV 841"] },
    { year: 1720, labels: ["Minuet, BWV 842"] },
    { year: 1722, labels: ["Minuet, BWV 843"] },
    { year: 1725, labels: ["Prelude, BWV 933"] },
    { year: 1725, labels: ["Prelude, BWV 934"] },
  ])
  assert.deepEqual(matchCompositionYear("3 Minuets, BWV.841-843", index), {
    start: 1720,
    end: 1722,
    circa: false,
  })
  assert.equal(year("6 Preludes, BWV.933-38", index), null)
  const complete = buildDateIndex([933, 934, 935, 936, 937, 938].map((number) => ({
    year: 1720,
    labels: [`Prelude, BWV ${number}`],
  })))
  assert.equal(year("6 Preludes, BWV.933-38", complete), 1720)
})

test("Bach cantata numbers use BWV when the title omits the catalogue", () => {
  const index = buildDateIndex([{ year: 1723, labels: ["Herz und Mund und Tat und Leben, BWV 147"] }])
  assert.equal(year("Cantata no. 147: Herz und Mund und Tat und Leben", index), 1723)
  assert.equal(year("Cantata no. 565", index), null)
  assert.equal(year("Violin Sonata no. 1 in G minor", buildDateIndex([
    { year: 1720, labels: ["Cantata, BWV 1"] },
  ])), null)
})

test("close inception years become one range and distant ones do not", () => {
  assert.deepEqual(mergeExactYears([
    { start: 1831, end: null, circa: false },
    { start: 1835, end: null, circa: false },
  ]), { start: 1831, end: 1835, circa: false })
  assert.equal(mergeExactYears([
    { start: 1700, end: 1709, circa: false },
    { start: 1705, end: null, circa: false },
  ]), null)
  assert.equal(mergeExactYears([
    { start: 1600, end: null, circa: false },
    { start: 1720, end: null, circa: false },
  ]), null)
})

test("an unmatched catalogue number does not borrow another work's year", () => {
  const index = buildDateIndex(beethoven)
  assert.equal(year("Symphony no. 5 in C minor, op. 500", index), null)
  assert.equal(year("Symphony no. 5 in C minor", index), 1807)
})

test("an exact title wins over a shorter work it contains", () => {
  const index = buildDateIndex([
    { year: 1934, labels: ["Symphony Mathis der Maler"] },
    { year: 1933, end: 1935, labels: ["Mathis der Maler"] },
  ])
  assert.equal(year("Symphony Mathis der Maler", index), 1934)
  assert.deepEqual(matchCompositionYear("Mathis der Maler", index), { start: 1933, end: 1935, circa: false })
})

test("a shorter title does not date a later book or part", () => {
  const index = buildDateIndex([
    { year: 1722, labels: ["The Well-Tempered Clavier"] },
    { year: 1742, labels: ["The Well-Tempered Clavier, Book 2"] },
  ])
  assert.equal(year("The Well-Tempered Clavier", index), 1722)
  assert.equal(year("The Well-Tempered Clavier, Book 2", index), 1742)
  assert.equal(year("The Well-Tempered Clavier, Book 1", index), null)
  assert.equal(year("The Magic Flute Part Two", index), null)
})

test("parses IMSLP composition phrases without guessing", () => {
  assert.deepEqual(parseCompositionDateText("1731 in Leipzig"), { start: 1731, end: null, circa: false })
  assert.deepEqual(parseCompositionDateText("1740 ca."), { start: 1740, end: null, circa: true })
  assert.deepEqual(parseCompositionDateText("c. 1720"), { start: 1720, end: null, circa: true })
  assert.deepEqual(parseCompositionDateText("1724-25"), { start: 1724, end: 1725, circa: false })
  assert.deepEqual(parseCompositionDateText("1724/1725"), { start: 1724, end: 1725, circa: false })
  assert.deepEqual(parseCompositionDateText("1698-02"), { start: 1698, end: 1702, circa: false })
  assert.deepEqual(parseCompositionDateText("1720s"), { start: 1720, end: 1729, circa: false })
  assert.deepEqual(parseCompositionDateText("1731-11-14"), { start: 1731, end: null, circa: false })
  assert.deepEqual(parseCompositionDateText("1731, revised 1735"), { start: 1731, end: 1735, circa: false })
  assert.deepEqual(parseCompositionDateText("1733, rev.1748-49 (August to October)"), {
    start: 1733,
    end: 1749,
    circa: false,
  })
  assert.deepEqual(parseCompositionDateText("1736, revised 1742, 1743-46"), { start: 1736, end: 1746, circa: false })
  assert.deepEqual(parseCompositionDateText("1742-46; rev. 1748–50"), { start: 1742, end: 1750, circa: false })
  assert.equal(parseCompositionDateText("1708 ?"), null)
  assert.equal(parseCompositionDateText("1723, published 1850"), null)
  assert.deepEqual(
    parseCompositionDateText(
      "1721 in [[6 Brandenburg Concertos (Bach, Johann Sebastian)|''Six Concerts avec plusieurs Instruments'']] (No.1)"
    ),
    { start: 1721, end: null, circa: false }
  )
  assert.equal(parseCompositionDateText("early 1720s"), null)
  assert.equal(parseCompositionDateText("before 1740"), null)
  assert.equal(parseCompositionDateText("1723?"), null)
  assert.equal(parseCompositionDateText("18th century"), null)
  assert.equal(parseCompositionDateText("1800s"), null)
  assert.equal(parseCompositionDateText("BWV 1046"), null)
  assert.equal(parseCompositionDateText(""), null)
  assert.equal(formatCompositionDate({ start: 1724, end: 1725, circa: false }), "1724–25")
  assert.equal(formatCompositionDate({ start: 1798, end: 1802, circa: false }), "1798–1802")
  assert.equal(formatCompositionDate({ start: 1740, end: null, circa: true }), "c. 1740")
})

test("catalogue codes become the same keys Open Opus titles use", () => {
  assert.deepEqual(labelsForCatalogueCode("bwv", "140"), ["BWV 140"])
  assert.ok(labelsForCatalogueCode("bwv", "Anh 16").some((label) => extractCatalogueKeys(label).includes("bwv.anh:16")))
  assert.ok(extractCatalogueKeys(labelsForCatalogueCode("op", "59 no. 1")[0]).includes("op:59:1"))
  assert.ok(extractCatalogueKeys(labelsForCatalogueCode("hob", "XVIII:11")[0]).includes("hob:xviii:11"))
  assert.ok(extractCatalogueKeys(labelsForCatalogueCode("k", "550")[0]).includes("k:550"))
  assert.deepEqual(labelsForCatalogueCode(null, "3732626501"), [])
  assert.deepEqual(labelsForCatalogueCode("op", "3732626501"), [])
  assert.equal(prefixFromCatalogueLabels("Bach-Werke-Verzeichnis", ["BWV"]), "bwv")
  assert.equal(prefixFromCatalogueLabels("Köchel catalogue", ["K", "KV"]), "k")
  assert.equal(prefixFromCatalogueLabels("Werke ohne Opuszahl", ["WoO"]), "woo")
  assert.equal(prefixFromCatalogueLabels("Brown catalogue", ["BI", "B"]), "b")
})

test("catalogue keys cover Hoboken lists, Köchel alternates, and Warburton numbers", () => {
  assert.deepEqual(extractCatalogueKeys("2 Divertimenti, Hob.II, nos. 13-14"), ["hob:ii:13-14"])
  assert.ok(extractCatalogueKeys("3 String Quartets, op. 54, H.3/57-59").includes("hob:iii:57-59"))
  assert.equal(extractCatalogueKeys("3 String Quartets, op. 54, H.3/57-59").includes("h:3"), false)
  assert.ok(extractCatalogueKeys("6 Sonatas, Wq.48, H.24-29").includes("h:24-29"))
  const koechel = extractCatalogueKeys("Divertimento in E-flat major, K.252/240a")
  assert.ok(koechel.includes("k:252"))
  assert.ok(koechel.includes("k:240a"))
  const anh = extractCatalogueKeys("Allegro, K.Anh.95/484b")
  assert.ok(anh.includes("k.anh:95"))
  assert.ok(anh.includes("k:484b"))
  assert.ok(extractCatalogueKeys("Adagio in F major, K.Anh.206a").includes("k.anh:206a"))
  assert.ok(extractCatalogueKeys("Harpsichord Concerto, CW C65").includes("cw:c65"))
  assert.ok(extractCatalogueKeys("Adriano in Siria, CW.G6").includes("cw:g6"))
  assert.ok(extractCatalogueKeys("Bassoon Concerto, CW 36/195").includes("cw:36:195"))
  assert.ok(extractCatalogueKeys("Alessandro nell'Indie, W.G3").includes("w:g3"))
  assert.equal(extractCatalogueKeys("Fantasia in F minor, op. posth.103").includes("posth:103"), false)
})

test("a Hoboken list is dated only when every number in it is dated", () => {
  const index = buildDateIndex([
    { year: 1765, labels: ["Divertimento, Hob.II:13"] },
    { year: 1767, labels: ["Divertimento, Hob.II:14"] },
  ])
  assert.deepEqual(matchCompositionYear("2 Divertimenti, Hob.II, nos. 13-14", index), {
    start: 1765,
    end: 1767,
    circa: false,
  })
  assert.equal(matchCompositionYear("2 Divertimenti, Hob.II, nos. 13-15", index), null)
})

test("a set key is kept only when every numbered piece shares it", () => {
  const disagreed = buildDateIndex([
    { year: 1829, labels: ["Etude in C major, Op. 10 no. 1"] },
    { year: 1832, labels: ["Etude in A minor, Op. 10 no. 2"] },
    { year: 1830, labels: ["Etudes, Op. 10"] },
  ])
  assert.equal(disagreed.catalogue["op:10"], undefined)
  assert.equal(year("Etude in C major, op. 10 no. 1", disagreed), 1829)
  assert.equal(year("Etudes, op. 10", disagreed), null)

  const shared = buildDateIndex([
    { year: 1830, labels: ["Etude in C major, Op. 10 no. 1"] },
    { year: 1830, labels: ["Etude in A minor, Op. 10 no. 2"] },
    { year: 1830, labels: ["Etudes, Op. 10"] },
  ])
  assert.equal(year("Etudes, op. 10", shared), 1830)
  const kept = suppressDisputedSetKeys(shared)
  assert.equal(kept.catalogue["op:10"]?.start, 1830)

  const symphony = buildDateIndex([
    { year: 1842, labels: ["Symphony No. 3, Op. 56"] },
    { year: 1845, labels: ["Song, Op. 56 no. 2"] },
    { year: 1845, labels: ["Song, Op. 56 no. 3"] },
  ])
  assert.equal(year("Symphony no. 3, op. 56", symphony), 1842)
  assert.equal(year("Song, op. 56 no. 2", symphony), 1845)
})

test("merging indexes fills blank keys and does not replace a stored year", () => {
  const merged = mergeDateIndexes(
    { catalogue: { "op:67": { start: 1807, end: null, circa: false } }, form: {}, title: {} },
    {
      catalogue: {
        "op:67": { start: 1808, end: null, circa: false },
        "op:68": { start: 1809, end: null, circa: false },
      },
      form: {},
      title: {},
    }
  )
  assert.equal(merged.catalogue["op:67"].start, 1807)
  assert.equal(merged.catalogue["op:68"].start, 1809)
})

test("catalogue labels round-trip into the same keys", () => {
  for (const key of ["op:67", "op:59:1", "op.posth:103", "k:240a", "k.anh:95", "hob:xviii:11", "hob:iii:57-59", "bwv:811", "bwv:841-843", "woo:54", "cw:c65", "cw:g6", "cw:36:195", "w:g3", "d:940"]) {
    const label = catalogueKeyLabel(key)
    assert.ok(label, key)
    assert.ok(extractCatalogueKeys(label as string).includes(key), `${key} via ${label}`)
  }
})

test("inception qualifiers supply a span when the main value is not a year", () => {
  assert.deepEqual(
    dateFromInceptionClaim(
      "+1700-00-00T00:00:00Z",
      8,
      { time: "+1703-00-00T00:00:00Z", precision: 9 },
      { time: "+1708-00-00T00:00:00Z", precision: 9 }
    ),
    { start: 1703, end: 1708, circa: false }
  )
  assert.deepEqual(
    dateFromInceptionClaim(
      "+1808-00-00T00:00:00Z",
      9,
      { time: "+1804-00-00T00:00:00Z", precision: 9 },
      { time: "+1808-00-00T00:00:00Z", precision: 9 }
    ),
    { start: 1808, end: null, circa: false }
  )
  assert.equal(dateFromInceptionClaim("+1700-00-00T00:00:00Z", 8, null, null), null)
})

test("wikidata precision and life span stay conservative", () => {
  assert.deepEqual(dateFromWikidataPrecision("+1808-00-00T00:00:00Z", 9), { start: 1808, end: null, circa: false })
  assert.deepEqual(dateFromWikidataPrecision("+1720-00-00T00:00:00Z", 8), { start: 1720, end: 1729, circa: false })
  assert.equal(dateFromWikidataPrecision("+1800-00-00T00:00:00Z", 8), null)
  assert.equal(dateFromWikidataPrecision("+1700-00-00T00:00:00Z", 7), null)
  assert.equal(dateWithinLife({ start: 1731, end: null, circa: false }, 1685, 1750), true)
  assert.equal(dateWithinLife({ start: 1881, end: null, circa: false }, 1685, 1750), false)
  const index = normalizeDateIndex({ catalogue: { "op:67": 1808 }, form: {}, title: {} })
  assert.equal(year("Symphony no. 5, op. 67", index!), 1808)
})
