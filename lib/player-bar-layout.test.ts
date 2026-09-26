import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  PLAYER_BAR_DOCK_CLASS,
  PLAYER_BAR_DOCK_STYLE,
  PLAYER_BAR_FALLBACK_HEIGHT_PX,
  PLAYER_BAR_HEIGHT_VAR,
  PLAYER_BAR_SHELL_CLASS,
  PLAYER_BAR_SHELL_STYLE,
  isFloatingPlayerInset,
  playerBarPaddingCss,
} from "./player-bar-layout.ts"

test("player bar docks flush to the viewport edges", () => {
  assert.equal(PLAYER_BAR_DOCK_STYLE.position, "fixed")
  assert.equal(PLAYER_BAR_DOCK_STYLE.bottom, 0)
  assert.equal(PLAYER_BAR_DOCK_STYLE.left, 0)
  assert.equal(PLAYER_BAR_DOCK_STYLE.right, 0)
  assert.equal(PLAYER_BAR_DOCK_STYLE.margin, 0)
  assert.equal(PLAYER_BAR_DOCK_STYLE.padding, 0)
  assert.equal(PLAYER_BAR_DOCK_STYLE.top, "auto")
  assert.equal(PLAYER_BAR_DOCK_STYLE.transform, "none")
  assert.match(PLAYER_BAR_SHELL_STYLE.paddingBottom, /safe-area-inset-bottom/)
})

test("player dock is a transparent click-through wrapper", () => {
  assert.equal(isFloatingPlayerInset(PLAYER_BAR_DOCK_CLASS), false)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\bfixed\b/)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\bbottom-0\b/)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\binset-x-0\b/)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\bm-0\b/)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\brounded-none\b/)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\bpointer-events-none\b/)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\bbg-transparent\b/)
  assert.match(PLAYER_BAR_DOCK_CLASS, /\bshadow-none\b/)
  assert.doesNotMatch(PLAYER_BAR_DOCK_CLASS, /\bshadow-float\b/)
  assert.doesNotMatch(PLAYER_BAR_DOCK_CLASS, /\bbg-card\b/)
  assert.doesNotMatch(PLAYER_BAR_DOCK_CLASS, /\bborder-t\b/)
  assert.doesNotMatch(PLAYER_BAR_DOCK_CLASS, /\bborder-border\b/)
})

test("player shell stays the embed width and keeps its own chrome", () => {
  assert.match(PLAYER_BAR_SHELL_CLASS, /\bpointer-events-auto\b/)
  assert.match(PLAYER_BAR_SHELL_CLASS, /\bmx-auto\b/)
  assert.match(PLAYER_BAR_SHELL_CLASS, /\bw-full\b/)
  assert.match(PLAYER_BAR_SHELL_CLASS, /\bmax-w-4xl\b/)
  assert.match(PLAYER_BAR_SHELL_CLASS, /\bbg-card\b/)
  assert.match(PLAYER_BAR_SHELL_CLASS, /\brounded-t-2xl\b/)
  assert.match(PLAYER_BAR_SHELL_CLASS, /\boverflow-hidden\b/)
  assert.equal(isFloatingPlayerInset(PLAYER_BAR_SHELL_CLASS), false)
  assert.doesNotMatch(PLAYER_BAR_SHELL_CLASS, /\bpb-3\b/)
  assert.doesNotMatch(PLAYER_BAR_SHELL_CLASS, /\bpb-4\b/)
})

test("footer clearance equals measured player height", () => {
  assert.equal(playerBarPaddingCss(148.2), "149px")
  assert.equal(playerBarPaddingCss(0), `${PLAYER_BAR_FALLBACK_HEIGHT_PX}px`)
  assert.equal(playerBarPaddingCss(Number.NaN), `${PLAYER_BAR_FALLBACK_HEIGHT_PX}px`)
  assert.equal(PLAYER_BAR_HEIGHT_VAR, "--player-bar-height")
})

test("player controls sit on the shell and accept clicks", () => {
  const source = readFileSync(new URL("../components/spotify-embed-player.tsx", import.meta.url), "utf8")
  assert.match(source, /className=\{visible \? PLAYER_BAR_DOCK_CLASS : "hidden"\}/)
  assert.match(source, /className=\{PLAYER_BAR_SHELL_CLASS\}/)
  assert.match(source, /style=\{PLAYER_BAR_SHELL_STYLE\}/)
  assert.match(source, /data-player-shell/)
  assert.match(source, /Tap play to continue/)
  assert.match(
    source,
    /pointer-events-auto flex items-center justify-between gap-3 border-b border-border bg-card/,
  )
  assert.match(source, /pointer-events-auto shrink-0 cursor-pointer rounded-full bg-primary/)
  assert.match(source, /pointer-events-auto h-\[152px\] w-full overflow-hidden bg-card/)
})

test("hidden player dock does not reserve space under the footer", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
  assert.match(css, /body:has\(\[data-player-dock="flush"\]:not\(\[hidden\]\)\) footer/)
  assert.match(css, /padding-bottom:\s*calc\(2rem \+ var\(--player-bar-height, 9\.5rem\)\)/)
  assert.doesNotMatch(css, /body:has\(\[data-player-dock="flush"\]\)\s*\{/)
})

test("detects the leftover Google floating-card classes", () => {
  assert.equal(
    isFloatingPlayerInset("pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4"),
    true,
  )
  assert.equal(isFloatingPlayerInset("mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-card"), true)
  assert.equal(isFloatingPlayerInset(PLAYER_BAR_DOCK_CLASS), false)
})
