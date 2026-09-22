import assert from "node:assert/strict"
import test from "node:test"
import {
  PLAYER_BAR_DOCK_CLASS,
  PLAYER_BAR_DOCK_STYLE,
  PLAYER_BAR_FALLBACK_HEIGHT_PX,
  PLAYER_BAR_HEIGHT_VAR,
  isFloatingPlayerInset,
  playerBarPaddingCss,
} from "./player-bar-layout.ts"

test("player bar docks flush to the viewport edges", () => {
  assert.equal(PLAYER_BAR_DOCK_STYLE.position, "fixed")
  assert.equal(PLAYER_BAR_DOCK_STYLE.bottom, 0)
  assert.equal(PLAYER_BAR_DOCK_STYLE.left, 0)
  assert.equal(PLAYER_BAR_DOCK_STYLE.right, 0)
  assert.equal(PLAYER_BAR_DOCK_STYLE.margin, 0)
  assert.equal(PLAYER_BAR_DOCK_STYLE.top, "auto")
  assert.equal(PLAYER_BAR_DOCK_STYLE.transform, "none")
  assert.match(PLAYER_BAR_DOCK_STYLE.paddingBottom, /safe-area-inset-bottom/)
})

test("player bar class list has no floating-card inset or rounded shell", () => {
  assert.equal(isFloatingPlayerInset(PLAYER_BAR_DOCK_CLASS), false)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\bfixed\b/)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\bbottom-0\b/)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\binset-x-0\b/)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\bm-0\b/)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\brounded-none\b/)
  assert.doesNotMatch(PLAYER_BAR_DOCK_CLASS, /\bshadow-float\b/)
})

test("body padding equals measured player height", () => {
  assert.equal(playerBarPaddingCss(148.2), "149px")
  assert.equal(playerBarPaddingCss(0), `${PLAYER_BAR_FALLBACK_HEIGHT_PX}px`)
  assert.equal(playerBarPaddingCss(Number.NaN), `${PLAYER_BAR_FALLBACK_HEIGHT_PX}px`)
  assert.equal(PLAYER_BAR_HEIGHT_VAR, "--player-bar-height")
})

test("detects the leftover Google floating-card classes", () => {
  assert.equal(
    isFloatingPlayerInset("pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4"),
    true,
  )
  assert.equal(isFloatingPlayerInset("mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-card"), true)
  assert.equal(isFloatingPlayerInset(PLAYER_BAR_DOCK_CLASS), false)
})
