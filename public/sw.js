// Conservative service worker: offline fallback for navigations plus
// cache-first for immutable static assets. HTML, API, RSC and cross-origin
// requests always go straight to the network.
const VERSION = "cp-static-v1"
const OFFLINE_URL = "/offline.html"
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const BYPASS_PREFIXES = ["/api/", "/sitemap", "/robots.txt", "/manifest.webmanifest", "/sw.js"]

function shouldBypass(request, url) {
  if (request.method !== "GET") return true
  if (url.origin !== self.location.origin) return true
  if (request.headers.has("range")) return true
  if (request.headers.has("rsc") || url.searchParams.has("_rsc")) return true
  return BYPASS_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p))
}

// Hashed /_next/static chunks change on every deploy; keep the cache bounded
// so old chunks don't pile up forever. Precached entries are never trimmed.
const MAX_ENTRIES = 300

async function trimCache(cache) {
  const keys = await cache.keys()
  const extra = keys.length - MAX_ENTRIES
  if (extra <= 0) return
  const removable = keys.filter((req) => !PRECACHE.includes(new URL(req.url).pathname))
  await Promise.all(removable.slice(0, extra).map((req) => cache.delete(req)))
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok && response.status === 200) {
    cache.put(request, response.clone()).then(() => trimCache(cache)).catch(() => {})
  }
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION)
  const hit = await cache.match(request)
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok && response.status === 200) cache.put(request, response.clone())
      return response
    })
    .catch(() => undefined)
  return hit || (await refresh) || Response.error()
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (shouldBypass(request, url)) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error())
    )
    return
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (url.pathname.startsWith("/images/")) {
    event.respondWith(staleWhileRevalidate(request))
  }
})
