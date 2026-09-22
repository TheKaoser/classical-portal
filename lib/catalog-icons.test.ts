import assert from "node:assert/strict"
import { test } from "node:test"
import { iconKey, GENRE_ICONS, PERIOD_ICONS, genreIcon, periodIcon } from "./catalog-icons.ts"
import { EPOCHS } from "./epochs.ts"
import { FORM_GROUPS, WORK_FORMS } from "./forms.ts"

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

test("grouped genres keep their own icons, and folded romantic eras are not tiles", () => {
  const seen = new Set<string>()
  for (const group of FORM_GROUPS) {
    assert.ok(GENRE_ICONS[group.slug], `missing group icon: ${group.slug}`)
    const key = iconKey(genreIcon(group.slug))
    assert.equal(seen.has(key), false, `duplicate group icon: ${group.slug}`)
    seen.add(key)
    assert.equal(
      WORK_FORMS.some((form) => iconKey(genreIcon(form.slug)) === key),
      false,
      `group icon matches a form: ${group.slug}`
    )
  }
  assert.ok(PERIOD_ICONS.romantic)
  assert.equal(PERIOD_ICONS["early-romantic"], undefined)
  assert.equal(PERIOD_ICONS["late-romantic"], undefined)
  assert.equal(iconKey(periodIcon("romantic")), iconKey(PERIOD_ICONS.romantic))
  assert.ok(PERIOD_ICONS.modern)
  assert.equal(PERIOD_ICONS["20th-century"], undefined)
  assert.equal(PERIOD_ICONS["post-war"], undefined)
  assert.equal(PERIOD_ICONS["21st-century"], undefined)
  assert.equal(iconKey(periodIcon("modern")), iconKey(PERIOD_ICONS.modern))
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
