import { NextRequest, NextResponse } from "next/server"
import { formatCompositionDate } from "@/lib/composition-label"
import { attachCompositionYearsByComposer } from "@/lib/composition-years"
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
    const selected = []
    for (const hit of hits) {
      if (!hit.work || seenWorks.has(hit.work.id)) continue
      seenWorks.add(hit.work.id)
      selected.push({ ...hit.work, composer: hit.composer })
      if (selected.length >= 8) break
    }
    const dated = await attachCompositionYearsByComposer(selected)
    const works = dated.map((work) => ({
      id: work.id,
      title: work.title,
      genre: work.genre,
      composerId: work.composer.id,
      composerName: work.composer.complete_name || work.composer.name,
      compositionLabel: formatCompositionDate(work.compositionDate),
    }))

    return NextResponse.json({ composers, works })
  } catch {
    return NextResponse.json({ composers: [], works: [] })
  }
}
