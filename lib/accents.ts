/** Flat catalog colors, cycled so long lists stay evenly colorful. */
export const CATALOG_ACCENTS = [
  { tile: "bg-surface-blue text-primary", mark: "bg-primary" },
  { tile: "bg-surface-red text-brand-red", mark: "bg-brand-red" },
  { tile: "bg-surface-yellow text-brand-amber", mark: "bg-brand-yellow" },
  { tile: "bg-surface-green text-brand-green", mark: "bg-brand-green" },
] as const

export function catalogAccent(index: number) {
  return CATALOG_ACCENTS[index % CATALOG_ACCENTS.length]
}
