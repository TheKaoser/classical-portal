"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"

export type PortalVariant = "modern" | "antique"

type PortalLayout = {
  diameter: number
  padBottom: number
}

const CONTENT_SELECTOR = "h1 [aria-hidden='true'], a"

function boundsOf(element: Element): DOMRect {
  if (element.tagName === "P") {
    const range = document.createRange()
    range.selectNodeContents(element)
    const rect = range.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return rect
  }
  return element.getBoundingClientRect()
}

function measureContent(root: HTMLElement): PortalLayout | null {
  const nodes = [
    ...root.querySelectorAll(CONTENT_SELECTOR),
    ...root.querySelectorAll("p"),
  ]
  if (nodes.length === 0) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const node of nodes) {
    const rect = boundsOf(node)
    if (rect.width <= 0 || rect.height <= 0) continue
    minX = Math.min(minX, rect.left)
    minY = Math.min(minY, rect.top)
    maxX = Math.max(maxX, rect.right)
    maxY = Math.max(maxY, rect.bottom)
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null

  const width = maxX - minX
  const height = maxY - minY
  if (width <= 0 || height <= 0) return null

  // Extra radius so the stroke clears the corner of the widest/tallest item.
  const gap = width < 480 ? 22 : 40
  const diameter = Math.ceil(Math.hypot(width, height) + gap * 2)
  const padBottom = Math.max(0, Math.ceil((diameter - height) / 2))
  return { diameter, padBottom }
}

export function HomePortal({
  variant,
  children,
}: {
  variant: PortalVariant
  children: ReactNode
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<PortalLayout | null>(null)

  useLayoutEffect(() => {
    const root = contentRef.current
    if (!root) return

    let cancelled = false
    const update = () => {
      if (cancelled) return
      const next = measureContent(root)
      setLayout((current) => {
        if (
          current &&
          next &&
          current.diameter === next.diameter &&
          current.padBottom === next.padBottom
        ) {
          return current
        }
        return next
      })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(root)
    for (const node of root.querySelectorAll(CONTENT_SELECTOR)) {
      observer.observe(node)
    }
    void document.fonts?.ready.then(update)
    window.addEventListener("resize", update)

    return () => {
      cancelled = true
      observer.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [])

  return (
    <div
      className="home-portal relative isolate"
      data-portal={variant}
      style={layout ? { paddingBottom: layout.padBottom } : undefined}
    >
      {layout ? (
        <div
          aria-hidden="true"
          className="portal-ring pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 rounded-full"
          style={{
            width: layout.diameter,
            height: layout.diameter,
            top: -layout.padBottom,
          }}
        />
      ) : null}
      <div ref={contentRef} className="relative z-10">
        {children}
      </div>
    </div>
  )
}
