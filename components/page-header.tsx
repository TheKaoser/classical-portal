import { BackLink } from "@/components/back-link"

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
        <BackLink
          href={backHref}
          label={backLabel || "Back"}
          className="mb-5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-primary hover:bg-accent"
        />
      )}
      <div className="flex items-start gap-4">
        {portrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portrait}
            alt=""
            width={80}
            height={80}
            className="h-20 w-20 shrink-0 rounded-full object-cover shadow-card ring-1 ring-border"
          />
        )}
        <div className="min-w-0">
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm font-medium text-primary">{subtitle}</p>}
          {description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
    </div>
  )
}
