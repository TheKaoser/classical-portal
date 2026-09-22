"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="space-y-3 py-16">
      <h1 className="font-serif text-4xl tracking-tight text-foreground">Could not load the catalog</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || "Open Opus or Spotify did not respond. Try again in a moment."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="text-sm font-medium text-primary hover:underline"
      >
        Retry
      </button>
    </div>
  )
}
