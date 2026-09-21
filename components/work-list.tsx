import Link from "next/link"
import { Star } from "lucide-react"
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
    <ul className="divide-y divide-border">
      {works.map((work) => (
        <li key={work.id}>
          <Link
            href={`/works/${work.id}`}
            className="flex items-start gap-2 py-2.5 hover:bg-accent/70 -mx-2 px-2 rounded-md"
          >
            {isPopular(work) ? (
              <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-current text-primary" />
            ) : (
              <span className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-navy">{work.title}</span>
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
          </Link>
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
