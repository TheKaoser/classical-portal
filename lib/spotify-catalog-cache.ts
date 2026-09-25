import { createHash } from "node:crypto"
import { revalidateTag, unstable_cache } from "next/cache"
import {
  readSpotifyMemory,
  writeSpotifyMemory,
  SPOTIFY_NEGATIVE_TTL_MS,
  SPOTIFY_POSITIVE_REVALIDATE_SECONDS,
} from "@/lib/spotify-memory-cache"
import {
  isSpotifyQuotaSignal,
  isSpotifyQuotaUnset,
  SpotifyQuotaSignal,
  SpotifyQuotaUnset,
  spotifyCallsBlocked,
  tripSpotifyQuota,
} from "@/lib/spotify-quota"

type Stored<T> = {
  value: T
  negative: boolean
  storedAt: number
}

type LoadResult<T> = { value: T; negative: boolean } | "quota"

const inflight = new Map<string, Promise<unknown>>()

type QuotaSlot = { value: number }

function quotaSlot(): QuotaSlot {
  const g = globalThis as typeof globalThis & { __classicalPortalSpotifyQuotaSlot?: QuotaSlot }
  if (!g.__classicalPortalSpotifyQuotaSlot) g.__classicalPortalSpotifyQuotaSlot = { value: 0 }
  return g.__classicalPortalSpotifyQuotaSlot
}

let lastQuotaSync = 0

function cacheHash(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}

function missingIncrementalCache(error: unknown): boolean {
  return error instanceof Error && error.message.includes("incrementalCache missing")
}

function missingRevalidateStore(error: unknown): boolean {
  return error instanceof Error && error.message.includes("static generation store missing")
}

/**
 * Shared quota timestamp. The callback throws when this isolate has nothing to
 * publish, so a cold reader cannot cache "0" over a real window.
 * Hits return the stored timestamp without running the callback.
 */
async function readQuotaSlotForCache(): Promise<number> {
  const until = quotaSlot().value
  if (until <= Date.now()) throw new SpotifyQuotaUnset()
  return until
}

const quotaCache = () =>
  unstable_cache(readQuotaSlotForCache, ["spotify-quota-open-until-v1"], {
    revalidate: 60 * 60 * 24,
    tags: ["spotify-quota"],
  })()

export async function publishSharedSpotifyQuota(openUntil: number): Promise<void> {
  if (openUntil > quotaSlot().value) quotaSlot().value = openUntil
  try {
    await quotaCache()
  } catch (error) {
    if (isSpotifyQuotaUnset(error) || missingIncrementalCache(error)) return
    console.error("Spotify quota marker was not stored", error)
  }
}

export async function readSharedSpotifyQuota(): Promise<number> {
  try {
    const until = await quotaCache()
    if (typeof until === "number" && until > quotaSlot().value) quotaSlot().value = until
    return typeof until === "number" ? until : 0
  } catch (error) {
    if (isSpotifyQuotaUnset(error) || isSpotifyQuotaSignal(error) || missingIncrementalCache(error)) return 0
    return 0
  }
}

/** Pull a breaker opened on another isolate. At most once every 30 seconds. */
export async function syncSharedSpotifyQuota(now = Date.now()): Promise<void> {
  if (now - lastQuotaSync < 30_000) return
  lastQuotaSync = now
  const until = await readSharedSpotifyQuota()
  if (until > now) tripSpotifyQuota(until, now)
}

/**
 * Memory first, then the Next.js data cache (14 days).
 * Empty results are refreshed after the negative TTL instead of sticking for the full window.
 * Quota errors are not stored.
 */
export async function readThroughSpotifyCache<T>(
  key: string,
  load: () => Promise<LoadResult<T>>
): Promise<T | "quota"> {
  const now = Date.now()
  const remembered = readSpotifyMemory<T>(key, now)
  if (remembered) return remembered.value

  const pending = inflight.get(key) as Promise<T | "quota"> | undefined
  if (pending) return pending

  const run = loadThrough<T>(key, load)
  inflight.set(key, run)
  try {
    return await run
  } finally {
    inflight.delete(key)
  }
}

async function loadThrough<T>(key: string, load: () => Promise<LoadResult<T>>): Promise<T | "quota"> {
  const hash = cacheHash(key)
  const tag = `spotify-cat-${hash.slice(0, 32)}`
  const read = () =>
    unstable_cache(
      async (): Promise<Stored<T>> => {
        const loaded = await load()
        if (loaded === "quota") throw new SpotifyQuotaSignal()
        return { value: loaded.value, negative: loaded.negative, storedAt: Date.now() }
      },
      ["spotify-catalog-v1", hash],
      { revalidate: SPOTIFY_POSITIVE_REVALIDATE_SECONDS, tags: [tag, "spotify-catalog"] }
    )()

  try {
    const entry = await read()
    const now = Date.now()
    if (entry?.negative && now - entry.storedAt >= SPOTIFY_NEGATIVE_TTL_MS) {
      return refreshStaleNegative(key, entry, load)
    }
    if (entry && "value" in entry) {
      writeSpotifyMemory(key, entry.value, entry.negative, entry.storedAt, now)
      return entry.value
    }
  } catch (error) {
    if (isSpotifyQuotaSignal(error)) return "quota"
    if (!missingIncrementalCache(error)) throw error
  }

  return loadDirect(key, load)
}

async function refreshStaleNegative<T>(
  key: string,
  stale: Stored<T>,
  load: () => Promise<LoadResult<T>>
): Promise<T | "quota"> {
  // An empty search can be shown as-is. Refresh it once, after this request,
  // instead of calling Spotify both here and on the cache miss.
  if (spotifyCallsBlocked()) return stale.value

  const tag = `spotify-cat-${cacheHash(key).slice(0, 32)}`
  try {
    revalidateTag(tag)
    return stale.value
  } catch (error) {
    if (!missingRevalidateStore(error)) console.error("Spotify cache revalidate failed", error)
  }

  return loadDirect(key, load)
}

async function loadDirect<T>(key: string, load: () => Promise<LoadResult<T>>): Promise<T | "quota"> {
  const loaded = await load()
  if (loaded === "quota") return "quota"
  const storedAt = Date.now()
  writeSpotifyMemory(key, loaded.value, loaded.negative, storedAt, storedAt)
  return loaded.value
}
