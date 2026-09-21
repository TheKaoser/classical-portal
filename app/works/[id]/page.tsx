import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { SpotifyRecordings } from "@/components/spotify-recordings"
import { Badge } from "@/components/ui/badge"
import { getWork } from "@/lib/openopus"
import { searchSpotifyForWork } from "@/lib/spotify"

export const revalidate = 600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const { composer, work } = await getWork(id)
  if (!work) return { title: "Work" }
  return { title: composer ? `${work.title} · ${composer.name}` : work.title }
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { composer, work } = await getWork(id)
  if (!work || !composer) notFound()

  const spotify = await searchSpotifyForWork(composer.name, work.title)
  const subtitle = [work.genre, composer.complete_name].filter(Boolean).join(" · ")

  return (
    <div className="space-y-10">
      <div>
        <PageHeader
          title={work.title}
          subtitle={subtitle}
          description={work.subtitle || null}
          backHref={`/composers/${composer.id}`}
          backLabel={composer.name}
        />
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{work.genre}</Badge>
          {composer.epoch && <Badge variant="secondary">{composer.epoch}</Badge>}
        </div>
      </div>

      <SpotifyRecordings
        configured={spotify.configured}
        searchUrl={spotify.searchUrl}
        albums={spotify.albums}
        tracks={spotify.tracks}
      />
    </div>
  )
}
