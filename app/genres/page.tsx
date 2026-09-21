import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { formSummaries } from "@/lib/form-catalog"

export const metadata: Metadata = {
  title: "Genres",
  description: "Browse classical works by form, from symphonies and sonatas to operas and nocturnes.",
}

export default function GenresPage() {
  const forms = formSummaries()

  return (
    <div>
      <PageHeader
        title="Genres"
        description="Forms found in Open Opus titles and subtitles, ordered by how many works are marked popular."
        backHref="/"
        backLabel="Home"
      />
      <ul className="divide-y divide-border">
        {forms.map((form) => (
          <li key={form.slug}>
            <Link
              href={`/genres/${form.slug}`}
              className="block py-4 hover:bg-accent/70 -mx-2 px-2 rounded-md"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-serif text-xl tracking-tight text-navy">{form.name}</span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {form.total.toLocaleString()} {form.total === 1 ? "work" : "works"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{form.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
