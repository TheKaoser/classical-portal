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
