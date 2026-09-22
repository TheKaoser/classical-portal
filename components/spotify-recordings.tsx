"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, LogOut, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loadSpotifyPlaybackSdk, SpotifyWebPlayer, type PlaybackIssue } from "@/components/spotify-web-player"
import { formatDuration, type SpotifyRecording, type SpotifyTrackMatch } from "@/lib/spotify"
import {
  chooseTrackEmbed,
  orderedTrackUris,
  parsePendingPlayback,
  PREMIUM_REQUIRED_MESSAGE,
  type PendingPlayback,
} from "@/lib/spotify-playback"

const PENDING_KEY = "cp_pending_playback"

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
  generation: number
}

const EMPTY_SESSION: Session = {
  connected: false,
  displayName: null,
  userId: null,
  product: null,
  premium: null,
}

function loginHref(reconnect: boolean) {
  const returnTo = `${window.location.pathname}${window.location.search}`
  const params = new URLSearchParams({ returnTo })
  if (reconnect) params.set("reconnect", "1")
  return `/api/spotify/login?${params.toString()}`
}

export function SpotifyRecordings({
  configured,
  oauthConfigured,
  searchUrl,
  recordings,
}: {
  configured: boolean
  oauthConfigured: boolean
  searchUrl: string
  recordings: SpotifyRecording[]
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
  const [session, setSession] = useState<Session>(EMPTY_SESSION)
  const [playRequest, setPlayRequest] = useState<PlayRequest | null>(null)
  const [playerPhase, setPlayerPhase] = useState<"connecting" | "playing" | "paused" | "idle">("idle")
  const [activeUri, setActiveUri] = useState<string | null>(null)
  const [premiumBlocked, setPremiumBlocked] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [noticeAction, setNoticeAction] = useState<null | "login" | "reconnect">(null)
  const resumedRef = useRef(false)
  const generationRef = useRef(0)
  const armPlaybackRef = useRef<(() => void) | null>(null)
  const registerArm = useCallback((arm: () => void) => {
    armPlaybackRef.current = arm
  }, [])

  const movementCount = selectedRecording?.tracks.length ?? 0
  const playingThisGroup =
    Boolean(playRequest) &&
    playRequest?.recordingId === selectedRecording?.id &&
    !preferSingleTrack

  useEffect(() => {
    try {
      localStorage.removeItem("cp_playlist_cache")
      sessionStorage.removeItem("cp_pending_playlist")
    } catch {
      // Private mode can block storage. Playback does not depend on it.
    }
  }, [])

  useEffect(() => {
    if (!oauthConfigured) return
    void loadSpotifyPlaybackSdk().catch(() => {
      // Play all explains this if the browser cannot load the SDK.
    })
  }, [oauthConfigured])

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

  useEffect(() => {
    if (!oauthConfigured || !session.connected || resumedRef.current) return
    let pending: PendingPlayback | null = null
    try {
      const raw = sessionStorage.getItem(PENDING_KEY)
      if (!raw) return
      pending = parsePendingPlayback(raw)
      sessionStorage.removeItem(PENDING_KEY)
    } catch {
      return
    }
    if (!pending || !recordings.some((recording) => recording.id === pending?.recordingId)) return
    resumedRef.current = true
    setPreferSingleTrack(false)
    setSelectedRecordingId(pending.recordingId)
    if (session.premium === false) {
      setPremiumBlocked(true)
      return
    }
    generationRef.current += 1
    setPlayRequest({ recordingId: pending.recordingId, uris: pending.uris, generation: generationRef.current })
  }, [oauthConfigured, recordings, session.connected, session.premium])

  function beginPlayback(recordingId: string, uris: string[]) {
    setPremiumBlocked(false)
    setNotice(null)
    setNoticeAction(null)
    setPreferSingleTrack(false)
    generationRef.current += 1
    setPlayerPhase("connecting")
    setPlayRequest({ recordingId, uris, generation: generationRef.current })
  }

  function handlePlayAll() {
    if (!selectedRecording) return
    const uris = orderedTrackUris(selectedRecording.tracks)
    if (uris.length < 2) return
    setPreferSingleTrack(false)
    if (!session.connected) {
      const pending: PendingPlayback = { recordingId: selectedRecording.id, uris }
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
      } catch {
        setNotice("Spotify login needs browser storage, which is blocked.")
        return
      }
      window.location.href = loginHref(false)
      return
    }
    if (session.premium === false || premiumBlocked) {
      setPlayRequest(null)
      setPremiumBlocked(true)
      return
    }
    armPlaybackRef.current?.()
    beginPlayback(selectedRecording.id, uris)
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

  const embed = useMemo(
    () =>
      chooseTrackEmbed({
        selectedTrack: selectedTrack ? { id: selectedTrack.id, name: selectedTrack.name } : null,
        suppress: Boolean(playingThisGroup),
      }),
    [playingThisGroup, selectedTrack]
  )

  const playAllDetail = !oauthConfigured
    ? "Sequential playback needs Spotify login, which is not configured on this server."
    : premiumBlocked
      ? "This Spotify account is not Premium, so these movements cannot play in this page. Open a movement below, or listen in the embed."
      : playingThisGroup && playerPhase === "connecting"
        ? "Starting the player in this page…"
        : playingThisGroup
          ? `These ${movementCount} movements play in order in the bar below.`
          : session.connected
            ? `Plays these ${movementCount} movements in order in this page. Audio stays in the browser.`
            : `Signs you in to Spotify, then plays these ${movementCount} movements in order in this page.`

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
            <p className="text-xs text-muted-foreground">{PREMIUM_REQUIRED_MESSAGE}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {oauthConfigured ? (
              <Button
                type="button"
                size="lg"
                onClick={handlePlayAll}
                disabled={playingThisGroup && playerPhase === "connecting"}
                aria-pressed={Boolean(playingThisGroup && playerPhase === "playing")}
                aria-describedby="play-all-detail"
              >
                <Play className="h-4 w-4" />
                {playingThisGroup && playerPhase === "connecting" ? "Connecting…" : "Play all"}
              </Button>
            ) : (
              <Button variant="outline" size="lg" asChild>
                <a href={selectedRecording.tracks[0]?.url} target="_blank" rel="noopener noreferrer">
                  Open first movement
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      )}

      {oauthConfigured && session.connected && movementCount > 1 && (
        <SpotifyWebPlayer
          uris={playRequest?.uris ?? []}
          generation={playRequest?.generation ?? 0}
          active={Boolean(playingThisGroup && playRequest)}
          visible={Boolean(playingThisGroup && playRequest)}
          onArm={registerArm}
          onPhase={setPlayerPhase}
          onTrackUri={setActiveUri}
          onIssue={handleIssue}
        />
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

      {selectedTrack?.previewUrl && !playingThisGroup && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">30-second preview (no Premium required)</p>
          <audio controls preload="none" src={selectedTrack.previewUrl} className="w-full">
            Your browser does not support audio previews.
          </audio>
        </div>
      )}

      {selectedRecording && (
        <div className="space-y-3">
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
                className="inline-flex items-center gap-1 text-primary hover:text-primary-hover"
              >
                <LogOut className="h-3 w-3" />
                Disconnect
              </button>
            </p>
          )}

          <p className="text-sm text-muted-foreground">
            {movementCount > 1
              ? playingThisGroup
                ? "This group is lined up in order. Choose a movement to hear only that track."
                : "Choose a movement to play it on its own, or use Play all for the whole group."
              : "Matched track for this work."}
          </p>

          <ul className="divide-y divide-border overflow-hidden rounded-md border border-primary/15 bg-card">
            {selectedRecording.tracks.map((track) => {
              const active = playingThisGroup
                ? activeUri === track.uri
                : preferSingleTrack && selectedTrack?.id === track.id
              return (
                <li key={track.id}>
                  <div className={`flex items-center gap-3 p-3 ${active ? "bg-accent/80" : ""}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setPreferSingleTrack(true)
                        setPlayRequest(null)
                        setPlayerPhase("idle")
                        setActiveUri(null)
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
                      setPlayRequest(null)
                      setPlayerPhase("idle")
                      setActiveUri(null)
                      setNotice(null)
                      setPremiumBlocked(false)
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
          Results are individual tracks (and movement groups) for this work, not full albums. Play all uses the player
          bar in this page and keeps the audio in the browser. It does not open the Spotify app or create a playlist.
          Choosing one movement uses the embed for that track only. The embed plays a preview unless you are logged
          into Spotify in this browser. Spotify Premium is required for in-app continuous play.
        </p>
      )}
    </section>
  )
}
