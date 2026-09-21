import Link from "next/link"
import { SearchForm } from "@/components/search-form"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 font-serif text-lg tracking-tight text-foreground">
          Classical Portal
        </Link>
        <SearchForm className="ml-auto w-full max-w-sm" />
      </div>
    </header>
  )
}
