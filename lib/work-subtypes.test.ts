import assert from "node:assert/strict"
import { test } from "node:test"
import catalog from "../data/form-works.json" with { type: "json" }
import { KEYBOARD_FORMS } from "./forms.ts"
import {
  classifyListedSubtype,
  classifyWorkSubtype,
  filterWorksByListedFilter,
  filterWorksBySubtype,
  listedSubtypeFilters,
  subtypeFilters,
} from "./work-subtypes.ts"

const works = catalog.works

function ofForm(form: string) {
  return works.filter((work) => work.form === form)
}

test("concertos use the solo instrument named in the Open Opus title", () => {
  assert.equal(classifyWorkSubtype({ form: "concerto", title: "Piano Concerto no. 5 in E flat major, op. 73" })?.slug, "piano")
  assert.equal(classifyWorkSubtype({ form: "concerto", title: "Violin Concerto in D major, op. 61" })?.slug, "violin")
  assert.equal(classifyWorkSubtype({ form: "concerto", title: "Cello Concerto in B minor, op. 104" })?.slug, "cello")
  assert.equal(classifyWorkSubtype({ form: "concerto", title: "Double Violin Concerto in A minor, RV.522" })?.slug, "violin")
  assert.equal(classifyWorkSubtype({ form: "concerto", title: "Double Bass Concerto in E flat major" })?.slug, "double-bass")
  assert.equal(classifyWorkSubtype({ form: "concerto", title: "Oboe d'amore Concerto in A major, BWV.1055R" })?.slug, "oboe")
  assert.equal(
    classifyWorkSubtype({ form: "concerto", title: "Keyboard Concerto in D minor, BWV.1052", epoch: "Baroque" })?.slug,
    "harpsichord"
  )
  assert.equal(
    classifyWorkSubtype({ form: "concerto", title: "Keyboard Concerto in D major, Hob.XVIII:11", epoch: "Classical" })?.slug,
    "piano"
  )
  assert.equal(
    classifyWorkSubtype({ form: "concerto", title: "Concerto for organ in B flat major", epoch: "Baroque" })?.slug,
    "organ"
  )
  assert.equal(classifyWorkSubtype({ form: "concerto", title: "Concerto Grosso in G minor, op. 6, no. 8" })?.slug, "grosso")
  assert.equal(
    classifyWorkSubtype({
      form: "concerto",
      title: "Concerto a cinque for Oboe, 2 Violins, Viola, Cello, and Continuo in D minor, op. 9, no. 2",
    })?.slug,
    "oboe"
  )
  assert.equal(
    classifyWorkSubtype({
      form: "concerto",
      title: "12 Concerti a cinque for Solo Violin, 2 Violins, Viola, Cello, and Continuo in A major, op. 10, no. 5",
    })?.slug,
    "violin"
  )
  assert.equal(
    classifyWorkSubtype({
      form: "concerto",
      title: "Concerto in D minor for Violin, Strings and Continuo, BWV.1052R",
    })?.slug,
    "violin"
  )
})

test("several soloists, including a subtitle for-line, are multiple", () => {
  assert.equal(
    classifyWorkSubtype({
      form: "concerto",
      title: "Sinfonia concertante in E flat major, K.364",
      subtitle: "For violin, viola and orchestra",
    })?.slug,
    "multiple"
  )
  assert.equal(
    classifyWorkSubtype({
      form: "concerto",
      title: "Triple Concerto in C major, op. 56",
      subtitle: "For violin, cello, piano and orchestra",
    })?.slug,
    "multiple"
  )
  assert.equal(
    classifyWorkSubtype({
      form: "concerto",
      title: "Double Concerto in A minor, op. 102",
      subtitle: "For violin, cello and orchestra",
    })?.slug,
    "multiple"
  )
  assert.equal(
    classifyWorkSubtype({
      form: "concerto",
      title: "Concerto for 2 Violins, Viola, Cello, and Continuo in G major",
    })?.slug,
    "string"
  )
})

test("sonatas use the title instrument, and unlabeled keyboard sonatas use the composer's era", () => {
  assert.equal(
    classifyWorkSubtype({ form: "sonata", title: "Piano Sonata no. 14 in C sharp minor, op. 27 no. 2", genre: "Keyboard" })?.slug,
    "piano"
  )
  assert.equal(classifyWorkSubtype({ form: "sonata", title: "Sonata for violin and piano" })?.slug, "violin")
  assert.equal(classifyWorkSubtype({ form: "sonata", title: "Sonata no. 1 for Solo Violin in G minor, BWV.1001" })?.slug, "violin")
  assert.equal(classifyWorkSubtype({ form: "sonata", title: "Trio Sonata in C major" })?.slug, "trio")
  assert.equal(
    classifyWorkSubtype({ form: "sonata", title: "Sonata in A major, K.322", genre: "Keyboard", epoch: "Baroque" })?.slug,
    "harpsichord"
  )
  assert.equal(
    classifyWorkSubtype({ form: "sonata", title: "Sonata for clavier in D", genre: "Keyboard", epoch: "Baroque" })?.slug,
    "harpsichord"
  )
  assert.equal(
    classifyWorkSubtype({ form: "sonata", title: "Sonata in C major", genre: "Keyboard", epoch: "Classical" })?.slug,
    "piano"
  )
  assert.equal(
    classifyWorkSubtype({ form: "sonata", title: "Sonata for organ in D minor", genre: "Keyboard", epoch: "Baroque" })?.slug,
    "organ"
  )
  assert.equal(classifyWorkSubtype({ form: "sonata", title: "Sonata in G", genre: "Keyboard" })?.slug, "piano")
  assert.equal(classifyWorkSubtype({ form: "sonata", title: "Sonata in G", genre: "Chamber" }), null)
})

test("quartets, quintets, and trios use the ensemble named on the work", () => {
  assert.equal(classifyWorkSubtype({ form: "quartet", title: "String Quartet no. 14 in C sharp minor, op. 131" })?.slug, "string")
  assert.equal(classifyWorkSubtype({ form: "quartet", title: "Piano Quartet no. 1 in G minor, K.478" })?.slug, "piano")
  assert.equal(
    classifyWorkSubtype({
      form: "quartet",
      title: "Quartet in G major, for flute, violin, viola, and cello",
    })?.slug,
    "flute"
  )
  assert.equal(classifyWorkSubtype({ form: "quintet", title: "Clarinet Quintet in A major, K.581" })?.slug, "clarinet")
  assert.equal(classifyWorkSubtype({ form: "quintet", title: "Wind Quintet, op. 43" })?.slug, "wind")
  assert.equal(
    classifyWorkSubtype({
      form: "quintet",
      title: "Quintet for flute, oboe, clarinet, horn and bassoon",
    })?.slug,
    "wind"
  )
  assert.equal(classifyWorkSubtype({ form: "trio", title: "Piano Trio no. 7 in B flat major, op. 97" })?.slug, "piano")
  assert.equal(classifyWorkSubtype({ form: "trio", title: "String Trio in E flat major, op. 3" })?.slug, "string")
})

test("a form with no instrument or ensemble split has no selector", () => {
  assert.equal(classifyWorkSubtype({ form: "symphony", title: "Symphony no. 5 in C minor, op. 67" }), null)
  assert.equal(classifyWorkSubtype({ form: "opera", title: "Carmen", subtitle: "Opera" }), null)
  assert.equal(classifyWorkSubtype({ form: "suite", title: "Cello Suite no. 1 in G major, BWV.1007" })?.slug, "cello")
  for (const form of ["symphony", "opera", "mass", "song", "etude", "prelude", "nocturne", "partita"]) {
    assert.equal(subtypeFilters(ofForm(form)).length, 0, form)
  }
})

test("catalog forms that name instruments expose those chips", () => {
  const concertos = subtypeFilters(ofForm("concerto")).map((item) => item.slug)
  for (const slug of ["piano", "violin", "cello", "flute", "oboe", "grosso", "multiple"]) {
    assert.ok(concertos.includes(slug), slug)
  }
  const sonatas = subtypeFilters(ofForm("sonata")).map((item) => item.slug)
  for (const slug of ["piano", "violin", "cello", "harpsichord"]) assert.ok(sonatas.includes(slug), slug)
  assert.equal(sonatas.includes("keyboard"), false)
  assert.equal(sonatas.includes("trio"), false)
  assert.equal(concertos.includes("keyboard"), false)
  for (const form of ["concerto", "sonata", "quartet", "quintet", "trio", "suite"]) {
    assert.equal(
      subtypeFilters(ofForm(form)).some((item) => item.label === "Keyboard" || item.slug === "keyboard"),
      false,
      form
    )
  }
  assert.ok(subtypeFilters(ofForm("quartet")).some((item) => item.slug === "string"))
  assert.ok(subtypeFilters(ofForm("quintet")).some((item) => item.slug === "wind"))
  assert.ok(subtypeFilters(ofForm("trio")).some((item) => item.slug === "piano"))
  assert.ok(subtypeFilters(ofForm("suite")).some((item) => item.slug === "cello"))
  const sonataChips = listedSubtypeFilters(ofForm("sonata")).map((item) => item.slug)
  assert.ok(sonataChips.includes("piano"))
  assert.ok(sonataChips.includes("harpsichord"))
  assert.equal(sonataChips.includes("nocturne"), false)
  assert.equal(sonataChips.includes("keyboard"), false)
})

test("grouped genres list form chips in catalog order", () => {
  const chips = (forms: string[]) =>
    listedSubtypeFilters(works.filter((work) => forms.includes(work.form))).map((item) => item.slug)
  assert.deepEqual(chips(["trio", "quartet", "quintet", "sextet"]), ["trio", "quartet", "quintet", "sextet"])
  assert.deepEqual(chips(["requiem", "mass", "oratorio", "motet", "cantata"]), [
    "requiem",
    "mass",
    "oratorio",
    "motet",
    "cantata",
  ])
  assert.deepEqual(chips([...CHARACTER_PIECE_SLUGS]), [...CHARACTER_PIECE_SLUGS])
  assert.deepEqual(chips(["opera", "ballet", "overture"]), ["opera", "ballet", "overture"])
  assert.deepEqual(chips(["symphony", "suite", "serenade", "divertimento"]), [
    "symphony",
    "suite",
    "serenade",
    "divertimento",
  ])
  assert.deepEqual(chips(["prelude", "fugue", "toccata", "partita", "fantasia", "variations"]), [
    "prelude",
    "fugue",
    "toccata",
    "partita",
    "fantasia",
    "variations",
  ])
  assert.deepEqual(chips([...KEYBOARD_FORMS]), [...KEYBOARD_FORMS])
  for (const slug of ["piano", "harpsichord", "organ"]) {
    assert.equal(chips([...KEYBOARD_FORMS]).includes(slug), false, slug)
  }
  assert.equal(
    classifyListedSubtype({ form: "quartet", title: "String Quartet no. 14 in C sharp minor, op. 131" })?.slug,
    "quartet"
  )
  assert.equal(
    classifyListedSubtype({ form: "mass", title: "Missa solemnis in D major, op. 123" })?.slug,
    "mass"
  )
  assert.equal(
    classifyListedSubtype({ form: "concerto", title: "Piano Concerto no. 5 in E flat major, op. 73" })?.slug,
    "piano"
  )
})

const CHARACTER_PIECE_SLUGS = [
  "nocturne",
  "etude",
  "mazurka",
  "waltz",
  "polonaise",
  "impromptu",
  "ballade",
  "rhapsody",
  "scherzo",
]

test("keyboard listing filters by form chip", () => {
  const rows = [
    { id: "nocturne", subtype: "nocturne" },
    { id: "prelude", subtype: "prelude" },
    { id: "fugue", subtype: "fugue" },
  ]
  assert.deepEqual(
    filterWorksByListedFilter(rows, "piano").map((work) => work.id),
    []
  )
  assert.deepEqual(
    filterWorksByListedFilter(rows, "harpsichord").map((work) => work.id),
    []
  )
  assert.deepEqual(
    filterWorksByListedFilter(rows, "organ").map((work) => work.id),
    []
  )
  assert.deepEqual(
    filterWorksByListedFilter(rows, "prelude").map((work) => work.id),
    ["prelude"]
  )
  assert.deepEqual(
    filterWorksByListedFilter(rows, "all").map((work) => work.id),
    ["nocturne", "prelude", "fugue"]
  )
})

test("known keyboard works land on form chips", () => {
  const keyboard = works.filter((work) => (KEYBOARD_FORMS as readonly string[]).includes(work.form))
  const chips = new Set(listedSubtypeFilters(keyboard).map((item) => item.slug))
  for (const slug of ["piano", "harpsichord", "organ"]) assert.equal(chips.has(slug), false, slug)
  for (const form of KEYBOARD_FORMS) assert.equal(chips.has(form), true, form)

  const find = (composer: string, title: string) =>
    works.find((work) => work.composerName.includes(composer) && work.title === title)

  const nocturnes = find("Chopin", "Nocturnes, op. 9")
  assert.equal(nocturnes?.genre, "Keyboard")
  assert.equal(classifyListedSubtype(nocturnes!)?.slug, "nocturne")
  assert.equal(chips.has("nocturne"), true)

  const chopinSonata = find("Chopin", "Sonata no. 2 in B flat minor, op. 35")
  assert.equal(chopinSonata?.genre, "Keyboard")
  assert.equal(chopinSonata?.form, "sonata")
  assert.equal(classifyListedSubtype(chopinSonata!)?.slug, "piano")

  const prelude = find("Johann Sebastian Bach", "Prélude no. 2 en Do Mineur, BWV.871")
  const fugue = find("Johann Sebastian Bach", "Fugue no. 2 en Do Mineur, BWV.871")
  assert.equal(classifyListedSubtype(prelude!)?.slug, "prelude")
  assert.equal(classifyListedSubtype(fugue!)?.slug, "fugue")

  const toccata = find("Johann Sebastian Bach", "Toccata and fugue in D minor, BWV.565")
  const passacaglia = find("Johann Sebastian Bach", "Passacaglia and Fugue in C minor, BWV.582")
  const organPrelude = find("Johann Sebastian Bach", 'Prelude in C major, BWV.567, "Per Organo pleno"')
  assert.equal(toccata?.genre, "Keyboard")
  assert.equal(classifyListedSubtype(toccata!)?.slug, "fugue")
  assert.equal(classifyListedSubtype(passacaglia!)?.slug, "fugue")
  assert.equal(classifyListedSubtype(organPrelude!)?.slug, "prelude")
  for (const work of [toccata, passacaglia, organPrelude, prelude, fugue, nocturnes]) {
    assert.equal(chips.has(classifyListedSubtype(work!)!.slug), true, work?.title)
  }
})

test("filtering keeps the surrounding list order", () => {
  const rows = [
    { id: "later", subtype: "piano" },
    { id: "violin", subtype: "violin" },
    { id: "earlier-title", subtype: "piano" },
  ]
  assert.deepEqual(
    filterWorksBySubtype(rows, "piano").map((work) => work.id),
    ["later", "earlier-title"]
  )
  assert.equal(filterWorksBySubtype(rows, "all"), rows)
})
