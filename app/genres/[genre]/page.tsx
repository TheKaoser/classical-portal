import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { WorkList } from "@/components/work-list"
import { genreFromSlug, isFlagged, listWorksByGenre } from "@/lib/openopus"

export const revalidate = 3600
export const maxDuration = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ genre: string }>
}): Promise<Metadata> {
  const { genre: slug } = await params
  const genre = genreFromSlug(slug)
  return { title: genre ?? "Genre" }
}

export default async function GenrePage({
  params,
}: {
  params: Promise<{ genre: string }>
}) {
  const { genre: slug } = await params
  const genre = genreFromSlug(slug)
  if (!genre) notFound()

  const works = await listWorksByGenre(genre)
  const popularCount = works.filter((work) => isFlagged(work.popular)).length

  return (
    <div>
      <PageHeader
        title={genre}
        subtitle={`${popularCount} popular · ${works.length} listed`}
        description="Popular Open Opus works first, then essential; alphabetical within each tier."
        backHref="/genres"
        backLabel="Genres"
      />
      <WorkList works={works} showComposer />
    </div>
  )
}
