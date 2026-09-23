"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Suggestion =
  | { type: "composer"; id: string; href: string; label: string; meta: string }
  | { type: "work"; id: string; href: string; label: string; meta: string }

export function SearchForm({
  className,
  autoFocus = false,
  defaultValue = "",
  size = "default",
}: {
  className?: string
  autoFocus?: boolean
  defaultValue?: string
  size?: "default" | "lg"
}) {
  const router = useRouter()
  const listId = useId()
  const rootRef = useRef<HTMLFormElement>(null)
  const [query, setQuery] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setSuggestions([])
      setSearched(false)
      setActiveIndex(-1)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          setSuggestions([])
          setSearched(true)
          return
        }
        const data = (await res.json()) as {
          composers: { id: string; complete_name: string; epoch: string }[]
          works: {
            id: string
            title: string
            genre: string
            composerId: string
            composerName: string
            compositionLabel?: string | null
          }[]
        }
        const next: Suggestion[] = [
          ...data.composers.map((composer) => ({
            type: "composer" as const,
            id: `c-${composer.id}`,
            href: `/composers/${composer.id}`,
            label: composer.complete_name,
            meta: composer.epoch,
          })),
          ...data.works.map((work) => ({
            type: "work" as const,
            id: `w-${work.id}`,
            href: `/works/${work.id}`,
            label: work.title,
            meta: [work.composerName, work.compositionLabel, work.genre].filter(Boolean).join(" · "),
          })),
        ]
        setSuggestions(next)
        setActiveIndex(-1)
        setSearched(true)
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return
        setSuggestions([])
        setSearched(true)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  const showList = open && query.trim().length >= 3 && (searched || suggestions.length > 0)
  const active = useMemo(
    () => (activeIndex >= 0 ? suggestions[activeIndex] : undefined),
    [activeIndex, suggestions]
  )

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <form
      ref={rootRef}
      action="/search"
      method="get"
      className={cn("relative", className)}
      role="search"
      onSubmit={(event) => {
        if (active) {
          event.preventDefault()
          go(active.href)
        }
      }}
    >
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="text"
        name="q"
        value={query}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Search composers or works"
        aria-label="Search composers or works"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active ? `${listId}-${active.id}` : undefined}
        role="combobox"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (!showList) return
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActiveIndex((index) => Math.max(index - 1, -1))
          } else if (event.key === "Escape") {
            event.preventDefault()
            setOpen(false)
          }
        }}
        className={cn(
          "rounded-full border-transparent bg-secondary pl-10 shadow-none focus-visible:border-transparent focus-visible:bg-card focus-visible:shadow-search focus-visible:ring-0",
          size === "lg" && "h-12 text-base md:text-base"
        )}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-border bg-card py-1 shadow-float"
        >
          {suggestions.length === 0 && searched ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">No matches</li>
          ) : null}
          {suggestions.map((item, index) => (
            <li key={item.id} id={`${listId}-${item.id}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => go(item.href)}
                className={cn(
                  "flex w-full flex-col items-start px-3 py-2 text-left text-sm text-foreground",
                  index === activeIndex ? "bg-accent" : "hover:bg-muted"
                )}
              >
                <span className="truncate">{item.label}</span>
                <span className="truncate text-xs text-muted-foreground">{item.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  )
}
