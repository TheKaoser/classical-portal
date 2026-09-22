import assert from "node:assert/strict"
import { test } from "node:test"
import { iconKey, GENRE_ICONS, PERIOD_ICONS, genreIcon, periodIcon } from "./catalog-icons.ts"
import { EPOCHS } from "./epochs.ts"
import { WORK_FORMS } from "./forms.ts"

test("every period has a unique icon", () => {
  const seen = new Set<string>()
  for (const epoch of EPOCHS) {
    assert.ok(PERIOD_ICONS[epoch.slug], `missing period icon: ${epoch.slug}`)
    const key = iconKey(periodIcon(epoch.slug))
    assert.equal(seen.has(key), false, `duplicate period icon: ${epoch.slug}`)
    seen.add(key)
  }
})

test("every genre form has a unique icon", () => {
  const seen = new Set<string>()
  for (const form of WORK_FORMS) {
    assert.ok(GENRE_ICONS[form.slug], `missing genre icon: ${form.slug}`)
    const key = iconKey(genreIcon(form.slug))
    assert.equal(seen.has(key), false, `duplicate genre icon: ${form.slug}`)
    seen.add(key)
  }
})

test("chamber and choral keep their own icons for an upcoming merge", () => {
  assert.ok(GENRE_ICONS.chamber)
  assert.ok(GENRE_ICONS.choral)
  assert.notEqual(iconKey(GENRE_ICONS.chamber), iconKey(GENRE_ICONS.quartet))
  assert.notEqual(iconKey(GENRE_ICONS.choral), iconKey(GENRE_ICONS.song))
})

test("period icons and genre icons do not share a drawing", () => {
  const periods = new Set(Object.values(PERIOD_ICONS).map(iconKey))
  for (const [slug, marks] of Object.entries(GENRE_ICONS)) {
    assert.equal(periods.has(iconKey(marks)), false, slug)
  }
})

test("an unknown slug falls back to a note icon", () => {
  const fallback = genreIcon("not-a-real-form")
  assert.deepEqual(fallback, periodIcon("not-a-real-period"))
  assert.ok(fallback.length > 0)
  assert.notEqual(iconKey(fallback), iconKey(GENRE_ICONS.symphony))
  assert.equal(
    Object.values(PERIOD_ICONS).some((marks) => iconKey(marks) === iconKey(fallback)),
    false
  )
  assert.equal(
    Object.values(GENRE_ICONS).some((marks) => iconKey(marks) === iconKey(fallback)),
    false
  )
})
