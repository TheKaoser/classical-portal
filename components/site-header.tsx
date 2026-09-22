import Link from "next/link"
import { SearchForm } from "@/components/search-form"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0 font-serif text-lg tracking-tight text-foreground hover:text-primary">
          Classical <span className="text-primary">Portal</span>
        </Link>
        <SearchForm className="ml-auto w-full max-w-sm" />
      </div>
    </header>
  )
}
