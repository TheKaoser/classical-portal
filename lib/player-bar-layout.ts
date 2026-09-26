/**
 * Layout constants for the in-page Spotify player dock.
 * The wrapper is fixed to the viewport edges but paints nothing, so the page
 * shows on either side of the player. Footer padding, not body padding,
 * clears content above it, and only while the dock is actually visible.
 */

/** Fallback height while the live bar has not been measured yet. */
export const PLAYER_BAR_FALLBACK_HEIGHT_PX = 152

/**
 * Full-bleed positioning wrapper. Transparent and click-through; the painted
 * player lives in PLAYER_BAR_SHELL_CLASS at the same size and placement.
 */
export const PLAYER_BAR_DOCK_CLASS =
  "pointer-events-none fixed inset-x-0 bottom-0 z-50 m-0 w-full max-w-none rounded-none border-0 bg-transparent p-0 shadow-none"

/**
 * The embed column: centered at the page max width, flush to the bottom of
 * the dock. Shadow and top radius sit on this box so it reads as floating
 * without a viewport-wide bar. No bottom inset — placement stays flush.
 */
export const PLAYER_BAR_SHELL_CLASS =
  "pointer-events-auto mx-auto w-full max-w-4xl overflow-hidden rounded-t-2xl bg-card shadow-[0_-8px_24px_rgba(60,64,67,0.14)]"

/**
 * Safe-area pad lives on the player, not the full-bleed wrapper, so only the
 * player paints down to the screen bottom. The sides stay transparent.
 */
export const PLAYER_BAR_SHELL_STYLE = {
  paddingBottom: "env(safe-area-inset-bottom, 0px)",
} as const

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
  padding: 0,
  transform: "none",
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
