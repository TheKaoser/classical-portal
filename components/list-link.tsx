import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function ListLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group -mx-3 flex items-start gap-3 rounded-2xl px-3 py-3 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {children}
    </Link>
  )
}
