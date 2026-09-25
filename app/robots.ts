import type { MetadataRoute } from "next"
import { SITE_ORIGIN } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Google ignores crawl delay directives, so none is set. /api/ stays
      // disallowed so crawlers are not invited to the Spotify-backed handlers.
      disallow: ["/api/"],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  }
}
