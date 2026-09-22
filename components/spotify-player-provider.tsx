"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { loadSpotifyPlaybackSdk, SpotifyWebPlayer, type PlaybackIssue } from "@/components/spotify-web-player"
import { isPlaybackSessionActive } from "@/lib/spotify-player-session"
import { PLAYLIST_RECONNECT_MESSAGE } from "@/lib/spotify-playlist"

const SAVED_TRACKS_KEY = "cp_saved_tracks_playlist"

type SavedTracksPlaylist = {
  userId: string
  id: string
  url: string
  uris: string[]
}

export type SpotifySession = {
  connected: boolean
  displayName: string | null
  userId: string | null
  product: string | null
  premium: boolean | null
}

export type PlayRequest = {
  recordingId: string
  uris: string[]
  position: number
  generation: number
}

export type PlayerPhase = "connecting" | "playing" | "paused" | "idle"

const EMPTY_SESSION: SpotifySession = {
  connected: false,
  displayName: null,
  userId: null,
  product: null,
  premium: null,
}

function readSavedTracks(userId: string): SavedTracksPlaylist | null {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_TRACKS_KEY) || "null") as SavedTracksPlaylist | null
    if (!value || value.userId !== userId || typeof value.id !== "string") return null
    return { ...value, uris: Array.isArray(value.uris) ? value.uris.filter((uri) => typeof uri === "string") : [] }
  } catch {
    return null
  }
}

function writeSavedTracks(value: SavedTracksPlaylist) {
  localStorage.setItem(SAVED_TRACKS_KEY, JSON.stringify(value))
}

type SpotifyPlayerContextValue = {
  oauthConfigured: boolean
  session: SpotifySession
  setSession: (session: SpotifySession) => void
  refreshSession: () => Promise<void>
  playRequest: PlayRequest | null
  playerPhase: PlayerPhase
  activeUri: string | null
  premiumBlocked: boolean
  setPremiumBlocked: (blocked: boolean) => void
  savedTrackUris: string[]
  armPlayback: () => void
  registerArm: (arm: () => void) => void
  beginPlayback: (recordingId: string, uris: string[], position: number) => void
  clearPlayback: () => void
  handleIssue: (issue: PlaybackIssue) => void
  saveTrack: (uri: string) => Promise<{ ok: true } | { ok: false; message: string }>
  logout: () => Promise<void>
  lastIssue: PlaybackIssue | null
  clearLastIssue: () => void
}

const SpotifyPlayerContext = createContext<SpotifyPlayerContextValue | null>(null)

export function useSpotifyPlayer(): SpotifyPlayerContextValue {
  const value = useContext(SpotifyPlayerContext)
  if (!value) {
    throw new Error("useSpotifyPlayer must be used within SpotifyPlayerProvider")
  }
  return value
}

export function SpotifyPlayerProvider({
  oauthConfigured,
  children,
}: {
  oauthConfigured: boolean
  children: ReactNode
}) {
  const [session, setSession] = useState<SpotifySession>(EMPTY_SESSION)
  const [playRequest, setPlayRequest] = useState<PlayRequest | null>(null)
  const [playerPhase, setPlayerPhase] = useState<PlayerPhase>("idle")
  const [activeUri, setActiveUri] = useState<string | null>(null)
  const [premiumBlocked, setPremiumBlocked] = useState(false)
  const [savedTrackUris, setSavedTrackUris] = useState<string[]>([])
  const [lastIssue, setLastIssue] = useState<PlaybackIssue | null>(null)
  const generationRef = useRef(0)
  const armPlaybackRef = useRef<(() => void) | null>(null)
  const mountedRef = useRef(true)

  const registerArm = useCallback((arm: () => void) => {
    armPlaybackRef.current = arm
  }, [])

  const armPlayback = useCallback(() => {
    armPlaybackRef.current?.()
  }, [])

  const clearPlayback = useCallback(() => {
    setPlayRequest(null)
    setPlayerPhase("idle")
    setActiveUri(null)
  }, [])

  const clearLastIssue = useCallback(() => {
    setLastIssue(null)
  }, [])

  const beginPlayback = useCallback((recordingId: string, uris: string[], position: number) => {
    setPremiumBlocked(false)
    setLastIssue(null)
    setActiveUri(null)
    generationRef.current += 1
    setPlayerPhase("connecting")
    setPlayRequest({
      recordingId,
      uris,
      position,
      generation: generationRef.current,
    })
  }, [])

  const handleIssue = useCallback(
    (issue: PlaybackIssue) => {
      clearPlayback()
      setLastIssue(issue)
      if (issue.code === "premium_required") {
        setPremiumBlocked(true)
        return
      }
      setPremiumBlocked(false)
    },
    [clearPlayback]
  )

  const refreshSession = useCallback(async () => {
    if (!oauthConfigured) {
      setSession(EMPTY_SESSION)
      return
    }
    try {
      const res = await fetch("/api/spotify/session")
      const data = (await res.json()) as Partial<SpotifySession>
      if (!mountedRef.current) return
      setSession({
        connected: Boolean(data.connected),
        displayName: data.displayName ?? null,
        userId: data.userId ?? null,
        product: data.product ?? null,
        premium: typeof data.premium === "boolean" ? data.premium : null,
      })
    } catch {
      if (mountedRef.current) setSession(EMPTY_SESSION)
    }
  }, [oauthConfigured])

  const saveTrack = useCallback(
    async (uri: string): Promise<{ ok: true } | { ok: false; message: string }> => {
      const userId = session.userId
      const existing = userId ? readSavedTracks(userId) : null
      if (existing?.uris.includes(uri)) return { ok: true }
      try {
        const res = await fetch("/api/spotify/save-track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uri, playlistId: existing?.id }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          id?: string
          url?: string
          error?: string
          code?: string
        }
        if (res.status === 401 || data.code === "not_connected") {
          const message = "Spotify login expired. Sign in again."
          setLastIssue({ code: "not_connected", message })
          return { ok: false, message }
        }
        if (data.code === "insufficient_scope") {
          const message = data.error || PLAYLIST_RECONNECT_MESSAGE
          setLastIssue({ code: "insufficient_scope", message })
          return { ok: false, message }
        }
        if (!res.ok || !data.id) {
          return { ok: false, message: data.error || "Could not save this track." }
        }
        const uris = existing ? [...new Set([...existing.uris, uri])] : [uri]
        if (userId) {
          writeSavedTracks({
            userId,
            id: data.id,
            url: data.url ?? `https://open.spotify.com/playlist/${data.id}`,
            uris,
          })
        }
        setSavedTrackUris(uris)
        return { ok: true }
      } catch {
        return { ok: false, message: "Could not save this track." }
      }
    },
    [session.userId]
  )

  const logout = useCallback(async () => {
    await fetch("/api/spotify/logout", { method: "POST" })
    if (!mountedRef.current) return
    setSession(EMPTY_SESSION)
    clearPlayback()
    setPremiumBlocked(false)
    setLastIssue(null)
  }, [clearPlayback])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!session.userId) {
      setSavedTrackUris([])
      return
    }
    setSavedTrackUris(readSavedTracks(session.userId)?.uris ?? [])
  }, [session.userId])

  useEffect(() => {
    if (!oauthConfigured) return
    void loadSpotifyPlaybackSdk().catch(() => {
      // Play reports this if the browser cannot load the SDK.
    })
  }, [oauthConfigured])

  useEffect(() => {
    if (!oauthConfigured) return
    let cancelled = false
    void refreshSession().then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [oauthConfigured, refreshSession])

  const value = useMemo<SpotifyPlayerContextValue>(
    () => ({
      oauthConfigured,
      session,
      setSession,
      refreshSession,
      playRequest,
      playerPhase,
      activeUri,
      premiumBlocked,
      setPremiumBlocked,
      savedTrackUris,
      armPlayback,
      registerArm,
      beginPlayback,
      clearPlayback,
      handleIssue,
      saveTrack,
      logout,
      lastIssue,
      clearLastIssue,
    }),
    [
      oauthConfigured,
      session,
      refreshSession,
      playRequest,
      playerPhase,
      activeUri,
      premiumBlocked,
      savedTrackUris,
      armPlayback,
      registerArm,
      beginPlayback,
      clearPlayback,
      handleIssue,
      saveTrack,
      logout,
      lastIssue,
      clearLastIssue,
    ]
  )

  return (
    <SpotifyPlayerContext.Provider value={value}>
      {children}
      {oauthConfigured && session.connected && (
        <SpotifyWebPlayer
          uris={playRequest?.uris ?? []}
          startPosition={playRequest?.position ?? 0}
          generation={playRequest?.generation ?? 0}
          active={isPlaybackSessionActive(playRequest)}
          visible={isPlaybackSessionActive(playRequest)}
          onArm={registerArm}
          onPhase={setPlayerPhase}
          onTrackUri={setActiveUri}
          onIssue={handleIssue}
          savedTrackUris={savedTrackUris}
          onSaveTrack={saveTrack}
        />
      )}
    </SpotifyPlayerContext.Provider>
  )
}
