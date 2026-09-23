type FilterHistory = {
  replaceState: (data: unknown, unused: string, url?: string | null) => void
}

/**
 * Path and query for a chip. `emptySlug` (default `all`) clears `filter` and
 * leaves other params alone. Composer pages use `popular` as the empty slug
 * when that chip is the URL with no query.
 */
export function filterPath(href: string, slug: string, emptySlug = "all"): string {
  const url = new URL(href, "http://localhost")
  if (slug === emptySlug) url.searchParams.delete("filter")
  else url.searchParams.set("filter", slug)
  return `${url.pathname}${url.search}`
}

/**
 * Chip slug for a query string. Missing or unknown values use `emptySlug`.
 * `aliases` maps legacy query values (composer `recommended` → `popular`)
 * before the allow-list check.
 */
export function readFilterSlug(
  search: string,
  allowed: ReadonlySet<string>,
  emptySlug = "all",
  aliases: Readonly<Record<string, string>> = {}
): string {
  const raw = new URLSearchParams(search).get("filter")
  if (!raw) return emptySlug
  const slug = aliases[raw] ?? raw
  return allowed.has(slug) ? slug : emptySlug
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
export function applyFilterHistory(
  history: FilterHistory,
  href: string,
  slug: string,
  emptySlug = "all"
): void {
  history.replaceState({}, "", filterPath(href, slug, emptySlug))
}
