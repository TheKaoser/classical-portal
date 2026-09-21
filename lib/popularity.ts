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

export function compareWorksByPopularity<
  T extends { title: string; popular?: string | number; recommended?: string | number },
>(a: T, b: T): number {
  return popularityRank(a) - popularityRank(b) || a.title.localeCompare(b.title)
}

/**
 * Composer lists (period pages) rank by Open Opus list membership, not work flags.
 * 0 = `/composer/list/pop.json`, 1 = `/composer/list/rec.json` only, 2 = everyone else.
 * Someone on both lists stays in the popular tier.
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
