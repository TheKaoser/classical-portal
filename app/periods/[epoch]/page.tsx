import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { ComposerList } from "@/components/composer-list"
import { PageHeader } from "@/components/page-header"
import { PeriodComposerBrowser } from "@/components/period-composer-browser"
import {
  EPOCHS,
  epochFromSlug,
  legacyEpochName,
  openOpusEpochNamesFor,
  relocatedEpochHref,
} from "@/lib/epochs"
import { listComposersByEpochs } from "@/lib/openopus"

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
  return { title: epoch?.name ?? legacyEpochName(slug) ?? "Period" }
}

export default async function EpochPage({
  params,
}: {
  params: Promise<{ epoch: string }>
}) {
  const { epoch: slug } = await params
  const moved = relocatedEpochHref(slug)
  if (moved) permanentRedirect(moved)

  const epoch = epochFromSlug(slug)
  if (!epoch) notFound()

  const composers = await listComposersByEpochs(openOpusEpochNamesFor(epoch))
  const filters =
    epoch.sources && epoch.sources.length > 1
      ? epoch.sources.map((source) => ({
          slug: source.slug,
          label: source.label,
          epoch: source.name,
          count: composers.filter((composer) => composer.epoch === source.name).length,
        }))
      : []

  return (
    <div>
      <PageHeader
        title={epoch.name}
        subtitle={epoch.years}
        description={epoch.blurb}
        backHref="/periods"
        backLabel="Periods"
      />
      {filters.length ? (
        <PeriodComposerBrowser composers={composers} filters={filters} />
      ) : (
        <ComposerList composers={composers} />
      )}
    </div>
  )
}
