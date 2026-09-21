"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, LogOut, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDuration, type SpotifyRecording, type SpotifyTrackMatch } from "@/lib/spotify"
import {
  choosePlaybackEmbed,
  dedupePlaylistCreate,
  nextPlaybackAction,
  orderedTrackUris,
  parsePendingPlaylist,
  playlistCacheKey,
  rememberPlaylistCache,
  sanitizePlaylistCache,
  type CachedPlaylist,
  type PendingPlaylist,
  type PlaylistCreateResult,
} from "@/lib/spotify-playlist"

const PENDING_KEY = "cp_pending_playlist"
const CACHE_KEY = "cp_playlist_cache"

type Session = {
  connected: boolean
  displayName: string | null
  userId: string | null
}

function readPlaylistCache(): Record<string, CachedPlaylist> {
  try {
    return sanitizePlaylistCache(JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"))
  } catch {
    return {}
  }
}

function writePlaylistCache(cache: Record<string, CachedPlaylist>) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

async function postPlaylist(pending: PendingPlaylist): Promise<PlaylistCreateResult> {
  try {
    const res = await fetch("/api/spotify/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pending.name, uris: pending.uris }),
    })
    const data = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: string }
    if (res.status === 401) {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
      const returnTo = `${window.location.pathname}${window.location.search}`
      window.location.href = `/api/spotify/login?returnTo=${encodeURIComponent(returnTo)}`
      return { ok: false, error: "Not connected to Spotify", status: 401 }
    }
    if (!res.ok || !data.id) {
      return { ok: false, error: data.error || "Could not create the playlist.", status: res.status }
    }
    return {
      ok: true,
      playlist: {
        id: data.id,
        url: data.url ?? `https://open.spotify.com/playlist/${data.id}`,
      },
    }
  } catch {
    return { ok: false, error: "Could not create the playlist.", status: 0 }
  }
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

  const [preferSingleTrack, setPreferSingleTrack] = useState(false)
  const [playlists, setPlaylists] = useState<Record<string, CachedPlaylist>>({})
  const [playlistError, setPlaylistError] = useState<string | null>(null)
  const [playlistBusy, setPlaylistBusy] = useState(false)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [session, setSession] = useState<Session>({ connected: false, displayName: null, userId: null })
  const mountedRef = useRef(true)

  const movementCount = selectedRecording?.tracks.length ?? 0
  const playlistForSelection = selectedRecording ? playlists[selectedRecording.id] ?? null : null
  const playingAll = movementCount > 1 && Boolean(playlistForSelection) && !preferSingleTrack

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!oauthConfigured) return
    let cancelled = false
    fetch("/api/spotify/session")
      .then((res) => res.json())
      .then((data: Partial<Session>) => {
        if (cancelled) return
        setSession({
          connected: Boolean(data.connected),
          displayName: data.displayName ?? null,
          userId: data.userId ?? null,
        })
      })
      .catch(() => {
        if (!cancelled) setSession({ connected: false, displayName: null, userId: null })
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

  function storePlaylist(recordingId: string, userId: string | null, uris: string[], playlist: CachedPlaylist) {
    setPlaylists((current) => {
      if (current[recordingId]?.id === playlist.id) return current
      return { ...current, [recordingId]: playlist }
    })
    if (!userId) return
    const key = playlistCacheKey(userId, uris)
    writePlaylistCache(rememberPlaylistCache(readPlaylistCache(), key, playlist))
  }

  function startPlaylist(pending: PendingPlaylist, userId: string | null) {
    const key = playlistCacheKey(userId || "session", pending.uris)
    setPlaylistBusy(true)
    setPlaylistError(null)
    setFailedKey((current) => (current === key ? null : current))
    return dedupePlaylistCreate(key, () => postPlaylist(pending)).then((result) => {
      if (!mountedRef.current) return
      setPlaylistBusy(false)
      if (result.ok) {
        storePlaylist(pending.recordingId, userId, pending.uris, result.playlist)
        return
      }
      setFailedKey(key)
      if (result.status === 401) return
      setPlaylistError(result.error)
    })
  }

  useEffect(() => {
    if (!oauthConfigured || !selectedRecording) return
    const uris = orderedTrackUris(selectedRecording.tracks)
    if (uris.length < 2) return

    const recordingId = selectedRecording.id
    const userId = session.userId
    const connected = Boolean(session.connected && userId)
    const cached = userId ? readPlaylistCache()[playlistCacheKey(userId, uris)] ?? null : null
    const hasPlaylist = Boolean(playlists[recordingId]?.id)

    const rawPending = sessionStorage.getItem(PENDING_KEY)
    if (rawPending && connected && userId) {
      const pending = parsePendingPlaylist(rawPending)
      if (!pending) {
        sessionStorage.removeItem(PENDING_KEY)
      } else if (
        recordings.some((recording) => recording.id === pending.recordingId) &&
        pending.recordingId !== recordingId
      ) {
        setPreferSingleTrack(false)
        setSelectedRecordingId(pending.recordingId)
        return
      } else if (pending.recordingId === recordingId) {
        const pendingKey = playlistCacheKey(userId, pending.uris)
        if (!hasPlaylist && !cached && (playlistBusy || failedKey === pendingKey)) return
        sessionStorage.removeItem(PENDING_KEY)
        if (!hasPlaylist && !cached) {
          setPreferSingleTrack(false)
          void startPlaylist(pending, userId)
          return
        }
      } else {
        sessionStorage.removeItem(PENDING_KEY)
      }
    }

    const action = nextPlaybackAction({
      trackCount: uris.length,
      hasPlaylist,
      cached,
    })

    if (action.type === "embed-cached") {
      setPlaylists((current) => {
        if (current[recordingId]?.id === action.id) return current
        return { ...current, [recordingId]: { id: action.id, url: action.url } }
      })
    }
    // startPlaylist is recreated each render and closes over stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    oauthConfigured,
    selectedRecording,
    session.connected,
    session.userId,
    preferSingleTrack,
    playlists,
    playlistBusy,
    failedKey,
    recordings,
  ])

  function handlePlayAll() {
    if (!selectedRecording) return
    const uris = orderedTrackUris(selectedRecording.tracks)
    if (uris.length < 2) return
    setPreferSingleTrack(false)
    if (playlists[selectedRecording.id]?.id) return
    if (session.userId) {
      const cached = readPlaylistCache()[playlistCacheKey(session.userId, uris)]
      if (cached) {
        storePlaylist(selectedRecording.id, session.userId, uris, cached)
        setPlaylistError(null)
        return
      }
    }
    void startPlaylist(
      { name: playlistName, uris, recordingId: selectedRecording.id },
      session.userId
    )
  }

  async function handleLogout() {
    await fetch("/api/spotify/logout", { method: "POST" })
    setSession({ connected: false, displayName: null, userId: null })
  }

  const embed = useMemo(
    () =>
      choosePlaybackEmbed({
        trackCount: movementCount,
        playlistId: playlistForSelection?.id ?? null,
        playlistTitle: playlistName,
        selectedTrack: selectedTrack ? { id: selectedTrack.id, name: selectedTrack.name } : null,
        preferSingleTrack,
      }),
    [movementCount, playlistForSelection, playlistName, selectedTrack, preferSingleTrack]
  )

  const playAllDetail = !oauthConfigured
    ? "Sequential playback needs Spotify login, which is not configured on this server."
    : playingAll
      ? `These ${movementCount} movements are in a private playlist. Press play in the player and Spotify continues in order.`
      : playlistBusy
        ? "Creating a private Spotify playlist of these movements…"
        : session.connected
          ? `Saves a private playlist of these ${movementCount} tracks so Spotify plays them back to back.`
          : `Signs you in to Spotify once, then saves a private playlist of these ${movementCount} tracks and plays them in order.`

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

      {selectedRecording && movementCount > 1 && (
        <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-accent/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium text-navy">Play all movements in order</p>
            <p id="play-all-detail" className="text-sm text-muted-foreground">
              {playAllDetail}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {oauthConfigured ? (
              <Button
                type="button"
                size="lg"
                onClick={handlePlayAll}
                disabled={playlistBusy}
                aria-pressed={playingAll}
                aria-describedby="play-all-detail"
              >
                <Play className="h-4 w-4" />
                {playlistBusy ? "Preparing playlist…" : "Play all"}
              </Button>
            ) : (
              <Button variant="outline" size="lg" asChild>
                <a href={selectedRecording.tracks[0]?.url} target="_blank" rel="noopener noreferrer">
                  Open first movement
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            {playlistForSelection?.url && (
              <Button variant="outline" size="lg" asChild>
                <a href={playlistForSelection.url} target="_blank" rel="noopener noreferrer">
                  Open playlist
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
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

      {selectedTrack?.previewUrl && !playingAll && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">30-second preview (no Premium required)</p>
          <audio controls preload="none" src={selectedTrack.previewUrl} className="w-full">
            Your browser does not support audio previews.
          </audio>
        </div>
      )}

      {selectedRecording && (
        <div className="space-y-3">
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

          <p className="text-sm text-muted-foreground">
            {movementCount > 1
              ? playingAll
                ? "This group is lined up in order. Choose a movement to hear only that track."
                : "Choose a movement to play it on its own, or use Play all for the whole group."
              : "Matched track for this work."}
          </p>

          <ul className="divide-y divide-border overflow-hidden rounded-md border border-primary/15 bg-card">
            {selectedRecording.tracks.map((track) => {
              const active = preferSingleTrack && selectedTrack?.id === track.id
              return (
                <li key={track.id}>
                  <div className={`flex items-center gap-3 p-3 ${active ? "bg-accent/80" : ""}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setPreferSingleTrack(true)
                        setSelectedTrackId(track.id)
                      }}
                      aria-pressed={active}
                      title={movementCount > 1 ? "Play only this movement" : undefined}
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
                      setPreferSingleTrack(false)
                      setPlaylistError(null)
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
          Results are individual tracks (and movement groups) for this work, not full albums. Play all saves a
          private playlist of just these movements, in order, and the embed plays that playlist straight through.
          Choosing one movement plays only that track. The embed plays a preview unless you are logged into Spotify
          in this browser.
        </p>
      )}
    </section>
  )
}
