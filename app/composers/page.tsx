import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { ComposerList } from "@/components/composer-list"
import { listRankedPopularComposers } from "@/lib/openopus"

export const metadata: Metadata = {
  title: "Composers",
  description: "The most popular composers in the Open Opus catalog.",
}

export const revalidate = 3600

export default async function ComposersPage() {
  const composers = await listRankedPopularComposers()

  return (
    <div>
      <PageHeader
        title="Composers"
        description="The most popular composers in Open Opus, in the same importance order as the period lists."
        backHref="/"
        backLabel="Home"
      />
      <ComposerList composers={composers} />
    </div>
  )
}
