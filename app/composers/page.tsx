import { PageHeader } from "@/components/page-header"
import { ComposerList } from "@/components/composer-list"
import { listRankedPopularComposers } from "@/lib/openopus"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({
  title: "Composers",
  description: "The most popular composers in Open Opus, ordered by Spotify popularity.",
  path: "/composers",
})

// Catalog pages are rebuilt at most every 30 days: Open Opus data is frozen and
// every regeneration is billed as Fluid Active CPU (bots revisit constantly).
export const revalidate = 2592000

export default async function ComposersPage() {
  const composers = await listRankedPopularComposers()

  return (
    <div>
      <PageHeader
        title="Composers"
        description="The most popular composers in Open Opus, ordered by Spotify popularity."
        backHref="/"
        backLabel="Home"
      />
      <ComposerList composers={composers} />
    </div>
  )
}
