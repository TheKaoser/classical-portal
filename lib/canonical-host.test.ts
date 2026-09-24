import assert from "node:assert/strict"
import { test } from "node:test"
import { canonicalRedirectTarget, hostnameFromHeader } from "./canonical-host.ts"

test("www and the production vercel host redirect to the apex", () => {
  assert.equal(
    canonicalRedirectTarget("www.classicalportal.app", "/composers/145", "?filter=popular"),
    "https://classicalportal.app/composers/145?filter=popular"
  )
  assert.equal(canonicalRedirectTarget("classical-portal.vercel.app", "/", ""), "https://classicalportal.app/")
  assert.equal(
    canonicalRedirectTarget("WWW.ClassicalPortal.app:443", "/periods/baroque"),
    "https://classicalportal.app/periods/baroque"
  )
})

test("apex, localhost, and preview deployments are not redirected", () => {
  assert.equal(canonicalRedirectTarget("classicalportal.app", "/"), null)
  assert.equal(canonicalRedirectTarget("localhost:3000", "/"), null)
  assert.equal(canonicalRedirectTarget("classical-portal-git-seo-user.vercel.app", "/composers/145"), null)
  assert.equal(canonicalRedirectTarget(null, "/"), null)
})

test("API routes stay on the alias host", () => {
  assert.equal(
    canonicalRedirectTarget("classical-portal.vercel.app", "/api/spotify/callback", "?code=abc"),
    null
  )
  assert.equal(canonicalRedirectTarget("www.classicalportal.app", "/api"), null)
})

test("hostname header parsing", () => {
  assert.equal(hostnameFromHeader("www.classicalportal.app, classical-portal.vercel.app"), "www.classicalportal.app")
  assert.equal(hostnameFromHeader("[::1]:3000"), "::1")
})
