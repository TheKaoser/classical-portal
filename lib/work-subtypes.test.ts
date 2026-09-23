import assert from "node:assert/strict"
import { test } from "node:test"
import catalog from "../data/form-works.json" with { type: "json" }
import {
  classifyListedSubtype,
  classifyWorkSubtype,
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
  assert.equal(classifyWorkSubtype({ form: "concerto", title: "Keyboard Concerto in D minor, BWV.1052" })?.slug, "keyboard")
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

test("sonatas use the title instrument, and unlabeled keyboard sonatas use the Open Opus genre", () => {
  assert.equal(
    classifyWorkSubtype({ form: "sonata", title: "Piano Sonata no. 14 in C sharp minor, op. 27 no. 2", genre: "Keyboard" })?.slug,
    "piano"
  )
  assert.equal(classifyWorkSubtype({ form: "sonata", title: "Sonata for violin and piano" })?.slug, "violin")
  assert.equal(classifyWorkSubtype({ form: "sonata", title: "Sonata no. 1 for Solo Violin in G minor, BWV.1001" })?.slug, "violin")
  assert.equal(classifyWorkSubtype({ form: "sonata", title: "Trio Sonata in C major" })?.slug, "trio")
  assert.equal(
    classifyWorkSubtype({ form: "sonata", title: "Sonata in A major, K.322", genre: "Keyboard" })?.slug,
    "keyboard"
  )
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
  for (const slug of ["piano", "violin", "cello", "keyboard"]) assert.ok(sonatas.includes(slug), slug)
  assert.equal(sonatas.includes("trio"), false)
  assert.ok(subtypeFilters(ofForm("quartet")).some((item) => item.slug === "string"))
  assert.ok(subtypeFilters(ofForm("quintet")).some((item) => item.slug === "wind"))
  assert.ok(subtypeFilters(ofForm("trio")).some((item) => item.slug === "piano"))
  assert.ok(subtypeFilters(ofForm("suite")).some((item) => item.slug === "cello"))
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
  assert.deepEqual(
    chips([
      "nocturne",
      "etude",
      "mazurka",
      "waltz",
      "polonaise",
      "impromptu",
      "ballade",
      "rhapsody",
      "scherzo",
    ]),
    ["nocturne", "etude", "mazurka", "waltz", "polonaise", "impromptu", "ballade", "rhapsody", "scherzo"]
  )
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
