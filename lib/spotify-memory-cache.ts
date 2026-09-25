/** Positive catalog matches. Recordings for a work rarely change. */
export const SPOTIFY_POSITIVE_TTL_MS = 14 * 24 * 60 * 60 * 1000

/** Empty searches. Short enough that a later catalog fix can show up the same day. */
export const SPOTIFY_NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000

export const SPOTIFY_POSITIVE_REVALIDATE_SECONDS = SPOTIFY_POSITIVE_TTL_MS / 1000
export const SPOTIFY_NEGATIVE_REVALIDATE_SECONDS = SPOTIFY_NEGATIVE_TTL_MS / 1000

type Entry<T> = {
  value: T
  negative: boolean
  storedAt: number
  expiresAt: number
}

const memory = new Map<string, Entry<unknown>>()

export function readSpotifyMemory<T>(key: string, now = Date.now()): Entry<T> | null {
  const entry = memory.get(key) as Entry<T> | undefined
  if (!entry) return null
  if (entry.expiresAt <= now) {
    memory.delete(key)
    return null
  }
  return entry
}

export function writeSpotifyMemory<T>(
  key: string,
  value: T,
  negative: boolean,
  storedAt: number,
  now = Date.now()
): void {
  const ttl = negative ? SPOTIFY_NEGATIVE_TTL_MS : SPOTIFY_POSITIVE_TTL_MS
  const expiresAt = Math.min(now + ttl, storedAt + ttl)
  if (expiresAt <= now) return
  memory.set(key, { value, negative, storedAt, expiresAt })
}

export function clearSpotifyMemoryForTests(): void {
  memory.clear()
}
