import Link from "next/link"
import { lifeSpan, type OpenOpusComposer } from "@/lib/openopus"

export function ComposerList({ composers }: { composers: OpenOpusComposer[] }) {
  if (!composers.length) {
    return <p className="text-sm text-muted-foreground">No composers found.</p>
  }

  return (
    <ul className="divide-y divide-border">
      {composers.map((composer) => {
        const years = lifeSpan(composer)
        return (
          <li key={composer.id}>
            <Link
              href={`/composers/${composer.id}`}
              className="flex items-center gap-3 py-3 hover:bg-accent/40 -mx-2 px-2 rounded-md"
            >
              {composer.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={composer.portrait}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded object-cover grayscale"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  {composer.name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{composer.complete_name}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {[years, composer.epoch].filter(Boolean).join(" · ")}
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
