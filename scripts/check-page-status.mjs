// Run against a production build or a deployment, never next dev:
// node scripts/check-page-status.mjs http://localhost:3000
import assert from 'node:assert/strict'

const origin = process.argv[2]
if (!origin) throw new Error('Pass the deployment origin')
const cases = [
  ['/composers/999999', 404],
  ['/works/999999', 404],
  ['/composers/not-an-id', 404],
  ['/works/not-an-id', 404],
  ['/composers/87?filter=all', 200],
  ['/composers/219', 200],
  ['/works/1', 200],
  ['/', 200],
]
for (const userAgent of ['Mozilla/5.0', 'Googlebot']) {
  for (const [path, status] of cases) {
    // A repeat proves that a cached response keeps the correct status.
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(new URL(path, origin), {
        headers: { 'User-Agent': userAgent },
        redirect: 'manual',
      })
      assert.equal(response.status, status, `${userAgent} ${path}`)
      const html = await response.text()
      if (status === 404) {
        assert.match(html, /Not found/)
        assert.match(html, /noindex/)
      } else {
        assert.doesNotMatch(html, /NEXT_HTTP_ERROR_FALLBACK;404/)
      }
      const cache = response.headers.get('cache-control') ?? ''
      assert.doesNotMatch(cache, /private|no-store/, `${path}: ${cache}`)
      console.log(userAgent, path, status, response.headers.get('x-vercel-cache') ?? response.headers.get('x-nextjs-cache'), cache)
    }
  }
}
