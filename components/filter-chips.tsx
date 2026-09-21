import Link from "next/link"
import { cn } from "@/lib/utils"

export function FilterChips({
  items,
}: {
  items: { href: string; label: string; active: boolean; count?: number }[]
}) {
  return (
    <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Filters">
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            item.active
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          )}
        >
          {item.label}
          {typeof item.count === "number" ? ` ${item.count}` : ""}
        </Link>
      ))}
    </nav>
  )
}
