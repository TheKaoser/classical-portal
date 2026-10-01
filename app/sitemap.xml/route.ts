import { catalogSitemapIndexXml } from "@/lib/sitemap-catalog"

export const dynamic = "force-static"

/** robots.txt points here. The body is a sitemap index, not the full urlset. */
export function GET() {
  return new Response(catalogSitemapIndexXml(), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  })
}
