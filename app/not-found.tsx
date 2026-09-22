import Link from "next/link"

export default function NotFound() {
  return (
    <div className="space-y-3 py-16">
      <h1 className="font-serif text-4xl tracking-tight text-foreground">Not found</h1>
      <p className="text-sm text-muted-foreground">That composer, work, or page is not in the catalog.</p>
      <Link href="/" className="inline-flex text-sm font-medium text-primary hover:underline">
        Back home
      </Link>
    </div>
  )
}
