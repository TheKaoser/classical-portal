import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { SpotifyRecordings } from "@/components/spotify-recordings"
import { Badge } from "@/components/ui/badge"
import { genreHrefForLabel } from "@/lib/forms"
import { getWork, workParts, workSearchTerms } from "@/lib/openopus"
import { searchSpotifyForWork } from "@/lib/spotify"
import { classicalPlaylistName } from "@/lib/spotify-playlist"

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
  const playlistName = classicalPlaylistName(composer.name, work.title)

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
          {work.genre ? <WorkTag label={work.genre} /> : null}
          {composer.epoch && (
            <Badge variant="secondary" className="bg-surface-green text-brand-green">
              {composer.epoch}
            </Badge>
          )}
        </div>
        {parts.length > 0 && (
          <ol className="mt-6 space-y-1 text-sm text-muted-foreground">
            {parts.map((part, index) => (
              <li key={part} className="flex gap-3">
                <span className="w-5 shrink-0 text-right tabular-nums text-primary">{index + 1}</span>
                <span>{part}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <SpotifyRecordings
        configured={spotify.configured}
        oauthConfigured={spotify.oauthConfigured}
        searchUrl={spotify.searchUrl}
        recordings={spotify.recordings}
        playlistName={playlistName}
      />
    </div>
  )
}

function WorkTag({ label }: { label: string }) {
  const href = genreHrefForLabel(label)
  const className = "border-transparent bg-surface-blue text-primary"
  if (!href) {
    return (
      <Badge variant="outline" className={className}>
        {label}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className={className} asChild>
      <Link href={href}>{label}</Link>
    </Badge>
  )
}
