"use client"

import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import { SpotifyRecordings } from "@/components/spotify-recordings"
import { Button } from "@/components/ui/button"
import { SPOTIFY_RECORDINGS_UNAVAILABLE } from "@/lib/spotify-quota"
import type { SpotifyMatches } from "@/lib/spotify-model"

type Phase = "idle" | "loading" | "ready" | "unavailable" | "crawler"

/**
 * Recordings load after the page is on screen. The work page itself does not
 * call Spotify, so a crawler that only reads HTML never searches.
 */
export function WorkSpotifyRecordings({
  workId,
  searchUrl,
}: {
  workId: string
  searchUrl: string
}) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [match, setMatch] = useState<SpotifyMatches | null>(null)

  useEffect(() => {
    let cancelled = false
    setPhase("loading")
    const url = `/api/spotify/recordings?id=${encodeURIComponent(workId)}`
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as SpotifyMatches | null
        if (cancelled) return
        if (data?.skipped === "crawler") {
          setPhase("crawler")
          return
        }
        if (!data || data.unavailable || !res.ok) {
          setPhase("unavailable")
          return
        }
        setMatch(data)
        setPhase("ready")
      })
      .catch(() => {
        if (!cancelled) setPhase("unavailable")
      })
    return () => {
      cancelled = true
    }
  }, [workId])

  if (phase === "ready" && match) {
    return (
      <SpotifyRecordings
        configured={match.configured}
        searchUrl={searchUrl || match.searchUrl}
        recordings={match.recordings}
      />
    )
  }

  const status =
    phase === "loading" ? "Finding recordings…" : phase === "unavailable" ? SPOTIFY_RECORDINGS_UNAVAILABLE : null

  return (
    <section className="space-y-4" aria-busy={phase === "loading" ? true : undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium tracking-tight text-foreground">On Spotify</h2>
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
        >
          Search on Spotify
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {phase === "unavailable" ? (
        <Button asChild>
          <a href={searchUrl} target="_blank" rel="noopener noreferrer">
            Open in Spotify
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      ) : null}
    </section>
  )
}
