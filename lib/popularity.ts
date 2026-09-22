export function isFlagged(value: string | number | undefined): boolean {
  return value === 1 || value === "1"
}

/** Open Opus marks a work or composer with `popular`, `recommended`, or both. Either flag counts as popular. */
export function isPopular(item: {
  popular?: string | number
  recommended?: string | number
}): boolean {
  return isFlagged(item.popular) || isFlagged(item.recommended)
}

export function dedupeWorks<
  T extends { id: string; popular?: string | number; recommended?: string | number },
>(works: T[]): T[] {
  const byId = new Map<string, T>()

  for (const work of works) {
    const existing = byId.get(work.id)
    if (!existing) {
      byId.set(work.id, work)
      continue
    }
    byId.set(work.id, {
      ...existing,
      popular: isFlagged(existing.popular) || isFlagged(work.popular) ? "1" : existing.popular,
      recommended:
        isFlagged(existing.recommended) || isFlagged(work.recommended) ? "1" : existing.recommended,
    })
  }

  return [...byId.values()]
}

/** Lower rank is more prominent. Combined popular flag first, then everything else. */
export function popularityRank(work: {
  popular?: string | number
  recommended?: string | number
}): number {
  return isPopular(work) ? 0 : 1
}

/** A finite Spotify popularity in range. Anything else counts as unmatched. */
export function knownSpotifyScore(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return value
}

/**
 * Higher Spotify score first. Unmatched rows sort after every matched row.
 * When neither row has a score, `fallback` is the previous Open Opus rank
 * (lower is more prominent). Name is the stable tie-break in both cases.
 */
export function compareSpotifyThenFallback(
  aScore: number | null | undefined,
  bScore: number | null | undefined,
  aName: string,
  bName: string,
  aFallback = 0,
  bFallback = 0
): number {
  const a = knownSpotifyScore(aScore)
  const b = knownSpotifyScore(bScore)
  if (a != null && b != null) return b - a || aName.localeCompare(bName)
  if (a != null) return -1
  if (b != null) return 1
  return aFallback - bFallback || aName.localeCompare(bName)
}

export function compareWorksByPopularity<
  T extends { title: string; popular?: string | number; recommended?: string | number },
>(a: T, b: T, scoreOf?: (work: T) => number | null): number {
  return compareSpotifyThenFallback(
    scoreOf ? scoreOf(a) : null,
    scoreOf ? scoreOf(b) : null,
    a.title,
    b.title,
    popularityRank(a),
    popularityRank(b)
  )
}

/**
 * Fallback rank when Spotify has no score for a composer.
 * 0 = `/composer/list/pop.json`, 1 = `/composer/list/rec.json` only, 2 = everyone else.
 * Someone on both lists stays in the popular tier. Displayed lists use
 * `sortComposersBySpotify` and only consult this rank for unmatched composers.
 */
export function composerImportanceRank(
  id: string,
  popularIds: Set<string>,
  essentialIds: Set<string>
): number {
  if (popularIds.has(id)) return 0
  if (essentialIds.has(id)) return 1
  return 2
}

export function sortComposersByImportance<
  T extends { id: string; name: string; complete_name?: string | null },
>(composers: T[], popularIds: Set<string>, essentialIds: Set<string>): T[] {
  const sortName = (composer: T) => composer.complete_name || composer.name
  return [...composers].sort(
    (a, b) =>
      composerImportanceRank(a.id, popularIds, essentialIds) -
        composerImportanceRank(b.id, popularIds, essentialIds) ||
      sortName(a).localeCompare(sortName(b))
  )
}

/** Spotify score descending, then name. Unmatched composers keep the Open Opus tier order. */
export function sortComposersBySpotify<
  T extends { id: string; name: string; complete_name?: string | null },
>(
  composers: T[],
  scoreOf: (composer: T) => number | null,
  popularIds: Set<string>,
  essentialIds: Set<string>
): T[] {
  const sortName = (composer: T) => composer.complete_name || composer.name
  return [...composers].sort((a, b) =>
    compareSpotifyThenFallback(
      scoreOf(a),
      scoreOf(b),
      sortName(a),
      sortName(b),
      composerImportanceRank(a.id, popularIds, essentialIds),
      composerImportanceRank(b.id, popularIds, essentialIds)
    )
  )
}
