import Link from "next/link"
import { Star } from "lucide-react"
import { isFlagged, type OpenOpusWork } from "@/lib/openopus"
import { Badge } from "@/components/ui/badge"

export function WorkList({ works }: { works: OpenOpusWork[] }) {
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
            {isFlagged(work.popular) ? (
              <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-current text-primary" />
            ) : (
              <span className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-navy">{work.title}</span>
              {work.subtitle ? (
                <span className="block text-xs text-muted-foreground">{work.subtitle}</span>
              ) : null}
            </span>
            {isFlagged(work.recommended) && (
              <Badge variant="outline" className="mt-0.5 shrink-0 font-normal">
                Essential
              </Badge>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
