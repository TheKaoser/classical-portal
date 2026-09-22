export default function Loading() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-10 w-56 animate-pulse rounded-full bg-secondary" />
      <div className="h-4 w-72 animate-pulse rounded-full bg-secondary" />
      <div className="h-14 w-full animate-pulse rounded-2xl bg-secondary" />
      <div className="h-14 w-full animate-pulse rounded-2xl bg-secondary" />
    </div>
  )
}
