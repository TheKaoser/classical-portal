import assert from "node:assert/strict"
import { test } from "node:test"
import catalog from "../data/form-works.json" with { type: "json" }
import composerEpochs from "../data/composer-epochs.json" with { type: "json" }
import {
  BAROQUE_KEYBOARD_FORMS,
  CHARACTER_PIECES,
  FORM_GROUPS,
  KEYBOARD_FORMS,
  KEYBOARD_INSTRUMENTS,
  browsePageForForm,
  catalogGenreFromSlug,
  classifyKeyboardInstrument,
  classifyWork,
  formFromSlug,
  formsForBrowseSlug,
  genreHrefForLabel,
  groupForForm,
  legacyBaroqueKeyboardHref,
  legacyKeyboardInstrumentHref,
  relocatedGenreHref,
  WORK_FORMS,
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
  assert.equal(genreHrefForLabel("Études"), "/genres/keyboard?filter=etude")
  assert.equal(genreHrefForLabel("Sonatas"), "/genres/sonata")
  assert.equal(genreHrefForLabel("Songs"), "/genres/song")
  assert.equal(genreHrefForLabel("Piano"), "/genres/keyboard")
  assert.equal(genreHrefForLabel("Harpsichord"), "/genres/keyboard")
  assert.equal(genreHrefForLabel("Organ"), "/genres/keyboard")
  assert.equal(genreHrefForLabel("Pianoforte"), "/genres/keyboard")
  assert.equal(genreHrefForLabel("Cembalo"), "/genres/keyboard")
  assert.equal(genreHrefForLabel("Orgue"), "/genres/keyboard")
})

test("folded forms become chips on one genre page", () => {
  assert.deepEqual(formsForBrowseSlug("chamber"), [
    "trio",
    "quartet",
    "quintet",
    "sextet",
    "septet",
    "octet",
    "nonet",
    "duo",
    "suite",
    "partita",
    "serenade",
    "divertimento",
    "overture",
  ])
  assert.deepEqual(formsForBrowseSlug("choral"), [
    "requiem",
    "mass",
    "oratorio",
    "motet",
    "cantata",
    "passion",
    "stabat-mater",
    "magnificat",
    "te-deum",
  ])
  assert.deepEqual(formsForBrowseSlug("keyboard"), [
    ...KEYBOARD_FORMS.flatMap((slug) => (slug === "partita" ? [slug, "suite"] : [slug])),
    "overture",
    "trio",
  ])
  assert.deepEqual(formsForBrowseSlug("piano"), [])
  assert.deepEqual(formsForBrowseSlug("harpsichord"), [])
  assert.deepEqual(formsForBrowseSlug("organ"), [])
  assert.deepEqual(formsForBrowseSlug("baroque-keyboard"), [])
  assert.deepEqual(formsForBrowseSlug("stage"), ["opera", "ballet", "overture"])
  assert.deepEqual(formsForBrowseSlug("orchestral"), [
    "symphony",
    "symphonic-poem",
    "suite",
    "overture",
    "serenade",
    "divertimento",
    "variations",
    "prelude",
    "rhapsody",
    "waltz",
    "mazurka",
    "polonaise",
  ])
  assert.equal(formsForBrowseSlug("orchestral").includes("overture"), true)
  assert.deepEqual(formsForBrowseSlug("concerto"), ["concerto"])
  assert.deepEqual(formsForBrowseSlug("sonata"), ["sonata"])
  assert.deepEqual(formsForBrowseSlug("song"), ["song"])
  assert.deepEqual(formsForBrowseSlug("quartet"), [])
  assert.deepEqual(formsForBrowseSlug("symphony"), [])
  assert.deepEqual(formsForBrowseSlug("mass"), [])
  assert.equal(catalogGenreFromSlug("chamber")?.name, "Chamber")
  assert.equal(catalogGenreFromSlug("keyboard")?.name, "Keyboard")
  assert.equal(catalogGenreFromSlug("piano"), undefined)
  assert.equal(catalogGenreFromSlug("harpsichord"), undefined)
  assert.equal(catalogGenreFromSlug("organ"), undefined)
  assert.equal(catalogGenreFromSlug("stage")?.name, "Stage")
  assert.equal(catalogGenreFromSlug("orchestral")?.name, "Orchestral")
  assert.equal(catalogGenreFromSlug("baroque-keyboard"), undefined)
  assert.equal(catalogGenreFromSlug("quartet"), undefined)
  assert.equal(catalogGenreFromSlug("symphony"), undefined)
  assert.equal(catalogGenreFromSlug("opera"), undefined)
  assert.equal(catalogGenreFromSlug("prelude"), undefined)
  assert.equal(relocatedGenreHref("quartet"), "/genres/chamber?filter=quartet")
  assert.equal(relocatedGenreHref("trio"), "/genres/chamber?filter=trio")
  assert.equal(relocatedGenreHref("sextet"), "/genres/chamber?filter=sextet")
  assert.equal(relocatedGenreHref("mass"), "/genres/choral?filter=mass")
  assert.equal(relocatedGenreHref("oratorio"), "/genres/choral?filter=oratorio")
  assert.equal(relocatedGenreHref("nocturne"), "/genres/keyboard?filter=nocturne")
  assert.equal(relocatedGenreHref("scherzo"), "/genres/keyboard?filter=scherzo")
  assert.equal(relocatedGenreHref("etude"), "/genres/keyboard?filter=etude")
  assert.equal(legacyBaroqueKeyboardHref(), "/genres/keyboard")
  assert.equal(legacyBaroqueKeyboardHref("prelude"), "/genres/keyboard?filter=prelude")
  assert.equal(legacyBaroqueKeyboardHref("not a chip"), "/genres/keyboard")
  assert.equal(legacyBaroqueKeyboardHref("piano"), "/genres/keyboard")
  assert.equal(legacyKeyboardInstrumentHref("piano"), "/genres/keyboard")
  assert.equal(legacyKeyboardInstrumentHref("piano", "nocturne"), "/genres/keyboard?filter=nocturne")
  assert.equal(legacyKeyboardInstrumentHref("piano", "not-a-chip"), "/genres/keyboard")
  assert.equal(legacyKeyboardInstrumentHref("harpsichord"), "/genres/keyboard")
  assert.equal(legacyKeyboardInstrumentHref("organ", "organ"), "/genres/keyboard")
  assert.equal(legacyKeyboardInstrumentHref("pianoforte"), "/genres/keyboard")
  assert.equal(legacyKeyboardInstrumentHref("fortepiano", "prelude"), "/genres/keyboard?filter=prelude")
  assert.equal(legacyKeyboardInstrumentHref("cembalo"), "/genres/keyboard")
  assert.equal(legacyKeyboardInstrumentHref("clavecin", "harpsichord"), "/genres/keyboard")
  assert.equal(legacyKeyboardInstrumentHref("orgue"), "/genres/keyboard")
  assert.equal(legacyKeyboardInstrumentHref("violin"), null)
  assert.equal(relocatedGenreHref("opera"), "/genres/stage?filter=opera")
  assert.equal(relocatedGenreHref("overture"), "/genres/stage?filter=overture")
  assert.equal(relocatedGenreHref("symphony"), "/genres/orchestral?filter=symphony")
  assert.equal(relocatedGenreHref("divertimento"), "/genres/orchestral?filter=divertimento")
  assert.equal(relocatedGenreHref("prelude"), "/genres/keyboard?filter=prelude")
  assert.equal(relocatedGenreHref("variations"), "/genres/keyboard?filter=variations")
  assert.equal(relocatedGenreHref("concerto"), null)
  assert.equal(relocatedGenreHref("sonata"), null)
  assert.equal(relocatedGenreHref("song"), null)
  assert.equal(genreHrefForLabel("Quartets"), "/genres/chamber?filter=quartet")
  assert.equal(genreHrefForLabel("Requiems"), "/genres/choral?filter=requiem")
  assert.equal(genreHrefForLabel("Motets"), "/genres/choral?filter=motet")
  assert.equal(genreHrefForLabel("Cantatas"), "/genres/choral?filter=cantata")
  const legacyParent: Record<string, string> = {
    suite: "orchestral",
    partita: "keyboard",
    overture: "stage",
    serenade: "orchestral",
    divertimento: "orchestral",
    variations: "keyboard",
    prelude: "keyboard",
    rhapsody: "keyboard",
    waltz: "keyboard",
    mazurka: "keyboard",
    trio: "chamber",
  }
  for (const group of FORM_GROUPS) {
    assert.equal(["piano", "harpsichord", "organ"].includes(group.slug), false, group.slug)
    for (const child of group.children) {
      assert.ok(formFromSlug(child), child)
      const parent = groupForForm(child)
      assert.ok(parent, child)
      if (legacyParent[child]) assert.equal(parent.slug, legacyParent[child], child)
    }
  }
  for (const form of KEYBOARD_FORMS) {
    assert.equal(KEYBOARD_INSTRUMENTS.some((item) => item.slug === form), false, form)
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
  assert.equal(classifyWork("Octet, for horn, piano, and string sextet"), "octet")
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

test("Open Opus genre chooses the page and the title chooses the chip", () => {
  const place = (title: string, subtitle: string, genre: string) => {
    const form = classifyWork(title, subtitle, genre)
    return { form, page: form ? browsePageForForm(form, genre) : null }
  }

  const partita = place("Partita no. 2 for Solo Violin in D minor, BWV.1004", "", "Chamber")
  assert.equal(partita.form, "partita")
  assert.equal(partita.page, "chamber")

  const cello = place("Cello Suite no. 1 in G major, BWV.1007", "", "Chamber")
  assert.equal(cello.form, "suite")
  assert.equal(cello.page, "chamber")

  const french = place("French Suite no. 1 in D minor, BWV.812", "", "Keyboard")
  assert.equal(french.form, "suite")
  assert.equal(french.page, "keyboard")

  const orchestralSuite = place("Carmen, suite for orchestra from the opera", "", "Orchestral")
  assert.equal(orchestralSuite.form, "suite")
  assert.equal(orchestralSuite.page, "orchestral")

  const enigma = place("Enigma Variations, op. 36", "", "Orchestral")
  assert.equal(enigma.form, "variations")
  assert.equal(enigma.page, "orchestral")

  const faune = place("Prélude à l'après-midi d'un faune, L.86", "", "Orchestral")
  assert.equal(faune.form, "prelude")
  assert.equal(faune.page, "orchestral")

  const blue = place("Rhapsody in Blue", "For piano and orchestra", "Orchestral")
  assert.equal(blue.form, "rhapsody")
  assert.equal(blue.page, "orchestral")

  const paganini = place("Rhapsody on a Theme by Paganini, op. 43", "", "Orchestral")
  assert.equal(paganini.form, "rhapsody")
  assert.equal(paganini.page, "orchestral")

  const keyboardVariation = place("Goldberg Variations, BWV.988", "", "Keyboard")
  assert.equal(keyboardVariation.page, "keyboard")

  const waltz = place("The Blue Danube, waltz, op. 314", "", "Orchestral")
  assert.equal(waltz.form, "waltz")
  assert.equal(waltz.page, "orchestral")

  const passion = place("Passion According to St. Matthew, BWV.244", "", "Vocal")
  assert.equal(passion.form, "passion")
  assert.equal(passion.page, "choral")
  assert.equal(place("St. Matthew Passion", "", "Vocal").form, "passion")
  assert.equal(place("Matthäus-Passion", "", "Vocal").form, "passion")
  assert.equal(place("Johannes-Passion", "", "Vocal").form, "passion")
  assert.equal(place("Wild with passion, song for high voice and piano", "", "Vocal").form, null)
  assert.equal(place("If my complaints could passions move", "", "Vocal").form, null)
  assert.equal(
    place("Fürwahr, er trug unsere Krankheit, Passion cantata, BuxWV.31", "", "Vocal").form,
    "cantata"
  )

  const zarathustra = place("Also sprach Zarathustra, op. 30", "Tondichtung", "Orchestral")
  assert.equal(zarathustra.form, "symphonic-poem")
  assert.equal(zarathustra.page, "orchestral")
  assert.equal(place("Also sprach Zarathustra, tone poem, op. 30", "", "Orchestral").form, "symphonic-poem")
  assert.equal(place("Les Préludes, symphonic poem", "", "Orchestral").form, "symphonic-poem")
  assert.equal(place("Poème symphonique", "", "Orchestral").form, "symphonic-poem")
  assert.equal(classifyWork("Also sprach Zarathustra, op. 30", "", "Orchestral"), null)

  const octet = place("String Octet in E flat major, op. 20", "", "Chamber")
  assert.equal(octet.form, "octet")
  assert.equal(octet.page, "chamber")
  assert.equal(place("Septet in E flat major, op. 20", "", "Chamber").form, "septet")
  assert.equal(place("Nonet in F major, op. 31", "", "Chamber").form, "nonet")
  assert.equal(place("Duo for 2 violins", "", "Chamber").page, "chamber")
  assert.equal(place("Ariettas and a Duet, op. 82", "", "Vocal").page, null)
  assert.equal(place("Duets, op. 20", "Songs", "Vocal").form, "song")
  assert.equal(place("Duets, op. 20", "Songs", "Vocal").page, "song")
  assert.equal(place("Duo Concertante, for violin and piano", "", "Chamber").form, "concerto")
  assert.equal(place("Duo Sonata, for violin and piano", "", "Chamber").form, "sonata")
  assert.equal(place("8 Magnificat Fugues in the Fourth Tone", "", "Keyboard").form, "fugue")
  assert.equal(place("Trio Sonata no. 1 in E flat major, BWV.525", "", "Keyboard").page, "keyboard")
  assert.equal(place("Trio Sonata in C major", "", "Chamber").page, "chamber")

  const festival = place("1812 Festival Overture, in E flat major, op. 49", "", "Orchestral")
  assert.equal(festival.form, "overture")
  assert.equal(festival.page, "orchestral")
  const tragic = place("Tragic Overture, op. 81", "", "Orchestral")
  assert.equal(tragic.page, "orchestral")
  const operaOverture = place("Overture to La gazza ladra", "", "Stage")
  assert.equal(operaOverture.form, "overture")
  assert.equal(operaOverture.page, "stage")

  assert.equal(place("Stabat Mater, op. 58", "", "Vocal").form, "stabat-mater")
  assert.equal(place("Stabat Mater, op. 58", "", "Vocal").page, "choral")
  assert.equal(place("Magnificat in D major, BWV.243", "", "Vocal").page, "choral")
  assert.equal(place("Te Deum, op. 22", "", "Vocal").form, "te-deum")
  assert.equal(place("Magnificat primi toni", "", "Keyboard").page, null)

  assert.equal(place("Piano Concerto no. 5", "", "Keyboard").page, "concerto")
  assert.equal(place("Piano Sonata no. 14", "", "Orchestral").page, "sonata")
  assert.equal(place("Symphony no. 5", "", "Chamber").page, null)
  assert.equal(place("Messiah", "Oratorio", "Stage").page, "choral")
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

test("the catalog files trio sonatas under trios and keeps Keyboard as one genre", () => {
  const epochs = composerEpochs as Record<string, string>
  const works = catalog.works
  const sonatas = works.filter((work) => work.form === "sonata")
  assert.equal(
    sonatas.some((work) => /trio sonata|sonata en trio|sonata a\s*3/i.test(`${work.title} ${work.subtitle}`)),
    false
  )
  assert.ok(works.some((work) => work.form === "trio" && /trio sonata/i.test(work.title)))
  assert.equal(catalogGenreFromSlug("keyboard")?.name, "Keyboard")
  assert.equal(catalogGenreFromSlug("baroque-keyboard"), undefined)
  assert.equal(FORM_GROUPS.some((group) => group.slug === "baroque-keyboard"), false)
  assert.equal(
    FORM_GROUPS.some((group) => group.slug === "piano" || group.slug === "harpsichord" || group.slug === "organ"),
    false
  )
  assert.equal(FORM_GROUPS.filter((group) => group.slug === "keyboard").length, 1)
  assert.equal(
    WORK_FORMS.some((form) => form.slug === "piano" || form.slug === "harpsichord" || form.slug === "organ"),
    false
  )
  for (const slug of ["keyboard", "chamber"]) {
    assert.ok(catalogGenreFromSlug(slug), slug)
  }
  for (const form of [...CHARACTER_PIECES, ...BAROQUE_KEYBOARD_FORMS]) {
    assert.equal(groupForForm(form)?.slug, "keyboard", form)
  }

  const counts = { piano: 0, harpsichord: 0, organ: 0 }
  for (const work of works) {
    if (browsePageForForm(work.form, work.genre) !== "keyboard") continue
    const instrument = classifyKeyboardInstrument(work.title, work.subtitle, epochs[work.composerId] ?? null)
    counts[instrument] += 1
    if (instrument === "organ") {
      assert.match(`${work.title} ${work.subtitle}`, /\borg(?:ans?|ues?)\b/i)
    }
  }
  assert.ok(counts.piano > counts.harpsichord)
  assert.ok(counts.harpsichord >= 8)
  assert.ok(counts.organ >= 8)
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
