import { NextRequest, NextResponse } from "next/server"
import { omniSearch } from "@/lib/openopus"

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim()
  if (query.length < 3) {
    return NextResponse.json({ composers: [], works: [] })
  }

  try {
    const hits = await omniSearch(query)
    const composers = hits
      .filter((hit) => !hit.work)
      .slice(0, 6)
      .map((hit) => ({
        id: hit.composer.id,
        name: hit.composer.name,
        complete_name: hit.composer.complete_name,
        epoch: hit.composer.epoch,
      }))

    const seenWorks = new Set<string>()
    const works = []
    for (const hit of hits) {
      if (!hit.work || seenWorks.has(hit.work.id)) continue
      seenWorks.add(hit.work.id)
      works.push({
        id: hit.work.id,
        title: hit.work.title,
        genre: hit.work.genre,
        composerId: hit.composer.id,
        composerName: hit.composer.complete_name || hit.composer.name,
      })
      if (works.length >= 8) break
    }

    return NextResponse.json({ composers, works })
  } catch {
    return NextResponse.json({ composers: [], works: [] })
  }
}
