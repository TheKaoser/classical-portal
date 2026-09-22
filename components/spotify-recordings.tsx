"use client"

import { useEffect, useRef, useState } from "react"
import { ExternalLink, LogOut, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SpotifyWebPlayer, type PlaybackIssue } from "@/components/spotify-web-player"
import { formatDuration, type SpotifyRecording, type SpotifyTrackMatch } from "@/lib/spotify"
import {
  orderedTrackUris,
  parsePendingPlayback,
  PREMIUM_REQUIRED_MESSAGE,
  type PendingPlayback,
} from "@/lib/spotify-playback"
import {
  dedupePlaylistCreate,
  nextPlaybackAction,
  parsePendingPlaylist,
  playlistCacheKey,
  rememberPlaylistCache,
  sanitizePlaylistCache,
  type CachedPlaylist,
  type PendingPlaylist,
  type PlaylistCreateResult,
} from "@/lib/spotify-playlist"

const PENDING_PLAYLIST_KEY = "cp_pending_playlist"
const PENDING_PLAYBACK_KEY = "cp_pending_playback"
const CACHE_KEY = "cp_playlist_cache"

type Session = {
  connected: boolean
  displayName: string | null
  userId: string | null
  product: string | null
  premium: boolean | null
}

type PlayRequest = {
  recordingId: string
  uris: string[]
  position: number
  generation: number
}

const EMPTY_SESSION: Session = {
  connected: false,
  displayName: null,
  userId: null,
  product: null,
  premium: null,
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

function loginHref(reconnect: boolean) {
  const returnTo = `${window.location.pathname}${window.location.search}`
  const params = new URLSearchParams({ returnTo })
  if (reconnect) params.set("reconnect", "1")
  return `/api/spotify/login?${params.toString()}`
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
      sessionStorage.setItem(PENDING_PLAYLIST_KEY, JSON.stringify(pending))
      window.location.href = loginHref(false)
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

  const [playlists, setPlaylists] = useState<Record<string, CachedPlaylist>>({})
  const [playlistError, setPlaylistError] = useState<string | null>(null)
  const [playlistBusy, setPlaylistBusy] = useState(false)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [session, setSession] = useState<Session>(EMPTY_SESSION)
  const [playRequest, setPlayRequest] = useState<PlayRequest | null>(null)
  const [playerPhase, setPlayerPhase] = useState<"idle" | "connecting" | "playing" | "paused">("idle")
  const [activeUri, setActiveUri] = useState<string | null>(null)
  const [premiumBlocked, setPremiumBlocked] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [noticeAction, setNoticeAction] = useState<null | "login" | "reconnect">(null)
  const mountedRef = useRef(true)
  const playbackResumeRef = useRef(false)
  const generationRef = useRef(0)

  const movementCount = selectedRecording?.tracks.length ?? 0
  const playlistForSelection = selectedRecording ? playlists[selectedRecording.id] ?? null : null
  const playingThisGroup = Boolean(playRequest) && playRequest?.recordingId === selectedRecording?.id

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
          product: data.product ?? null,
          premium: typeof data.premium === "boolean" ? data.premium : null,
        })
      })
      .catch(() => {
        if (!cancelled) setSession(EMPTY_SESSION)
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
    if (!oauthConfigured || !session.connected || !session.userId || !selectedRecording) return
    const uris = orderedTrackUris(selectedRecording.tracks)
    const recordingId = selectedRecording.id
    const cached = readPlaylistCache()[playlistCacheKey(session.userId, uris)] ?? null
    const action = nextPlaybackAction({
      trackCount: uris.length,
      hasPlaylist: Boolean(playlists[recordingId]?.id),
      cached,
    })
    if (action.type === "embed-cached") {
      setPlaylists((current) => {
        if (current[recordingId]?.id === action.id) return current
        return { ...current, [recordingId]: { id: action.id, url: action.url } }
      })
    }
    // Restores a saved playlist only. It does not create one or start playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthConfigured, selectedRecording, session.connected, session.userId, playlists])

  useEffect(() => {
    if (!oauthConfigured || !session.connected || !session.userId) return
    const rawPending = sessionStorage.getItem(PENDING_PLAYLIST_KEY)
    if (!rawPending) return
    const pending = parsePendingPlaylist(rawPending)
    if (!pending || !recordings.some((recording) => recording.id === pending.recordingId)) {
      sessionStorage.removeItem(PENDING_PLAYLIST_KEY)
      return
    }
    const userId = session.userId
    const cached = readPlaylistCache()[playlistCacheKey(userId, pending.uris)] ?? null
    const key = playlistCacheKey(userId, pending.uris)
    if (playlistBusy || failedKey === key) return
    sessionStorage.removeItem(PENDING_PLAYLIST_KEY)
    setSelectedRecordingId(pending.recordingId)
    if (cached) {
      storePlaylist(pending.recordingId, userId, pending.uris, cached)
      return
    }
    void startPlaylist(pending, userId)
    // startPlaylist closes over stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthConfigured, recordings, session.connected, session.userId, playlistBusy, failedKey])

  useEffect(() => {
    if (!oauthConfigured || !session.connected || playbackResumeRef.current) return
    let pending: PendingPlayback | null = null
    try {
      const raw = sessionStorage.getItem(PENDING_PLAYBACK_KEY)
      if (!raw) return
      pending = parsePendingPlayback(raw)
      sessionStorage.removeItem(PENDING_PLAYBACK_KEY)
    } catch {
      return
    }
    if (!pending || !recordings.some((recording) => recording.id === pending.recordingId)) return
    playbackResumeRef.current = true
    setSelectedRecordingId(pending.recordingId)
    if (session.premium === false) {
      setPremiumBlocked(true)
      return
    }
    generationRef.current += 1
    setPlayerPhase("connecting")
    setPlayRequest({
      recordingId: pending.recordingId,
      uris: pending.uris,
      position: pending.position,
      generation: generationRef.current,
    })
  }, [oauthConfigured, recordings, session.connected, session.premium])

  function requestPlayback(recordingId: string, uris: string[], position: number) {
    setNotice(null)
    setNoticeAction(null)
    if (!oauthConfigured) {
      setNotice("Sequential playback needs Spotify login, which is not configured on this server.")
      return
    }
    if (!session.connected) {
      try {
        sessionStorage.removeItem(PENDING_PLAYLIST_KEY)
        sessionStorage.setItem(PENDING_PLAYBACK_KEY, JSON.stringify({ recordingId, uris, position }))
      } catch {
        setNotice("Spotify login needs browser storage, which is blocked.")
        return
      }
      window.location.href = loginHref(false)
      return
    }
    if (session.premium === false) {
      setPlayRequest(null)
      setPremiumBlocked(true)
      return
    }
    setPremiumBlocked(false)
    generationRef.current += 1
    setPlayerPhase("connecting")
    setPlayRequest({ recordingId, uris, position, generation: generationRef.current })
  }

  function handlePlayAll() {
    if (!selectedRecording) return
    const uris = orderedTrackUris(selectedRecording.tracks)
    if (uris.length < 2) return
    requestPlayback(selectedRecording.id, uris, 0)
  }

  function playMovement(track: SpotifyTrackMatch) {
    if (!selectedRecording) return
    const uris = orderedTrackUris(selectedRecording.tracks)
    const index = uris.indexOf(track.uri)
    if (index < 0) return
    setSelectedTrackId(track.id)
    requestPlayback(selectedRecording.id, uris, index)
  }

  function handleSavePlaylist() {
    if (!selectedRecording) return
    const uris = orderedTrackUris(selectedRecording.tracks)
    if (uris.length < 2) return
    if (playlists[selectedRecording.id]?.id) return
    if (session.userId) {
      const cached = readPlaylistCache()[playlistCacheKey(session.userId, uris)]
      if (cached) {
        storePlaylist(selectedRecording.id, session.userId, uris, cached)
        setPlaylistError(null)
        return
      }
    }
    try {
      sessionStorage.removeItem(PENDING_PLAYBACK_KEY)
    } catch {
      // Playback resume is optional. Saving still proceeds.
    }
    void startPlaylist({ name: playlistName, uris, recordingId: selectedRecording.id }, session.userId)
  }

  function selectAlbum(recording: SpotifyRecording) {
    if (recording.id === selectedRecordingId) return
    setSelectedRecordingId(recording.id)
    setSelectedTrackId(recording.tracks[0]?.id ?? "")
    setPlayRequest(null)
    setPlayerPhase("idle")
    setActiveUri(null)
    setNotice(null)
    setNoticeAction(null)
    setPremiumBlocked(false)
    setPlaylistError(null)
  }

  function handleIssue(issue: PlaybackIssue) {
    setPlayRequest(null)
    setPlayerPhase("idle")
    setActiveUri(null)
    if (issue.code === "premium_required") {
      setPremiumBlocked(true)
      setNotice(null)
      setNoticeAction(null)
      return
    }
    setPremiumBlocked(false)
    if (issue.code === "insufficient_scope") {
      setNotice(issue.message || "Reconnect Spotify to allow in-app playback.")
      setNoticeAction("reconnect")
      return
    }
    if (issue.code === "not_connected") {
      setNotice(issue.message || "Spotify login expired. Sign in again.")
      setNoticeAction("login")
      return
    }
    setNoticeAction(null)
    setNotice(issue.message || "Spotify could not start playback.")
  }

  async function handleLogout() {
    await fetch("/api/spotify/logout", { method: "POST" })
    setSession(EMPTY_SESSION)
    setPlayRequest(null)
    setPlayerPhase("idle")
    setActiveUri(null)
    setPremiumBlocked(false)
  }

  const playAllDetail = !oauthConfigured
    ? "Sequential playback needs Spotify login, which is not configured on this server."
    : premiumBlocked
      ? "This Spotify account is not Premium, so these movements cannot play straight through in the app."
      : playingThisGroup && playerPhase === "connecting"
        ? "Connecting the in-app Spotify player…"
        : playingThisGroup
          ? `These ${movementCount} movements play in order in this page. Spotify continues from one to the next.`
          : session.connected
            ? `Plays these ${movementCount} movements in order in this page.`
            : `Signs you in to Spotify, then plays these ${movementCount} movements in order in this page.`

  const saveDetail = playlistForSelection
    ? "Saved as a private Spotify playlist. Playback stays in this page."
    : playlistBusy
      ? "Saving a private Spotify playlist of these movements…"
      : session.connected
        ? `Saves a private playlist of these ${movementCount} tracks. It does not start playback.`
        : `Signs you in to Spotify, then saves a private playlist of these ${movementCount} tracks.`

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
            <p className="font-medium text-navy">Movements in this recording</p>
            <p id="play-all-detail" className="text-sm text-muted-foreground">
              {playAllDetail}
            </p>
            <p id="save-playlist-detail" className="text-sm text-muted-foreground">
              {saveDetail}
            </p>
            <p className="text-xs text-muted-foreground">{PREMIUM_REQUIRED_MESSAGE}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {oauthConfigured ? (
              <>
                <Button
                  type="button"
                  size="lg"
                  onClick={handlePlayAll}
                  disabled={playingThisGroup && playerPhase === "connecting"}
                  aria-pressed={Boolean(playingThisGroup && playerPhase === "playing" && playRequest?.position === 0)}
                  aria-describedby="play-all-detail"
                >
                  <Play className="h-4 w-4" />
                  {playingThisGroup && playerPhase === "connecting" ? "Connecting…" : "Play all"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleSavePlaylist}
                  disabled={playlistBusy || Boolean(playlistForSelection)}
                  aria-describedby="save-playlist-detail"
                >
                  {playlistBusy ? "Saving playlist…" : playlistForSelection ? "Playlist saved" : "Save playlist"}
                </Button>
              </>
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

      {selectedRecording && (
        <SpotifyWebPlayer
          uris={playRequest?.uris ?? []}
          startPosition={playRequest?.position ?? 0}
          generation={playRequest?.generation ?? 0}
          onPhase={setPlayerPhase}
          onTrackUri={setActiveUri}
          onIssue={handleIssue}
          onRequestPlay={() => {
            if (movementCount > 1) handlePlayAll()
            else if (selectedTrack) playMovement(selectedTrack)
          }}
        />
      )}

      {selectedRecording && (
        <div className="space-y-3">
          {playlistError && <p className="text-sm text-destructive">{playlistError}</p>}
          {notice && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{notice}</p>
              {oauthConfigured && noticeAction && (
                <Button variant="outline" size="sm" asChild>
                  <a href={loginHref(noticeAction === "reconnect")}>
                    {noticeAction === "reconnect" ? "Reconnect Spotify" : "Sign in to Spotify"}
                  </a>
                </Button>
              )}
            </div>
          )}
          {oauthConfigured && session.connected && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              Signed in as {session.displayName || "Spotify"}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex cursor-pointer items-center gap-1 text-primary hover:text-primary-hover"
              >
                <LogOut className="h-3 w-3" />
                Disconnect
              </button>
            </p>
          )}

          <ul className="divide-y divide-border overflow-hidden rounded-md border border-primary/15 bg-card">
            {recordings.map((recording) => {
              const selected = selectedRecording.id === recording.id
              const albumTitle = recording.album || recording.artists
              return (
                <li key={recording.id}>
                  <button
                    type="button"
                    onClick={() => selectAlbum(recording)}
                    aria-pressed={selected}
                    aria-expanded={selected}
                    className={`flex w-full cursor-pointer items-center gap-3 p-3 text-left ${selected ? "bg-accent/80" : ""}`}
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
                      <span className={`block truncate text-sm ${selected ? "font-medium text-primary" : ""}`}>
                        {albumTitle}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {recording.artists}
                        {recording.tracks.length > 1 ? ` · ${recording.tracks.length} movements` : ""}
                      </span>
                    </span>
                  </button>
                  {selected && (
                    <ul className="divide-y divide-border border-t border-border">
                      {recording.tracks.map((track) => {
                        const active = playingThisGroup && activeUri === track.uri
                        return (
                          <li key={track.id}>
                            <div className={`flex items-center gap-3 py-2 pr-3 pl-6 ${active ? "bg-accent/80" : ""}`}>
                              <button
                                type="button"
                                onClick={() => playMovement(track)}
                                aria-pressed={active}
                                title="Play this movement"
                                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
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
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {selectedTrack?.previewUrl && !playingThisGroup && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">30-second preview (no Premium required)</p>
          <audio controls preload="none" src={selectedTrack.previewUrl} className="w-full">
            Your browser does not support audio previews.
          </audio>
        </div>
      )}

      {recordings.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Results are movement groups from one album, not the rest of the disc. Play all streams those movements in
          order in this page. Save playlist stores the same tracks as a private Spotify playlist and does not start
          playback. Choosing a movement starts there. {PREMIUM_REQUIRED_MESSAGE}
        </p>
      )}
    </section>
  )
}
