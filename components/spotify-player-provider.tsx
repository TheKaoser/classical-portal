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
import { flushSync } from "react-dom"
import { SpotifyEmbedPlayer, type EmbedPlaybackIssue } from "@/components/spotify-embed-player"
import { isPlaybackSessionActive } from "@/lib/spotify-player-session"

export type PlaybackIssue = EmbedPlaybackIssue

export type PlayRequest = {
  recordingId: string
  uris: string[]
  position: number
  generation: number
}

export type PlayerPhase = "connecting" | "playing" | "paused" | "idle"

type PlayerCommands = {
  start: (uris: string[], index: number, generation: number) => void
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
  armPlayback: () => void
  /** Show the embed and create its controller during the click, before a match fetch. */
  primePlayback: () => void
  /** Hide that shell when playback never started. An active session stays up. */
  releasePrime: () => void
  pausePlayback: () => void
  resumePlayback: () => void
  beginPlayback: (recordingId: string, uris: string[], position: number) => void
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
  const [primed, setPrimed] = useState(false)
  const [playerPhase, setPlayerPhase] = useState<PlayerPhase>("idle")
  const [activeUri, setActiveUri] = useState<string | null>(null)
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

  const primePlayback = useCallback(() => {
    // The dock has to be measurable before the controller is created. The
    // click is still on the stack here, so the iframe starts during the gesture
    // instead of after the Spotify match returns.
    flushSync(() => setPrimed(true))
    commandsRef.current.arm()
  }, [])

  const releasePrime = useCallback(() => {
    setPrimed(false)
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
    setPrimed(false)
    setPlayerPhase("idle")
    setActiveUri(null)
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

  const beginPlayback = useCallback((recordingId: string, uris: string[], position: number) => {
    const bounded = Number.isInteger(position) && position >= 0 && position < uris.length ? position : 0
    generationRef.current += 1
    const generation = generationRef.current
    setLastIssue(null)
    setPlayerPhase("connecting")
    setActiveUri(uris[bounded] ?? null)
    setPlayRequest({ recordingId, uris, position: bounded, generation })
    commandsRef.current.arm()
    commandsRef.current.start(uris, bounded, generation)
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
      armPlayback,
      primePlayback,
      releasePrime,
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
      armPlayback,
      primePlayback,
      releasePrime,
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
        visible={sessionActive || primed}
        onRegisterCommands={registerCommands}
        onPhase={setPlayerPhase}
        onTrackUri={setActiveUri}
        onContextEnded={noteContextEnded}
        onUserTransport={noteUserTransport}
        onIssue={handleIssue}
      />
    </SpotifyPlayerContext.Provider>
  )
}
