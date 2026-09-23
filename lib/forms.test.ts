import assert from "node:assert/strict"
import { test } from "node:test"
import catalog from "../data/form-works.json" with { type: "json" }
import composerEpochs from "../data/composer-epochs.json" with { type: "json" }
import {
  CHARACTER_PIECES,
  FORM_GROUPS,
  catalogGenreFromSlug,
  classifyKeyboardInstrument,
  classifyWork,
  formFromSlug,
  formsForBrowseSlug,
  genreHrefForLabel,
  groupForForm,
  legacyKeyboardHref,
  relocatedGenreHref,
} from "./forms.ts"
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
  assert.equal(classifyWork("Piano Trio no. 7 in B flat major, op. 97"), "trio")
  assert.equal(classifyWork("String Trio in E flat major, op. 3"), "trio")
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

test("instrument and ensemble tags are not genre links", () => {
  for (const label of ["Keyboard", "keyboard", "Chamber", "Orchestral", "Stage", "Vocal"]) {
    assert.equal(genreHrefForLabel(label), null)
  }
  assert.equal(genreHrefForLabel(""), null)
  assert.equal(genreHrefForLabel("   "), null)
  assert.equal(genreHrefForLabel("son"), null)
})

test("real genre labels keep their genre route", () => {
  assert.equal(genreHrefForLabel("symphony"), "/genres/orchestral?filter=symphony")
  assert.equal(genreHrefForLabel("Opera"), "/genres/stage?filter=opera")
  assert.equal(genreHrefForLabel("Symphonies"), "/genres/orchestral?filter=symphony")
  assert.equal(genreHrefForLabel("Études"), "/genres/piano?filter=etude")
  assert.equal(genreHrefForLabel("Sonatas"), "/genres/sonata")
  assert.equal(genreHrefForLabel("Songs"), "/genres/song")
})

test("folded forms become chips on one genre page", () => {
  assert.deepEqual(formsForBrowseSlug("chamber"), ["trio", "quartet", "quintet", "sextet"])
  assert.deepEqual(formsForBrowseSlug("choral"), ["requiem", "mass", "oratorio", "motet", "cantata"])
  assert.deepEqual(formsForBrowseSlug("piano"), [...CHARACTER_PIECES])
  assert.deepEqual(formsForBrowseSlug("harpsichord"), [...CHARACTER_PIECES])
  assert.deepEqual(formsForBrowseSlug("organ"), [...CHARACTER_PIECES])
  assert.deepEqual(formsForBrowseSlug("keyboard"), [])
  assert.deepEqual(formsForBrowseSlug("stage"), ["opera", "ballet", "overture"])
  assert.deepEqual(formsForBrowseSlug("orchestral"), ["symphony", "suite", "serenade", "divertimento"])
  assert.equal(formsForBrowseSlug("orchestral").includes("overture"), false)
  assert.deepEqual(formsForBrowseSlug("baroque-keyboard"), [
    "prelude",
    "fugue",
    "toccata",
    "partita",
    "fantasia",
    "variations",
  ])
  assert.deepEqual(formsForBrowseSlug("concerto"), ["concerto"])
  assert.deepEqual(formsForBrowseSlug("sonata"), ["sonata"])
  assert.deepEqual(formsForBrowseSlug("song"), ["song"])
  assert.deepEqual(formsForBrowseSlug("quartet"), [])
  assert.deepEqual(formsForBrowseSlug("symphony"), [])
  assert.deepEqual(formsForBrowseSlug("mass"), [])
  assert.equal(catalogGenreFromSlug("chamber")?.name, "Chamber")
  assert.equal(catalogGenreFromSlug("keyboard"), undefined)
  assert.equal(catalogGenreFromSlug("piano")?.name, "Piano")
  assert.equal(catalogGenreFromSlug("harpsichord")?.name, "Harpsichord")
  assert.equal(catalogGenreFromSlug("organ")?.name, "Organ")
  assert.equal(catalogGenreFromSlug("stage")?.name, "Stage")
  assert.equal(catalogGenreFromSlug("orchestral")?.name, "Orchestral")
  assert.equal(catalogGenreFromSlug("baroque-keyboard")?.name, "Baroque keyboard")
  assert.equal(catalogGenreFromSlug("quartet"), undefined)
  assert.equal(catalogGenreFromSlug("symphony"), undefined)
  assert.equal(catalogGenreFromSlug("opera"), undefined)
  assert.equal(catalogGenreFromSlug("prelude"), undefined)
  assert.equal(relocatedGenreHref("quartet"), "/genres/chamber?filter=quartet")
  assert.equal(relocatedGenreHref("trio"), "/genres/chamber?filter=trio")
  assert.equal(relocatedGenreHref("sextet"), "/genres/chamber?filter=sextet")
  assert.equal(relocatedGenreHref("mass"), "/genres/choral?filter=mass")
  assert.equal(relocatedGenreHref("oratorio"), "/genres/choral?filter=oratorio")
  assert.equal(relocatedGenreHref("nocturne"), "/genres/piano?filter=nocturne")
  assert.equal(relocatedGenreHref("scherzo"), "/genres/piano?filter=scherzo")
  assert.equal(legacyKeyboardHref(), "/genres/piano")
  assert.equal(legacyKeyboardHref("etude"), "/genres/piano?filter=etude")
  assert.equal(legacyKeyboardHref("not a chip"), "/genres/piano")
  assert.equal(relocatedGenreHref("opera"), "/genres/stage?filter=opera")
  assert.equal(relocatedGenreHref("overture"), "/genres/stage?filter=overture")
  assert.equal(relocatedGenreHref("symphony"), "/genres/orchestral?filter=symphony")
  assert.equal(relocatedGenreHref("divertimento"), "/genres/orchestral?filter=divertimento")
  assert.equal(relocatedGenreHref("prelude"), "/genres/baroque-keyboard?filter=prelude")
  assert.equal(relocatedGenreHref("variations"), "/genres/baroque-keyboard?filter=variations")
  assert.equal(relocatedGenreHref("concerto"), null)
  assert.equal(relocatedGenreHref("sonata"), null)
  assert.equal(relocatedGenreHref("song"), null)
  assert.equal(genreHrefForLabel("Quartets"), "/genres/chamber?filter=quartet")
  assert.equal(genreHrefForLabel("Requiems"), "/genres/choral?filter=requiem")
  assert.equal(genreHrefForLabel("Motets"), "/genres/choral?filter=motet")
  assert.equal(genreHrefForLabel("Cantatas"), "/genres/choral?filter=cantata")
  const children = new Set<string>()
  for (const group of FORM_GROUPS) {
    for (const child of group.children) {
      assert.ok(formFromSlug(child), child)
      if (group.instrument) {
        assert.equal(CHARACTER_PIECES.includes(child as (typeof CHARACTER_PIECES)[number]), true, child)
        continue
      }
      assert.equal(children.has(child), false, child)
      children.add(child)
    }
  }
})

test("a sextet named before another form stays a sextet", () => {
  assert.equal(classifyWork("String Sextet no. 1 in B flat major, op. 18"), "sextet")
  assert.equal(classifyWork("Wind Sextet in E flat major, op. 71"), "sextet")
  assert.equal(
    classifyWork("Sextet in E flat major, for piano, string quartet, and double bass"),
    "sextet"
  )
  assert.equal(classifyWork("Sextet for Piano, Clarinet, Horn, and String Trio, op. 37"), "sextet")
  assert.equal(classifyWork("String Quartet no. 14 in C sharp minor, op. 131"), "quartet")
  assert.equal(classifyWork("Mládí, suite for wind sextet"), "suite")
  assert.equal(classifyWork("Fantasia, for strings or string sextet"), "fantasia")
  assert.equal(classifyWork("Threnody and Scherzo, for bassoon, harp, and string sextet"), "scherzo")
  assert.equal(classifyWork("Octet, for horn, piano, and string sextet"), null)
})

test("a form named in the title wins over a conflicting subtitle", () => {
  assert.equal(
    classifyWork("Cantata no. 201: Der Streit zwischen Phoebus und Pan, BWV.201", "Opera"),
    "cantata"
  )
  assert.equal(classifyWork('Symphony no. 3, op. 36, "Symphony of Sorrowful Songs"'), "symphony")
  assert.equal(classifyWork("Trio Sonata in C major"), "trio")
})

test("trio sonatas, piano trios, and string trios are chamber trios", () => {
  assert.equal(classifyWork("Trio Sonata in C major"), "trio")
  assert.equal(classifyWork("Sonata en trio for 2 manuals in pedal, for organ in D"), "trio")
  assert.equal(classifyWork("Trio, sonata for 2 violins and continuo in A minor"), "trio")
  assert.equal(classifyWork("Sonata a3, for 2 violins, trombone and continuo"), "trio")
  assert.equal(classifyWork("Triosonate in D major"), "trio")
  assert.equal(classifyWork("Piano Trio no. 1 in B flat major"), "trio")
  assert.equal(classifyWork("String Trio in E flat major, op. 3"), "trio")
  assert.equal(classifyWork("Piano Sonata no. 14 in C sharp minor"), "sonata")
  assert.equal(classifyWork("Violin Sonata no. 9 in A major, op. 47"), "sonata")
  assert.equal(
    classifyWork(
      "Cello Sonata in E flat major, op. 64",
      "Version for cello and piano of the String Trio, op. 3"
    ),
    "sonata"
  )
})

test("character pieces use the named instrument, then the composer's era", () => {
  assert.equal(classifyKeyboardInstrument("Nocturne for piano in E flat", "", "Romantic"), "piano")
  assert.equal(classifyKeyboardInstrument("Etude for pianoforte", "", "Classical"), "piano")
  assert.equal(classifyKeyboardInstrument("Toccata for harpsichord", "", "Modern"), "harpsichord")
  assert.equal(classifyKeyboardInstrument("Sonata for cembalo", "", "Classical"), "harpsichord")
  assert.equal(classifyKeyboardInstrument("Pieces de clavecin", "", "Baroque"), "harpsichord")
  assert.equal(classifyKeyboardInstrument("Scherzo for organ", "", "Romantic"), "organ")
  assert.equal(
    classifyKeyboardInstrument("Etudes in Canon Form", "For pedal piano or organ", "Romantic"),
    "piano"
  )
  assert.equal(classifyKeyboardInstrument("Prelude for clavier", "", "Baroque"), "harpsichord")
  assert.equal(classifyKeyboardInstrument("Klavierstück", "", "Romantic"), "piano")
  assert.equal(classifyKeyboardInstrument("Nocturne in E flat major, op. 9 no. 2", "", "Romantic"), "piano")
  assert.equal(classifyKeyboardInstrument("Ballade for 3 voices", "", "Medieval"), "harpsichord")
  assert.equal(classifyKeyboardInstrument("Waltz", "", null), "piano")
})

test("the catalog files trio sonatas under trios and splits the old keyboard group", () => {
  const epochs = composerEpochs as Record<string, string>
  const works = catalog.works
  const sonatas = works.filter((work) => work.form === "sonata")
  assert.equal(
    sonatas.some((work) => /trio sonata|sonata en trio|sonata a\s*3/i.test(`${work.title} ${work.subtitle}`)),
    false
  )
  assert.ok(works.some((work) => work.form === "trio" && /trio sonata/i.test(work.title)))
  assert.equal(FORM_GROUPS.some((group) => group.slug === "keyboard"), false)
  assert.equal(catalogGenreFromSlug("keyboard"), undefined)
  for (const slug of ["piano", "harpsichord", "organ", "baroque-keyboard", "chamber"]) {
    assert.ok(catalogGenreFromSlug(slug), slug)
  }

  const counts = { piano: 0, harpsichord: 0, organ: 0 }
  for (const work of works) {
    if (!CHARACTER_PIECES.includes(work.form as (typeof CHARACTER_PIECES)[number])) continue
    assert.equal(groupForForm(work.form)?.instrument, "piano")
    const instrument = classifyKeyboardInstrument(work.title, work.subtitle, epochs[work.composerId] ?? null)
    counts[instrument] += 1
    if (instrument === "organ") {
      assert.match(`${work.title} ${work.subtitle}`, /organ/i)
    }
  }
  assert.ok(counts.piano > counts.harpsichord)
  assert.ok(counts.harpsichord > 0)
  assert.ok(counts.organ > 0)
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
