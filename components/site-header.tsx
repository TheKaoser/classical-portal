import Link from "next/link"
import { BrandMark } from "@/components/brand-mark"
import { SearchForm } from "@/components/search-form"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Classical Portal home"
        >
          <BrandMark className="h-8 w-auto" />
        </Link>
        <SearchForm className="ml-auto w-full max-w-sm" />
      </div>
    </header>
  )
}
