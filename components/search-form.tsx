import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SearchForm({
  className,
  autoFocus = false,
  defaultValue = "",
  size = "default",
}: {
  className?: string
  autoFocus?: boolean
  defaultValue?: string
  size?: "default" | "lg"
}) {
  return (
    <form action="/search" method="get" className={cn("relative", className)} role="search">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Search composers or works"
        aria-label="Search composers or works"
        className={cn(
          "bg-background pl-9 shadow-none",
          size === "lg" && "h-11 text-base md:text-base"
        )}
      />
    </form>
  )
}
