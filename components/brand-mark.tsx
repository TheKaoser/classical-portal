import { cn } from "@/lib/utils"

type BrandMarkProps = {
  className?: string
  /** Decorative when paired with visible “Classical Portal” text. */
  decorative?: boolean
}

export function BrandMark({ className, decorative = false }: BrandMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static public mark; next/image unused in repo
    <img
      src="/classical-portal-mark.png"
      alt={decorative ? "" : "Classical Portal"}
      aria-hidden={decorative || undefined}
      className={cn("h-auto w-auto object-contain", className)}
      width={268}
      height={472}
      decoding="async"
    />
  )
}
