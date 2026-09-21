"use client"

import { useMemo, useState } from "react"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDuration, type SpotifyAlbumMatch, type SpotifyTrackMatch } from "@/lib/spotify"

type Playable =
  | { kind: "album"; item: SpotifyAlbumMatch }
  | { kind: "track"; item: SpotifyTrackMatch }

export function SpotifyRecordings({
  configured,
  searchUrl,
  albums,
  tracks,
}: {
  configured: boolean
  searchUrl: string
  albums: SpotifyAlbumMatch[]
  tracks: SpotifyTrackMatch[]
}) {
  const items = useMemo<Playable[]>(
    () => [
      ...albums.map((item) => ({ kind: "album" as const, item })),
      ...tracks.map((item) => ({ kind: "track" as const, item })),
    ],
    [albums, tracks]
  )

  const [selectedKey, setSelectedKey] = useState(() =>
    items[0] ? `${items[0].kind}:${items[0].item.id}` : ""
  )

  const selected = items.find((entry) => `${entry.kind}:${entry.item.id}` === selectedKey) ?? items[0]
  const selectedTrack = selected?.kind === "track" ? selected.item : null

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-xl tracking-tight text-navy">On Spotify</h2>
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

      {!configured && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Matching recordings appear here once Spotify API credentials are set on the server.
          </p>
          <Button asChild>
            <a href={searchUrl} target="_blank" rel="noopener noreferrer">
              Open in Spotify
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      )}

      {configured && items.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No close catalog matches. Search the work on Spotify instead.
          </p>
          <Button asChild>
            <a href={searchUrl} target="_blank" rel="noopener noreferrer">
              Open in Spotify
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      )}

      {selected && (
        <div className="overflow-hidden rounded-md border border-primary/15 bg-card shadow-sm">
          <iframe
            key={`${selected.kind}:${selected.item.id}`}
            title={selected.item.name}
            src={`https://open.spotify.com/embed/${selected.kind}/${selected.item.id}`}
            width="100%"
            height={selected.kind === "album" ? 352 : 152}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="block w-full"
          />
        </div>
      )}

      {selectedTrack?.previewUrl && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">30-second preview (no Premium required)</p>
          <audio controls preload="none" src={selectedTrack.previewUrl} className="w-full">
            Your browser does not support audio previews.
          </audio>
        </div>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-primary/15 bg-card">
          {items.map((entry) => {
            const key = `${entry.kind}:${entry.item.id}`
            const active = selected ? `${selected.kind}:${selected.item.id}` === key : false
            return (
              <li key={key}>
                <div className={`flex items-center gap-3 p-3 ${active ? "bg-accent/80" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    {entry.item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.item.image}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                    <span className="min-w-0">
                      <span className={`block truncate text-sm ${active ? "font-medium text-primary" : ""}`}>
                        {entry.item.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {entry.kind === "album"
                          ? `${entry.item.artists}${entry.item.totalTracks ? ` · ${entry.item.totalTracks} tracks` : ""}`
                          : `${entry.item.artists}${entry.item.durationMs ? ` · ${formatDuration(entry.item.durationMs)}` : ""}`}
                      </span>
                    </span>
                  </button>
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <a href={entry.item.url} target="_blank" rel="noopener noreferrer">
                      Open
                    </a>
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {items.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          The embed plays a preview unless you are logged into Spotify in this browser. Full-track
          in-browser playback (Web Playback SDK) needs Premium and is not enabled here. Opening a
          recording in Spotify works on Free and Premium.
        </p>
      )}
    </section>
  )
}
