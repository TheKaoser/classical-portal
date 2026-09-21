import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { GenreList } from "@/components/genre-list"
import { listGenresByPopularity } from "@/lib/openopus"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Genres",
}

export default async function GenresPage() {
  const genres = await listGenresByPopularity()

  return (
    <div>
      <PageHeader
        title="Genres"
        description="Open Opus work types, ordered by how many compositions are marked popular."
        backHref="/"
        backLabel="Home"
      />
      <GenreList genres={genres} />
    </div>
  )
}
