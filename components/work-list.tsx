import { Star } from "lucide-react"
import { ListLink } from "@/components/list-link"
import { isPopular, type GenreWork, type OpenOpusWork } from "@/lib/openopus"

type ListedWork = OpenOpusWork &
  Partial<Pick<GenreWork, "composer">> & {
    composerLabel?: string
    compositionYear?: number | null
  }

export function WorkList({
  works,
  showComposer = false,
  showGenre = false,
}: {
  works: ListedWork[]
  showComposer?: boolean
  showGenre?: boolean
}) {
  if (!works.length) {
    return <p className="text-sm text-muted-foreground">No works in this view.</p>
  }

  return (
    <ul className="space-y-0.5">
      {works.map((work) => (
        <li key={work.id}>
          <ListLink href={`/works/${work.id}`}>
            {isPopular(work) ? (
              <Star className="mt-0.5 h-4 w-4 shrink-0 fill-brand-yellow text-brand-yellow" />
            ) : (
              <span className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-foreground group-hover:text-primary">{work.title}</span>
              {work.composerLabel || work.subtitle ? (
                <span className="block text-xs text-muted-foreground">
                  {[work.composerLabel, work.subtitle].filter(Boolean).join(" · ")}
                </span>
              ) : null}
              {showComposer && work.composer ? (
                <span className="block text-xs text-muted-foreground">
                  {work.composer.complete_name || work.composer.name}
                </span>
              ) : null}
              {showGenre && work.genre ? (
                <span className="block text-xs text-muted-foreground">{work.genre}</span>
              ) : null}
            </span>
            <WorkYear year={work.compositionYear} />
          </ListLink>
        </li>
      ))}
    </ul>
  )
}

function WorkYear({ year }: { year?: number | null }) {
  if (year == null) {
    return (
      <span className="mt-0.5 w-12 shrink-0 text-right text-xs text-muted-foreground/50" aria-hidden>
        —
      </span>
    )
  }

  return (
    <time
      dateTime={String(year)}
      title="Composition year"
      className="mt-0.5 w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
    >
      {year}
    </time>
  )
}
