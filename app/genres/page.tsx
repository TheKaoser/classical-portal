import type { Metadata } from "next"
import { CatalogTile } from "@/components/catalog-icon"
import { ListLink } from "@/components/list-link"
import { PageHeader } from "@/components/page-header"
import { catalogAccent } from "@/lib/accents"
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
      <ul className="space-y-1">
        {forms.map((form, index) => {
          const accent = catalogAccent(index)
          return (
            <li key={form.slug}>
              <ListLink href={`/genres/${form.slug}`}>
                <CatalogTile kind="genre" slug={form.slug} label={form.name} className={accent.tile} />
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="text-base font-medium text-foreground group-hover:text-primary">{form.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {form.total.toLocaleString()} {form.total === 1 ? "work" : "works"}
                    </span>
                  </span>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{form.blurb}</p>
                </span>
              </ListLink>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
