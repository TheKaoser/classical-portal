import Link from "next/link"
import { cn } from "@/lib/utils"

export function FilterChips({
  items,
}: {
  items: {
    href?: string
    label: string
    active: boolean
    count?: number
    onSelect?: () => void
  }[]
}) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filters">
      {items.map((item) => {
        const className = cn(
          "rounded-full px-3.5 py-1.5 text-sm transition-colors",
          item.active
            ? "bg-primary font-medium text-primary-foreground"
            : "bg-secondary text-foreground hover:bg-accent"
        )
        const text = (
          <>
            {item.label}
            {typeof item.count === "number" ? ` ${item.count}` : ""}
          </>
        )
        if (item.onSelect) {
          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={item.active}
              onClick={item.onSelect}
              className={cn(className, "cursor-pointer")}
            >
              {text}
            </button>
          )
        }
        return (
          <Link key={(item.href ?? "") + item.label} href={item.href ?? "#"} className={className}>
            {text}
          </Link>
        )
      })}
    </nav>
  )
}
