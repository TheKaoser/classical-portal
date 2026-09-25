/**
 * Layout constants for the in-page Spotify player dock.
 * The bar is fixed to the viewport edges. Footer padding, not body padding,
 * clears content above it, and only while the dock is actually visible.
 */

/** Fallback height while the live bar has not been measured yet. */
export const PLAYER_BAR_FALLBACK_HEIGHT_PX = 152

/** Tailwind / utility classes for the full-bleed dock (no bottom inset, no outer margin). */
export const PLAYER_BAR_DOCK_CLASS =
  "fixed inset-x-0 bottom-0 z-50 m-0 w-full max-w-none rounded-none border-0 border-t border-border bg-card p-0 shadow-[0_-8px_24px_rgba(60,64,67,0.14)]"

/**
 * Inline styles that must win over leftover floating-card spacing
 * (margin, bottom offset, safe-area lifting the whole bar).
 */
export const PLAYER_BAR_DOCK_STYLE = {
  position: "fixed",
  top: "auto",
  right: 0,
  bottom: 0,
  left: 0,
  width: "100%",
  margin: 0,
  transform: "none",
  /* Safe-area pads inside the bar so the painted edge stays at the screen bottom. */
  paddingBottom: "env(safe-area-inset-bottom, 0px)",
} as const

/** CSS custom property written on <html> while the player is visible. */
export const PLAYER_BAR_HEIGHT_VAR = "--player-bar-height"

export function playerBarPaddingCss(heightPx: number): string {
  const px = Number.isFinite(heightPx) && heightPx > 0 ? Math.ceil(heightPx) : PLAYER_BAR_FALLBACK_HEIGHT_PX
  return `${px}px`
}

/** True when a class list still uses the Google-UI floating-card inset pattern. */
export function isFloatingPlayerInset(className: string): boolean {
  return /\bpb-3\b/.test(className) || /\bpb-4\b/.test(className) || /\brounded-3xl\b/.test(className)
}
