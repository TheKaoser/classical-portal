"use client"

import { useEffect, useRef, useState } from "react"
import { ExternalLink, LogOut, Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSpotifyPlayer } from "@/components/spotify-player-provider"
import { cn } from "@/lib/utils"
import { formatDuration, type SpotifyRecording, type SpotifyTrackMatch } from "@/lib/spotify"
import {
  orderedTrackUris,
  parsePendingPlayback,
  PREMIUM_REQUIRED_MESSAGE,
  type PendingPlayback,
} from "@/lib/spotify-playback"
import { albumPlaybackControl, isAlbumRowActive } from "@/lib/spotify-player-session"
import {
  dedupePlaylistCreate,
  nextPlaybackAction,
  parsePendingPlaylist,
  PLAYLIST_RECONNECT_MESSAGE,
  playlistCacheKey,
  rememberPlaylistCache,
  sanitizePlaylistCache,
  type CachedPlaylist,
  type PendingPlaylist,
  type PlaylistCreateResult,
  type PlaylistWriteCode,
} from "@/lib/spotify-playlist"

const PENDING_PLAYLIST_KEY = "cp_pending_playlist"
const PENDING_PLAYBACK_KEY = "cp_pending_playback"
const CACHE_KEY = "cp_playlist_cache"

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
    const data = (await res.json().catch(() => ({}))) as {
      id?: string
      url?: string
      error?: string
      code?: PlaylistWriteCode
    }
    if (res.status === 401 || data.code === "not_connected") {
      sessionStorage.setItem(PENDING_PLAYLIST_KEY, JSON.stringify(pending))
      window.location.href = loginHref(false)
      return { ok: false, error: data.error || "Not connected to Spotify", status: 401, code: "not_connected" }
    }
    if (data.code === "insufficient_scope") {
      return {
        ok: false,
        error: data.error || PLAYLIST_RECONNECT_MESSAGE,
        status: 403,
        code: "insufficient_scope",
      }
    }
    if (!res.ok || !data.id) {
      return {
        ok: false,
        error: data.error || "Could not create the playlist.",
        status: res.status,
        code: "save_failed",
      }
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
  const {
    session,
    playRequest,
    playerPhase,
    activeUri,
    premiumBlocked,
    setPremiumBlocked,
    armPlayback,
    pausePlayback,
    resumePlayback,
    beginPlayback,
    clearPlayback,
    lastIssue,
    clearLastIssue,
    logout,
  } = useSpotifyPlayer()

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
  const [savingRecordingId, setSavingRecordingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [noticeAction, setNoticeAction] = useState<null | "login" | "reconnect">(null)
  const mountedRef = useRef(true)
  const playbackResumeRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!selectedRecording) return
    if (!selectedRecording.tracks.some((track) => track.id === selectedTrackId)) {
      setSelectedTrackId(selectedRecording.tracks[0]?.id ?? "")
    }
  }, [selectedRecording, selectedTrackId])

  useEffect(() => {
    if (!lastIssue) return
    if (lastIssue.code === "premium_required") {
      setNotice(null)
      setNoticeAction(null)
      clearLastIssue()
      return
    }
    if (lastIssue.code === "insufficient_scope") {
      setNotice(lastIssue.message || "Reconnect Spotify to allow in-app playback.")
      setNoticeAction("reconnect")
      clearLastIssue()
      return
    }
    if (lastIssue.code === "not_connected") {
      setNotice(lastIssue.message || "Spotify login expired. Sign in again.")
      setNoticeAction("login")
      clearLastIssue()
      return
    }
    setNoticeAction(null)
    setNotice(lastIssue.message || "Spotify could not start playback.")
    clearLastIssue()
  }, [lastIssue, clearLastIssue])

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
    setSavingRecordingId(pending.recordingId)
    setPlaylistError(null)
    setFailedKey((current) => (current === key ? null : current))
    return dedupePlaylistCreate(key, () => postPlaylist(pending)).then((result) => {
      if (!mountedRef.current) return
      setPlaylistBusy(false)
      setSavingRecordingId(null)
      if (result.ok) {
        try {
          sessionStorage.removeItem(PENDING_PLAYLIST_KEY)
        } catch {
          // Resume storage is optional.
        }
        storePlaylist(pending.recordingId, userId, pending.uris, result.playlist)
        return
      }
      setFailedKey(key)
      if (result.status === 401) return
      if (result.code === "insufficient_scope") {
        try {
          sessionStorage.setItem(PENDING_PLAYLIST_KEY, JSON.stringify(pending))
        } catch {
          // The reconnect button still explains what to do if resume storage is blocked.
        }
        setPlaylistError(null)
        setNotice(result.error || PLAYLIST_RECONNECT_MESSAGE)
        setNoticeAction("reconnect")
        return
      }
      setPlaylistError(result.error)
    })
  }

  useEffect(() => {
    if (!oauthConfigured || !session.connected || !session.userId) return
    const userId = session.userId
    const cache = readPlaylistCache()
    setPlaylists((current) => {
      let changed = false
      const next = { ...current }
      for (const recording of recordings) {
        const uris = orderedTrackUris(recording.tracks)
        const cached = cache[playlistCacheKey(userId, uris)] ?? null
        const action = nextPlaybackAction({
          trackCount: uris.length,
          hasPlaylist: Boolean(next[recording.id]?.id),
          cached,
        })
        if (action.type !== "embed-cached" || next[recording.id]?.id === action.id) continue
        next[recording.id] = { id: action.id, url: action.url }
        changed = true
      }
      return changed ? next : current
    })
    // Restores saved playlists only. It does not create one or start playback.
  }, [oauthConfigured, recordings, session.connected, session.userId])

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
    beginPlayback(pending.recordingId, pending.uris, pending.position)
  }, [oauthConfigured, recordings, session.connected, session.premium, beginPlayback, setPremiumBlocked])

  function requestPlayback(recordingId: string, uris: string[], position: number) {
    setNotice(null)
    setNoticeAction(null)
    clearLastIssue()
    if (!oauthConfigured) {
      setNotice("Sequential playback needs Spotify login, which is not configured on this server.")
      return
    }
    if (!session.connected) {
      try {
        sessionStorage.removeItem(PENDING_PLAYLIST_KEY)
        sessionStorage.setItem(
          PENDING_PLAYBACK_KEY,
          JSON.stringify({ recordingId, uris, position } satisfies PendingPlayback)
        )
      } catch {
        setNotice("Spotify login needs browser storage, which is blocked.")
        return
      }
      window.location.href = loginHref(false)
      return
    }
    if (session.premium === false || premiumBlocked) {
      clearPlayback()
      setPremiumBlocked(true)
      return
    }
    armPlayback()
    beginPlayback(recordingId, uris, position)
  }

  function focusRecording(recording: SpotifyRecording) {
    setSelectedRecordingId(recording.id)
    setSelectedTrackId(recording.tracks[0]?.id ?? "")
  }

  function handlePlay(recording: SpotifyRecording) {
    const uris = orderedTrackUris(recording.tracks)
    if (uris.length === 0) return
    focusRecording(recording)
    requestPlayback(recording.id, uris, 0)
  }

  function handleAlbumPlaybackControl(recording: SpotifyRecording) {
    const control = albumPlaybackControl({
      recordingId: recording.id,
      playRequestRecordingId: playRequest?.recordingId ?? null,
      playerPhase,
    })
    if (control.action === "pause") {
      pausePlayback()
      return
    }
    if (control.action === "resume") {
      resumePlayback()
      return
    }
    if (control.action === "none") return
    handlePlay(recording)
  }

  function playMovement(recording: SpotifyRecording, track: SpotifyTrackMatch) {
    const uris = orderedTrackUris(recording.tracks)
    const index = uris.indexOf(track.uri)
    if (index < 0) return
    setSelectedRecordingId(recording.id)
    setSelectedTrackId(track.id)
    requestPlayback(recording.id, uris, index)
  }

  function handleSavePlaylist(recording: SpotifyRecording) {
    const uris = orderedTrackUris(recording.tracks)
    if (uris.length < 2) return
    if (playlists[recording.id]?.id) return
    focusRecording(recording)
    if (session.userId) {
      const cached = readPlaylistCache()[playlistCacheKey(session.userId, uris)]
      if (cached) {
        storePlaylist(recording.id, session.userId, uris, cached)
        setPlaylistError(null)
        return
      }
    }
    try {
      sessionStorage.removeItem(PENDING_PLAYBACK_KEY)
    } catch {
      // Playback resume is optional. Saving still proceeds.
    }
    void startPlaylist({ name: playlistName, uris, recordingId: recording.id }, session.userId)
  }

  function selectAlbum(recording: SpotifyRecording) {
    if (recording.id === selectedRecordingId) return
    focusRecording(recording)
    setPlaylistError(null)
  }

  return (
    <section className="space-y-4">
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

      {selectedTrack?.previewUrl && !playRequest && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">30-second preview (no Premium required)</p>
          <audio controls preload="none" src={selectedTrack.previewUrl} className="w-full">
            Your browser does not support audio previews.
          </audio>
        </div>
      )}

      {selectedRecording && (
        <div className="space-y-3">
          {premiumBlocked && (
            <p className="text-sm text-muted-foreground">
              This Spotify account is not Premium, so this recording cannot play straight through in this page.{" "}
              {PREMIUM_REQUIRED_MESSAGE}
            </p>
          )}
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
                onClick={() => void logout()}
                className="inline-flex cursor-pointer items-center gap-1 text-primary hover:text-primary-hover"
              >
                <LogOut className="h-3 w-3" />
                Disconnect
              </button>
            </p>
          )}

          <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            {recordings.map((recording) => {
              const selected = selectedRecording.id === recording.id
              const playingThis = playRequest?.recordingId === recording.id
              const albumTitle = recording.album || recording.artists
              const savedPlaylist = playlists[recording.id] ?? null
              const movementCount = recording.tracks.length
              const canSave = movementCount > 1
              const connecting = playingThis && playerPhase === "connecting"
              const albumControl = albumPlaybackControl({
                recordingId: recording.id,
                playRequestRecordingId: playRequest?.recordingId ?? null,
                playerPhase,
              })
              const savingThis = savingRecordingId === recording.id
              const albumActive = isAlbumRowActive({
                recordingId: recording.id,
                selected,
                playRequestRecordingId: playRequest?.recordingId ?? null,
              })
              return (
                <li key={recording.id}>
                  <div
                    className={cn(
                      "flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4",
                      albumActive ? "bg-accent" : ""
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectAlbum(recording)}
                      aria-pressed={selected}
                      aria-expanded={selected}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                      style={{ cursor: "pointer" }}
                    >
                      {recording.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={recording.image}
                          alt=""
                          width={40}
                          height={40}
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-secondary" />
                      )}
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block truncate text-sm text-foreground",
                            (selected || playingThis) && "font-medium text-primary"
                          )}
                        >
                          {albumTitle}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {recording.artists}
                          {movementCount > 1 ? ` · ${movementCount} movements` : ""}
                        </span>
                      </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      {oauthConfigured ? (
                        <>
                          <Button
                            type="button"
                            onClick={() => handleAlbumPlaybackControl(recording)}
                            disabled={connecting || movementCount === 0}
                            aria-pressed={albumControl.pressed}
                            className="cursor-pointer"
                            title={
                              premiumBlocked
                                ? "This Spotify account is not Premium, so this recording cannot play straight through in this page."
                                : albumControl.action === "pause"
                                  ? "Pause playback in this page."
                                  : albumControl.action === "resume"
                                    ? "Resume playback in this page."
                                    : session.connected
                                      ? "Plays this recording from the first movement, in order, in this page."
                                      : "Signs you in to Spotify, then plays this recording from the first movement."
                            }
                          >
                            {albumControl.label === "Pause" ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                            {albumControl.label}
                          </Button>
                          {canSave &&
                            (savedPlaylist?.url ? (
                              <Button variant="outline" asChild className="cursor-pointer">
                                <a
                                  href={savedPlaylist.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Opens the private Spotify playlist created for this recording."
                                >
                                  Open playlist
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleSavePlaylist(recording)}
                                disabled={playlistBusy}
                                className="cursor-pointer"
                                title={`Saves a private playlist of these ${movementCount} tracks. It does not start playback.`}
                              >
                                {savingThis ? "Saving playlist…" : "Save playlist"}
                              </Button>
                            ))}
                        </>
                      ) : (
                        recording.tracks[0]?.url && (
                          <Button variant="outline" asChild className="cursor-pointer">
                            <a href={recording.tracks[0].url} target="_blank" rel="noopener noreferrer">
                              Open
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                  {selected && recording.tracks.length > 0 && (
                    <ul className="divide-y divide-border border-t border-border">
                      {recording.tracks.map((track) => {
                        const active = playingThis && activeUri === track.uri
                        return (
                          <li key={track.id}>
                            <button
                              type="button"
                              onClick={() => playMovement(recording, track)}
                              aria-pressed={active}
                              title="Play this movement"
                              className={cn(
                                "flex w-full cursor-pointer items-center gap-3 py-2.5 pr-3 pl-6 text-left sm:pr-4",
                                active && "bg-accent"
                              )}
                              style={{ cursor: "pointer" }}
                            >
                              {track.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={track.image}
                                  alt=""
                                  width={40}
                                  height={40}
                                  className="h-10 w-10 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-secondary" />
                              )}
                              <span className="min-w-0">
                                <span
                                  className={cn(
                                    "block truncate text-sm text-foreground",
                                    active && "font-medium text-primary"
                                  )}
                                >
                                  {track.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {track.artists}
                                  {track.durationMs ? ` · ${formatDuration(track.durationMs)}` : ""}
                                </span>
                              </span>
                            </button>
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

      {recordings.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Results are movement groups from one album, not the rest of the disc. Play on an album streams that
          recording in order in the bar at the bottom of the app. The player stays while you browse other pages.
          The movements of the selected album are listed under it; choosing one starts there. Save playlist stores
          the whole group as a private Spotify playlist; after a successful save, that same control becomes Open
          playlist. Save track, in the player bar, adds only the current movement to Liked Songs.
          Neither save starts playback. {PREMIUM_REQUIRED_MESSAGE}
        </p>
      )}
    </section>
  )
}
