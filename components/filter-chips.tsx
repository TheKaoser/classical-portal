import Link from "next/link"
import { cn } from "@/lib/utils"

export function FilterChips({
  items,
}: {
  items: { href: string; label: string; active: boolean; count?: number }[]
}) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filters">
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm transition-colors",
            item.active
              ? "bg-primary font-medium text-primary-foreground"
              : "bg-secondary text-foreground hover:bg-accent"
          )}
        >
          {item.label}
          {typeof item.count === "number" ? ` ${item.count}` : ""}
        </Link>
      ))}
    </nav>
  )
}
