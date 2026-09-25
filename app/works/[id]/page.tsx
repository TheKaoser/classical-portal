import Link from "next/link"
import { notFound } from "next/navigation"
import { JsonLd } from "@/components/json-ld"
import { PageHeader } from "@/components/page-header"
import { WorkSpotifyRecordings } from "@/components/work-spotify-recordings"
import { Badge } from "@/components/ui/badge"
import { attachCompositionYears, storedCompositionDate } from "@/lib/composition-years"
import { formatCompositionDate } from "@/lib/composition-label"
import { genreHrefForLabel } from "@/lib/forms"
import { getWork, workParts } from "@/lib/openopus"
import { pageMetadata, workDescription, workJsonLd, workPageTitle } from "@/lib/seo"
import { isSpotifyOAuthConfigured } from "@/lib/spotify-model"
import { classicalPlaylistName } from "@/lib/spotify-playlist"
import { catalogSpotifySearchUrl } from "@/lib/spotify-work-query"

export const revalidate = 600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { composer, work } = await getWork(id)
  if (!work || !composer) return { title: "Work", robots: { index: false, follow: false } }
  const compositionDate = storedCompositionDate(composer.id, work)
  const composerName = composer.name || composer.complete_name
  return pageMetadata({
    title: workPageTitle(composerName, work.title),
    description: workDescription({
      composerName: composer.complete_name || composerName,
      title: work.title,
      subtitle: work.subtitle,
      genre: work.genre,
      compositionLabel: formatCompositionDate(compositionDate),
    }),
    path: `/works/${work.id}`,
  })
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
  const datedList = await attachCompositionYears([work], {
    id: composer.id,
    name: composer.name,
    complete_name: composer.complete_name,
  })
  const compositionDate = datedList[0]?.compositionDate ?? null
  const subtitle = [formatCompositionDate(compositionDate), work.genre, composer.complete_name]
    .filter(Boolean)
    .join(" · ")
  const playlistName = classicalPlaylistName(composer.name, work.title)
  const searchUrl = catalogSpotifySearchUrl(composer, work)

  return (
    <div className="space-y-10">
      <JsonLd
        data={workJsonLd({
          id: work.id,
          title: work.title,
          subtitle: work.subtitle,
          genre: work.genre,
          compositionDate,
          composer: { id: composer.id, completeName: composer.complete_name },
        })}
      />
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

      <WorkSpotifyRecordings
        key={work.id}
        workId={work.id}
        oauthConfigured={isSpotifyOAuthConfigured()}
        searchUrl={searchUrl}
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
