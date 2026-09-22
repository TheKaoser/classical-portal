import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { SpotifyRecordings } from "@/components/spotify-recordings"
import { Badge } from "@/components/ui/badge"
import { genreHref, getWork, workParts, workSearchTerms } from "@/lib/openopus"
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

  const parts = workParts(work)
  const spotify = await searchSpotifyForWork({
    composerName: composer.name,
    composerCompleteName: composer.complete_name,
    title: work.title,
    subtitle: work.subtitle,
    genre: work.genre,
    catalogue: work.catalogue,
    catalogueNumber: work.catalogue_number,
    additionalNumber: work.additional_number,
    searchterms: workSearchTerms(work),
    parts,
  })
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
          {work.genre ? (
            <Badge variant="outline" asChild>
              <Link href={genreHref(work.genre)}>{work.genre}</Link>
            </Badge>
          ) : null}
          {composer.epoch && <Badge variant="secondary">{composer.epoch}</Badge>}
        </div>
        {parts.length > 0 && (
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {parts.map((part) => (
              <li key={part}>{part}</li>
            ))}
          </ol>
        )}
      </div>

      <SpotifyRecordings
        configured={spotify.configured}
        oauthConfigured={spotify.oauthConfigured}
        searchUrl={spotify.searchUrl}
        recordings={spotify.recordings}
      />
    </div>
  )
}
