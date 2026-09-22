type FilterHistory = {
  replaceState: (data: unknown, unused: string, url?: string | null) => void
}

/** Path and query for a chip. `all` clears `filter` and leaves other params alone. */
export function filterPath(href: string, slug: string): string {
  const url = new URL(href, "http://localhost")
  if (slug === "all") url.searchParams.delete("filter")
  else url.searchParams.set("filter", slug)
  return `${url.pathname}${url.search}`
}

/**
 * Point the current history entry at `?filter=` without pushing another one,
 * so Back leaves the page instead of walking chips.
 *
 * Pass a plain state object. Next patches `replaceState` and, when that
 * state already carries `__NA`, returns early without copying router
 * internals or syncing the search string. A plain object lets the patch
 * copy `__NA` itself, so Back from a work still restores this filtered URL.
 */
export function applyFilterHistory(history: FilterHistory, href: string, slug: string): void {
  history.replaceState({}, "", filterPath(href, slug))
}
