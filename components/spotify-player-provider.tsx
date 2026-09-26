"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { SpotifyEmbedPlayer, type EmbedPlaybackIssue } from "@/components/spotify-embed-player"
import { isPlaybackSessionActive } from "@/lib/spotify-player-session"
import { spotifyAlbumUri } from "@/lib/spotify-playback"

export type PlaybackIssue = EmbedPlaybackIssue

export type PlayRequest = {
  recordingId: string
  uris: string[]
  position: number
  generation: number
  /** Album document when playback starts on the first track. */
  contextUri: string | null
}

export type PlayerPhase = "connecting" | "playing" | "paused" | "idle"

type PlayerCommands = {
  start: (uris: string[], index: number, generation: number, contextUri: string | null) => void
  pause: () => void
  resume: () => void
  arm: () => void
}

const idleCommands: PlayerCommands = {
  start: () => {},
  pause: () => {},
  resume: () => {},
  arm: () => {},
}

type SpotifyPlayerContextValue = {
  oauthConfigured: boolean
  playRequest: PlayRequest | null
  playerPhase: PlayerPhase
  activeUri: string | null
  needsGesture: boolean
  armPlayback: () => void
  pausePlayback: () => void
  resumePlayback: () => void
  beginPlayback: (recordingId: string, uris: string[], position: number, albumId?: string | null) => void
  clearPlayback: () => void
  registerContextEnded: (listener: (uri: string) => void) => () => void
  registerUserTransport: (listener: () => void) => () => void
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
  const [playRequest, setPlayRequest] = useState<PlayRequest | null>(null)
  const [playerPhase, setPlayerPhase] = useState<PlayerPhase>("idle")
  const [activeUri, setActiveUri] = useState<string | null>(null)
  const [needsGesture, setNeedsGesture] = useState(false)
  const [lastIssue, setLastIssue] = useState<PlaybackIssue | null>(null)
  const generationRef = useRef(0)
  const commandsRef = useRef<PlayerCommands>(idleCommands)
  const contextEndedListenersRef = useRef(new Set<(uri: string) => void>())
  const userTransportListenersRef = useRef(new Set<() => void>())

  const registerCommands = useCallback((commands: PlayerCommands) => {
    commandsRef.current = commands
  }, [])

  const armPlayback = useCallback(() => {
    commandsRef.current.arm()
  }, [])

  const pausePlayback = useCallback(() => {
    commandsRef.current.pause()
  }, [])

  const resumePlayback = useCallback(() => {
    commandsRef.current.arm()
    commandsRef.current.resume()
  }, [])

  const clearPlayback = useCallback(() => {
    commandsRef.current.pause()
    setPlayRequest(null)
    setPlayerPhase("idle")
    setActiveUri(null)
    setNeedsGesture(false)
  }, [])

  const registerContextEnded = useCallback((listener: (uri: string) => void) => {
    contextEndedListenersRef.current.add(listener)
    return () => {
      contextEndedListenersRef.current.delete(listener)
    }
  }, [])

  const registerUserTransport = useCallback((listener: () => void) => {
    userTransportListenersRef.current.add(listener)
    return () => {
      userTransportListenersRef.current.delete(listener)
    }
  }, [])

  const noteContextEnded = useCallback((uri: string) => {
    for (const listener of contextEndedListenersRef.current) listener(uri)
  }, [])

  const noteUserTransport = useCallback(() => {
    for (const listener of userTransportListenersRef.current) listener()
  }, [])

  const clearLastIssue = useCallback(() => {
    setLastIssue(null)
  }, [])

  const beginPlayback = useCallback((recordingId: string, uris: string[], position: number, albumId?: string | null) => {
    const bounded = Number.isInteger(position) && position >= 0 && position < uris.length ? position : 0
    generationRef.current += 1
    const generation = generationRef.current
    const contextUri = bounded === 0 ? spotifyAlbumUri(albumId) : null
    setLastIssue(null)
    setNeedsGesture(false)
    setPlayerPhase("connecting")
    setActiveUri(uris[bounded] ?? null)
    setPlayRequest({ recordingId, uris, position: bounded, generation, contextUri })
    commandsRef.current.arm()
    commandsRef.current.start(uris, bounded, generation, contextUri)
  }, [])

  const handleIssue = useCallback((issue: PlaybackIssue) => {
    setLastIssue(issue)
    setPlayerPhase("paused")
  }, [])

  const value = useMemo<SpotifyPlayerContextValue>(
    () => ({
      oauthConfigured,
      playRequest,
      playerPhase,
      activeUri,
      needsGesture,
      armPlayback,
      pausePlayback,
      resumePlayback,
      beginPlayback,
      clearPlayback,
      registerContextEnded,
      registerUserTransport,
      lastIssue,
      clearLastIssue,
    }),
    [
      oauthConfigured,
      playRequest,
      playerPhase,
      activeUri,
      needsGesture,
      armPlayback,
      pausePlayback,
      resumePlayback,
      beginPlayback,
      clearPlayback,
      registerContextEnded,
      registerUserTransport,
      lastIssue,
      clearLastIssue,
    ]
  )

  const sessionActive = isPlaybackSessionActive(playRequest)

  return (
    <SpotifyPlayerContext.Provider value={value}>
      {children}
      <SpotifyEmbedPlayer
        uris={playRequest?.uris ?? []}
        startIndex={playRequest?.position ?? 0}
        generation={playRequest?.generation ?? 0}
        visible={sessionActive}
        needsGesture={needsGesture}
        onRegisterCommands={registerCommands}
        onPhase={setPlayerPhase}
        onTrackUri={setActiveUri}
        onContextEnded={noteContextEnded}
        onUserTransport={noteUserTransport}
        onNeedsGesture={setNeedsGesture}
        onIssue={handleIssue}
      />
    </SpotifyPlayerContext.Provider>
  )
}
