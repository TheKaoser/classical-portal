"use client"

import { useEffect, useMemo, useState } from "react"
import { ExternalLink, ListMusic, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDuration, type SpotifyRecording, type SpotifyTrackMatch } from "@/lib/spotify"

const PENDING_KEY = "cp_pending_playlist"

type PendingPlaylist = {
  name: string
  uris: string[]
}

type Session = {
  connected: boolean
  displayName: string | null
}

export function SpotifyRecordings({
  configured,
  oauthConfigured,
  searchUrl,
  recordings,
  playlistName,
}: {
  configured: boolean
  oauthConfigured: boolean
  searchUrl: string
  recordings: SpotifyRecording[]
  playlistName: string
}) {
  const [selectedRecordingId, setSelectedRecordingId] = useState(recordings[0]?.id ?? "")
  const selectedRecording =
    recordings.find((recording) => recording.id === selectedRecordingId) ?? recordings[0] ?? null

  const [selectedTrackId, setSelectedTrackId] = useState(selectedRecording?.tracks[0]?.id ?? "")
  const selectedTrack: SpotifyTrackMatch | null =
    selectedRecording?.tracks.find((track) => track.id === selectedTrackId) ??
    selectedRecording?.tracks[0] ??
    null

  const [playlistId, setPlaylistId] = useState<string | null>(null)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [playlistError, setPlaylistError] = useState<string | null>(null)
  const [playlistBusy, setPlaylistBusy] = useState(false)
  const [session, setSession] = useState<Session>({ connected: false, displayName: null })

  useEffect(() => {
    if (!oauthConfigured) return
    let cancelled = false
    fetch("/api/spotify/session")
      .then((res) => res.json())
      .then((data: Session) => {
        if (!cancelled) setSession(data)
      })
      .catch(() => {
        if (!cancelled) setSession({ connected: false, displayName: null })
      })
    return () => {
      cancelled = true
    }
  }, [oauthConfigured])

  useEffect(() => {
    if (!selectedRecording) return
    if (!selectedRecording.tracks.some((track) => track.id === selectedTrackId)) {
      setSelectedTrackId(selectedRecording.tracks[0]?.id ?? "")
    }
  }, [selectedRecording, selectedTrackId])

  useEffect(() => {
    if (!oauthConfigured || !session.connected) return
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return
    sessionStorage.removeItem(PENDING_KEY)
    try {
      const pending = JSON.parse(raw) as PendingPlaylist
      void createPlaylist(pending.name, pending.uris)
    } catch {
      // ignore malformed pending payload
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthConfigured, session.connected])

  const embed = useMemo(() => {
    if (playlistId) {
      return { kind: "playlist" as const, id: playlistId, title: playlistName, height: 352 }
    }
    if (selectedTrack) {
      return { kind: "track" as const, id: selectedTrack.id, title: selectedTrack.name, height: 152 }
    }
    return null
  }, [playlistId, playlistName, selectedTrack])

  async function createPlaylist(name: string, uris: string[]) {
    setPlaylistBusy(true)
    setPlaylistError(null)
    try {
      const res = await fetch("/api/spotify/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, uris }),
      })
      if (res.status === 401) {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ name, uris }))
        const returnTo = `${window.location.pathname}${window.location.search}`
        window.location.href = `/api/spotify/login?returnTo=${encodeURIComponent(returnTo)}`
        return
      }
      const data = (await res.json()) as { id?: string; url?: string; error?: string }
      if (!res.ok || !data.id) {
        setPlaylistError(data.error || "Could not create the playlist.")
        return
      }
      setPlaylistId(data.id)
      setPlaylistUrl(data.url ?? `https://open.spotify.com/playlist/${data.id}`)
    } catch {
      setPlaylistError("Could not create the playlist.")
    } finally {
      setPlaylistBusy(false)
    }
  }

  function handleCreatePlaylist() {
    if (!selectedRecording?.tracks.length) return
    void createPlaylist(
      playlistName,
      selectedRecording.tracks.map((track) => track.uri)
    )
  }

  async function handleLogout() {
    await fetch("/api/spotify/logout", { method: "POST" })
    setSession({ connected: false, displayName: null })
  }

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

      {configured && recordings.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No close catalog matches for this work. Search the work on Spotify instead.
          </p>
          <Button asChild>
            <a href={searchUrl} target="_blank" rel="noopener noreferrer">
              Open in Spotify
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      )}

      {embed && (
        <div className="overflow-hidden rounded-md border border-primary/15 bg-card shadow-sm">
          <iframe
            key={`${embed.kind}:${embed.id}`}
            title={embed.title}
            src={`https://open.spotify.com/embed/${embed.kind}/${embed.id}`}
            width="100%"
            height={embed.height}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="block w-full"
          />
        </div>
      )}

      {selectedTrack?.previewUrl && !playlistId && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">30-second preview (no Premium required)</p>
          <audio controls preload="none" src={selectedTrack.previewUrl} className="w-full">
            Your browser does not support audio previews.
          </audio>
        </div>
      )}

      {selectedRecording && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {selectedRecording.tracks.length > 1
                ? `${selectedRecording.tracks.length} matching tracks from this recording — not the whole album.`
                : "Matched track for this work."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {oauthConfigured && selectedRecording.tracks.length > 1 && (
                <Button size="sm" onClick={handleCreatePlaylist} disabled={playlistBusy}>
                  <ListMusic className="h-4 w-4" />
                  {playlistId ? "Playlist created" : "Create playlist on Spotify"}
                </Button>
              )}
              {!oauthConfigured && selectedRecording.tracks.length > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <a href={selectedRecording.tracks[0].url} target="_blank" rel="noopener noreferrer">
                    Open these tracks in Spotify
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {playlistUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={playlistUrl} target="_blank" rel="noopener noreferrer">
                    Open playlist
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
          {playlistError && <p className="text-sm text-destructive">{playlistError}</p>}
          {oauthConfigured && session.connected && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              Signed in as {session.displayName || "Spotify"}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-1 text-primary hover:text-primary-hover"
              >
                <LogOut className="h-3 w-3" />
                Disconnect
              </button>
            </p>
          )}

          <ul className="divide-y divide-border overflow-hidden rounded-md border border-primary/15 bg-card">
            {selectedRecording.tracks.map((track) => {
              const active = selectedTrack?.id === track.id && !playlistId
              return (
                <li key={track.id}>
                  <div className={`flex items-center gap-3 p-3 ${active ? "bg-accent/80" : ""}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setPlaylistId(null)
                        setSelectedTrackId(track.id)
                      }}
                      aria-pressed={active}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      {track.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={track.image}
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
                          {track.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {track.artists}
                          {track.durationMs ? ` · ${formatDuration(track.durationMs)}` : ""}
                        </span>
                      </span>
                    </button>
                    <Button variant="outline" size="sm" asChild className="shrink-0">
                      <a href={track.url} target="_blank" rel="noopener noreferrer">
                        Open
                      </a>
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {recordings.length > 1 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-navy">Recordings of this work</h3>
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-primary/15 bg-card">
            {recordings.map((recording) => {
              const active = selectedRecording?.id === recording.id
              return (
                <li key={recording.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaylistId(null)
                      setPlaylistUrl(null)
                      setSelectedRecordingId(recording.id)
                      setSelectedTrackId(recording.tracks[0]?.id ?? "")
                    }}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 p-3 text-left ${active ? "bg-accent/80" : ""}`}
                  >
                    {recording.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={recording.image}
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
                        {recording.album || recording.artists}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {recording.artists}
                        {recording.tracks.length > 1 ? ` · ${recording.tracks.length} tracks` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {recordings.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Results are individual tracks (and movement groups) for this work, not full albums. The embed
          plays a preview unless you are logged into Spotify in this browser. Create a playlist to queue
          only these movements. Opening a track in Spotify works on Free and Premium.
        </p>
      )}
    </section>
  )
}
