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
import { LIBRARY_RECONNECT_MESSAGE } from "@/lib/spotify-playlist"

const LIKED_TRACKS_KEY = "cp_liked_tracks"

type LikedTracksCache = {
  userId: string
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

function readLikedTracks(userId: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(LIKED_TRACKS_KEY) || "null") as LikedTracksCache | null
    if (!value || value.userId !== userId || !Array.isArray(value.uris)) return []
    return value.uris.filter((uri) => typeof uri === "string")
  } catch {
    return []
  }
}

function writeLikedTracks(userId: string, uris: string[]) {
  localStorage.setItem(LIKED_TRACKS_KEY, JSON.stringify({ userId, uris } satisfies LikedTracksCache))
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
  pausePlayback: () => void
  resumePlayback: () => void
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
  const transportRef = useRef<{ pause: () => void; resume: () => void } | null>(null)
  const mountedRef = useRef(true)

  const registerArm = useCallback((arm: () => void) => {
    armPlaybackRef.current = arm
  }, [])

  const registerTransport = useCallback((transport: { pause: () => void; resume: () => void }) => {
    transportRef.current = transport
  }, [])

  const armPlayback = useCallback(() => {
    armPlaybackRef.current?.()
  }, [])

  const pausePlayback = useCallback(() => {
    transportRef.current?.pause()
  }, [])

  const resumePlayback = useCallback(() => {
    armPlaybackRef.current?.()
    transportRef.current?.resume()
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

  const markTrackSaved = useCallback(
    (uri: string) => {
      const userId = session.userId
      setSavedTrackUris((current) => {
        if (current.includes(uri)) return current
        const next = [...current, uri]
        if (userId) writeLikedTracks(userId, next)
        return next
      })
    },
    [session.userId]
  )

  const saveTrack = useCallback(
    async (uri: string): Promise<{ ok: true } | { ok: false; message: string }> => {
      if (savedTrackUris.includes(uri)) return { ok: true }
      try {
        const res = await fetch("/api/spotify/save-track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uri }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          saved?: boolean
          error?: string
          code?: string
        }
        if (res.status === 401 || data.code === "not_connected") {
          const message = "Spotify login expired. Sign in again."
          setLastIssue({ code: "not_connected", message })
          return { ok: false, message }
        }
        if (data.code === "insufficient_scope") {
          const message = data.error || LIBRARY_RECONNECT_MESSAGE
          setLastIssue({ code: "insufficient_scope", message })
          return { ok: false, message }
        }
        if (!res.ok || !data.saved) {
          return { ok: false, message: data.error || "Could not save this track." }
        }
        markTrackSaved(uri)
        return { ok: true }
      } catch {
        return { ok: false, message: "Could not save this track." }
      }
    },
    [markTrackSaved, savedTrackUris]
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
    setSavedTrackUris(readLikedTracks(session.userId))
  }, [session.userId])

  useEffect(() => {
    if (!oauthConfigured || !session.connected || !activeUri) return
    if (savedTrackUris.includes(activeUri)) return
    let cancelled = false
    void fetch(`/api/spotify/save-track?uri=${encodeURIComponent(activeUri)}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { saved?: boolean; code?: string }
        if (cancelled || !mountedRef.current) return
        if (res.ok && data.saved) markTrackSaved(activeUri)
      })
      .catch(() => {
        // Local cache still drives the Saved label when the check fails.
      })
    return () => {
      cancelled = true
    }
  }, [activeUri, markTrackSaved, oauthConfigured, savedTrackUris, session.connected])

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
      pausePlayback,
      resumePlayback,
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
      pausePlayback,
      resumePlayback,
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
          onRegisterTransport={registerTransport}
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
