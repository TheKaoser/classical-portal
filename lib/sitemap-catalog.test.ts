import assert from "node:assert/strict"
import { test } from "node:test"
import composerEpochs from "../data/composer-epochs.json" with { type: "json" }
import catalog from "../data/form-works.json" with { type: "json" }
import { EPOCHS } from "./epochs.ts"
import {
  SITEMAP_BYTE_BUDGET,
  SITEMAP_URL_LIMIT,
  catalogSitemapIndexXml,
  catalogSitemapPlan,
  chunkSitemapEntries,
  entryXml,
  indexableGenreSlugs,
  sitemapChunkPath,
  sitemapIndexXml,
  sitemapLastModified,
  sitemapPlanFromWorks,
  urlSetXml,
  type SitemapEntry,
} from "./sitemap-catalog.ts"
import { absoluteUrl } from "./seo.ts"

function sample(loc: string): SitemapEntry {
  return { loc, changeFrequency: "monthly", priority: 0.5 }
}

test("an unusable catalog date is omitted instead of throwing", () => {
  assert.equal(sitemapLastModified(undefined), undefined)
  assert.equal(sitemapLastModified(""), undefined)
  assert.equal(sitemapLastModified("not-a-date"), undefined)
  assert.equal(sitemapLastModified("2026-09-26"), "2026-09-26T00:00:00.000Z")
})

test("urlset escapes reserved characters", () => {
  const xml = urlSetXml([sample("https://example.com/search?a=1&b=2")])
  assert.match(xml, /<loc>https:\/\/example\.com\/search\?a=1&amp;b=2<\/loc>/)
  assert.equal(xml.includes("&b="), false)
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
})

test("chunks respect the url count and the rendered byte budget", () => {
  const entries = Array.from({ length: 10 }, (_, index) => sample(`https://classicalportal.app/works/${index}`))
  const byCount = chunkSitemapEntries(entries, { urlLimit: 3, byteBudget: 1_000_000 })
  assert.deepEqual(
    byCount.map((chunk) => chunk.length),
    [3, 3, 3, 1]
  )

  const byBytes = chunkSitemapEntries(entries, { urlLimit: 50_000, byteBudget: 500 })
  assert.ok(byBytes.length > 1)
  for (const chunk of byBytes) {
    const xml = urlSetXml(chunk)
    assert.ok(chunk.length === 1 || xml.length <= 500, `chunk bytes ${xml.length}`)
  }
})

test("a single entry larger than the budget is still emitted", () => {
  const huge = sample(`https://example.com/${"x".repeat(200)}`)
  const chunks = chunkSitemapEntries([huge], { urlLimit: 10, byteBudget: entryXml(huge).length })
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0]?.length, 1)
})

test("sitemap index lists each chunk url", () => {
  const xml = sitemapIndexXml(
    [absoluteUrl(sitemapChunkPath(0)), absoluteUrl(sitemapChunkPath(1))],
    "2026-09-26T00:00:00.000Z"
  )
  assert.match(xml, /<sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
  assert.match(xml, /<loc>https:\/\/classicalportal\.app\/sitemap\/0\.xml<\/loc>/)
  assert.match(xml, /<loc>https:\/\/classicalportal\.app\/sitemap\/1\.xml<\/loc>/)
  assert.match(xml, /<lastmod>2026-09-26T00:00:00.000Z<\/lastmod>/)
})

test("the local catalog splits into bounded urlsets with no duplicate urls", () => {
  const plan = catalogSitemapPlan()
  const locs = plan.entries.map((entry) => entry.loc)
  assert.equal(new Set(locs).size, locs.length)
  assert.ok(plan.chunks.length >= 1)
  assert.equal(
    plan.chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    plan.entries.length
  )

  for (const chunk of plan.chunks) {
    assert.ok(chunk.length <= SITEMAP_URL_LIMIT)
    assert.ok(urlSetXml(chunk).length <= SITEMAP_BYTE_BUDGET)
  }

  assert.ok(locs.includes(absoluteUrl("/")))
  assert.ok(locs.includes(absoluteUrl("/search")))
  for (const epoch of EPOCHS) assert.ok(locs.includes(absoluteUrl(`/periods/${epoch.slug}`)))

  const genreSlugs = locs
    .filter((loc) => loc.includes("/genres/"))
    .map((loc) => loc.slice(loc.lastIndexOf("/") + 1))
    .sort()
  assert.deepEqual(genreSlugs, indexableGenreSlugs(catalog.works))
  assert.deepEqual(genreSlugs, ["chamber", "choral", "concerto", "keyboard", "orchestral", "sonata", "song", "stage"])

  const composerIds = new Set<string>(Object.keys(composerEpochs))
  const workIds = new Set<string>()
  for (const work of catalog.works) {
    workIds.add(work.id)
    composerIds.add(work.composerId)
  }
  assert.equal(locs.filter((loc) => loc.includes("/works/")).length, workIds.size)
  assert.equal(locs.filter((loc) => /\/composers\/[^/]+$/.test(loc)).length, composerIds.size)

  const index = catalogSitemapIndexXml()
  assert.match(index, /<sitemapindex/)
  assert.equal(index.split("<loc>").length - 1, plan.chunks.length)
  for (let indexNumber = 0; indexNumber < plan.chunks.length; indexNumber += 1) {
    assert.ok(index.includes(absoluteUrl(sitemapChunkPath(indexNumber))))
  }
})

test("a bad generatedAt still builds entries", () => {
  const plan = sitemapPlanFromWorks({
    works: [{ id: "10", composerId: "2", form: "symphony", genre: "Orchestral" }],
    composerIds: ["2"],
    epochSlugs: ["baroque"],
    generatedAt: "nope",
  })
  assert.equal(plan.lastModified, undefined)
  assert.equal(plan.entries[0]?.lastModified, undefined)
  assert.ok(plan.entries.some((entry) => entry.loc.endsWith("/works/10")))
  assert.doesNotThrow(() => urlSetXml(plan.entries))
})
