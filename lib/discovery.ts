import cache from "../data/spotify-popularity.json" with { type: "json" }

/**
 * Works Open Opus ids that already have a Spotify match in
 * `data/spotify-popularity.json`. A score of 0 is a match nobody streams, so
 * the daily pool starts at 1. The same UTC calendar day always maps to the
 * same id for every visitor.
 */
export const DISCOVERY_MIN_SCORE = 1

type PopularityCache = {
  works?: Record<string, number>
}

const cachedWorks = (cache as PopularityCache).works ?? {}

function selectWorkIds(works: Record<string, number>): string[] {
  return Object.entries(works)
    .filter(([, score]) => typeof score === "number" && Number.isFinite(score) && score >= DISCOVERY_MIN_SCORE)
    .map(([id]) => id)
    .sort((a, b) => compareIds(a, b))
}

function compareIds(a: string, b: string): number {
  const aNumber = Number(a)
  const bNumber = Number(b)
  const aNumeric = Number.isFinite(aNumber)
  const bNumeric = Number.isFinite(bNumber)
  if (aNumeric && bNumeric) return aNumber - bNumber || a.localeCompare(b)
  if (aNumeric) return -1
  if (bNumeric) return 1
  return a.localeCompare(b)
}

const matchedWorkIds = selectWorkIds(cachedWorks)

/** Spotify-matched Open Opus work ids, lowest id first. */
export function discoveryWorkIds(works?: Record<string, number>): string[] {
  return works ? selectWorkIds(works) : matchedWorkIds
}

/** UTC calendar day, `YYYY-MM-DD`. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** FNV-1a, unsigned 32-bit, so the day index is stable across runtimes. */
export function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function discoveryWorkId(date: Date, ids: readonly string[] = matchedWorkIds): string | null {
  if (ids.length === 0) return null
  return ids[hashString(utcDayKey(date)) % ids.length] ?? null
}

export function discoveryWorkHref(date: Date, ids: readonly string[] = matchedWorkIds): string | null {
  const id = discoveryWorkId(date, ids)
  return id ? `/works/${id}` : null
}
