import Link from "next/link"

export default function NotFound() {
  return (
    <div className="space-y-3 py-12">
      <h1 className="font-serif text-2xl tracking-tight">Not found</h1>
      <p className="text-sm text-muted-foreground">That composer, work, or page is not in the catalog.</p>
      <Link href="/" className="text-sm hover:underline">
        Back home
      </Link>
    </div>
  )
}
