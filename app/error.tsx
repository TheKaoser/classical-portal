"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="space-y-3 py-12">
      <h1 className="font-serif text-2xl tracking-tight">Could not load the catalog</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || "Open Opus or Spotify did not respond. Try again in a moment."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="text-sm text-primary hover:text-primary-hover hover:underline"
      >
        Retry
      </button>
    </div>
  )
}
