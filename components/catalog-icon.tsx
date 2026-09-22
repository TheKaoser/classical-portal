import { genreIcon, periodIcon, type IconMark } from "@/lib/catalog-icons"
import { cn } from "@/lib/utils"

function Mark({ mark }: { mark: IconMark }) {
  if (mark.kind === "circle") {
    return (
      <circle
        cx={mark.cx}
        cy={mark.cy}
        r={mark.r}
        fill={mark.fill ? "currentColor" : "none"}
        stroke={mark.fill ? "none" : "currentColor"}
      />
    )
  }

  if (mark.kind === "rect") {
    return (
      <rect
        x={mark.x}
        y={mark.y}
        width={mark.width}
        height={mark.height}
        rx={mark.rx}
        fill={mark.fill ? "currentColor" : "none"}
        stroke={mark.fill ? "none" : "currentColor"}
      />
    )
  }

  return <path d={mark.d} fill={mark.fill ? "currentColor" : "none"} stroke={mark.fill ? "none" : "currentColor"} />
}

export function CatalogIcon({
  marks,
  label,
  className,
}: {
  marks: IconMark[]
  label: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
      className={cn("size-6", className)}
    >
      <title>{label}</title>
      {marks.map((mark, index) => (
        <Mark key={index} mark={mark} />
      ))}
    </svg>
  )
}

export function CatalogTile({
  kind,
  slug,
  label,
  className,
}: {
  kind: "period" | "genre"
  slug: string
  label: string
  className?: string
}) {
  const marks = kind === "period" ? periodIcon(slug) : genreIcon(slug)
  return (
    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", className)}>
      <CatalogIcon marks={marks} label={label} />
    </span>
  )
}
