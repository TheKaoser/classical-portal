import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export function PageHeader({
  title,
  subtitle,
  description,
  backHref,
  backLabel,
  portrait,
}: {
  title: string
  subtitle?: string | null
  description?: string | null
  backHref?: string
  backLabel?: string
  portrait?: string | null
}) {
  return (
    <div className="mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel || "Back"}
        </Link>
      )}
      <div className="flex items-start gap-4">
        {portrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portrait}
            alt=""
            width={72}
            height={72}
            className="h-[72px] w-[72px] shrink-0 rounded object-cover grayscale"
          />
        )}
        <div className="min-w-0">
          <h1 className="font-serif text-3xl leading-tight tracking-tight text-navy">{title}</h1>
          {subtitle && <p className="mt-1 text-sm font-medium text-primary">{subtitle}</p>}
          {description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
    </div>
  )
}
