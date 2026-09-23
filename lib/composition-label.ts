export type CompositionDate = {
  start: number
  /** Inclusive end year when the source gave a span. */
  end: number | null
  circa: boolean
}

export function formatCompositionDate(date: CompositionDate | null | undefined): string | null {
  if (!date) return null
  const prefix = date.circa ? "c. " : ""
  if (date.end == null || date.end === date.start) return `${prefix}${date.start}`
  const sameCentury = Math.floor(date.start / 100) === Math.floor(date.end / 100)
  const endText = sameCentury ? String(date.end).slice(-2) : String(date.end)
  return `${prefix}${date.start}–${endText}`
}
