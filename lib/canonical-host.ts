import { SITE_ORIGIN } from "./site.ts"

/**
 * Production hosts that serve the same app. Preview URLs
 * (`classical-portal-git-….vercel.app`) are left alone.
 */
export const ALIAS_HOSTS = new Set(["www.classicalportal.app", "classical-portal.vercel.app"])

/** First hostname in a Host or X-Forwarded-Host value, without port. */
export function hostnameFromHeader(value: string | null | undefined): string {
  const first = value?.split(",")[0]?.trim().toLowerCase() ?? ""
  if (!first) return ""
  if (first.startsWith("[")) {
    const end = first.indexOf("]")
    return end === -1 ? first : first.slice(1, end)
  }
  return first.split(":")[0] ?? ""
}

/**
 * Absolute apex URL when this request should leave an alias host.
 * `/api/*` stays put so a Spotify callback started on the old host still matches.
 * Returns null when the host is already canonical, local, or a preview deployment.
 */
export function canonicalRedirectTarget(
  hostHeader: string | null | undefined,
  pathname: string,
  search = ""
): string | null {
  const host = hostnameFromHeader(hostHeader)
  if (!ALIAS_HOSTS.has(host)) return null
  if (pathname === "/api" || pathname.startsWith("/api/")) return null
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  return `${SITE_ORIGIN}${path}${search}`
}
