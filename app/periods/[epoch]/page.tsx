import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { ComposerList } from "@/components/composer-list"
import { EPOCHS, epochFromSlug } from "@/lib/epochs"
import { listComposersByEpoch } from "@/lib/openopus"

export const revalidate = 3600

export function generateStaticParams() {
  return EPOCHS.map((epoch) => ({ epoch: epoch.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ epoch: string }>
}): Promise<Metadata> {
  const { epoch: slug } = await params
  const epoch = epochFromSlug(slug)
  return { title: epoch?.name ?? "Period" }
}

export default async function EpochPage({
  params,
}: {
  params: Promise<{ epoch: string }>
}) {
  const { epoch: slug } = await params
  const epoch = epochFromSlug(slug)
  if (!epoch) notFound()

  const composers = await listComposersByEpoch(epoch.name)

  return (
    <div>
      <PageHeader
        title={epoch.name}
        subtitle={epoch.years}
        description={epoch.blurb}
        backHref="/periods"
        backLabel="Periods"
      />
      <ComposerList composers={composers} />
    </div>
  )
}
