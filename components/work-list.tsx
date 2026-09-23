import { Star } from "lucide-react"
import { ListLink } from "@/components/list-link"
import { formatCompositionDate, type CompositionDate } from "@/lib/composition-label"
import { isPopular, type OpenOpusWork } from "@/lib/openopus"

type ListedWork = OpenOpusWork & {
  composer?: { name: string; complete_name?: string }
  composerLabel?: string
  compositionDate?: CompositionDate | null
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
            <CompositionYear date={work.compositionDate} year={work.compositionYear} />
          </ListLink>
        </li>
      ))}
    </ul>
  )
}

export function CompositionYear({
  date,
  year,
}: {
  date?: CompositionDate | null
  year?: number | null
}) {
  const resolved =
    date ?? (year != null ? { start: year, end: null, circa: false } : null)
  const label = formatCompositionDate(resolved)
  if (!resolved || !label) {
    return (
      <span className="mt-0.5 w-[7rem] shrink-0 text-right text-xs text-muted-foreground/50" aria-hidden>
        —
      </span>
    )
  }

  const title = resolved.circa
    ? "Approximate composition year"
    : resolved.end != null
      ? "Composition years"
      : "Composition year"

  return (
    <time
      dateTime={String(resolved.start)}
      title={title}
      className="mt-0.5 w-[7rem] shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground"
    >
      {label}
    </time>
  )
}
