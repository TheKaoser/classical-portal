import { ListLink } from "@/components/list-link"
import { catalogAccent } from "@/lib/accents"
import { lifeSpan, type OpenOpusComposer } from "@/lib/openopus"
import { cn } from "@/lib/utils"

export function ComposerList({ composers }: { composers: OpenOpusComposer[] }) {
  if (!composers.length) {
    return <p className="text-sm text-muted-foreground">No composers found.</p>
  }

  return (
    <ul className="space-y-0.5">
      {composers.map((composer, index) => {
        const years = lifeSpan(composer)
        const accent = catalogAccent(index)
        return (
          <li key={composer.id}>
            <ListLink href={`/composers/${composer.id}`} className="items-center">
              {composer.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={composer.portrait}
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full text-sm font-medium",
                    accent.tile
                  )}
                >
                  {composer.name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground group-hover:text-primary">
                  {composer.complete_name}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {[years, composer.epoch].filter(Boolean).join(" · ")}
                </div>
              </div>
            </ListLink>
          </li>
        )
      })}
    </ul>
  )
}
