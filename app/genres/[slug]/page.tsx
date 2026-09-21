import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { WorkList } from "@/components/work-list"
import { formSummaries, worksForForm } from "@/lib/form-catalog"
import { formFromSlug } from "@/lib/forms"

export function generateStaticParams() {
  return formSummaries().map((form) => ({ slug: form.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const form = formFromSlug(slug)
  return { title: form?.name ?? "Genre" }
}

export default async function GenrePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const form = formFromSlug(slug)
  if (!form) notFound()

  const works = worksForForm(slug)
  if (!works.length) notFound()

  return (
    <div>
      <PageHeader
        title={form.name}
        subtitle={`${works.length.toLocaleString()} ${works.length === 1 ? "work" : "works"}`}
        description={`${form.blurb} Popular works are listed first.`}
        backHref="/genres"
        backLabel="Genres"
      />
      <WorkList
        works={works.map((work) => ({
          id: work.id,
          title: work.title,
          subtitle: work.subtitle,
          genre: work.genre,
          popular: work.popular,
          recommended: work.recommended,
          composerLabel: work.composerName,
        }))}
      />
    </div>
  )
}
