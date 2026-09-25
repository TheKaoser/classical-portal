"use client"

import { createContext, useContext, useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react"
import { Loader2, Pause, Play, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useSpotifyPlayer } from "@/components/spotify-player-provider"
import { fetchWorkPlayback, hasPlayableWorkPlayback } from "@/lib/fetch-work-playback"
import {
  LIST_PLAY_ADVANCE_DELAY_MS,
  LIST_PLAY_GAP_ATTEMPTS,
  LIST_PLAY_GAP_STOPPED,
  LIST_PLAY_LOOKAHEAD,
  LIST_PLAY_NOT_CONFIGURED,
  LIST_PLAY_NO_LIST_MATCH,
  LIST_PLAY_NO_MATCH,
  LIST_PLAY_START_ATTEMPTS,
  idsToPrefetch,
  listPlayAllControl,
  listStoppedEarly,
  readShufflePreference,
  shouldAdvanceList,
  shouldChainListWork,
  shuffleWorkIds,
  workRecordingId,
  writeShufflePreference,
} from "@/lib/list-playback"
import { createListPlaybackStore, IDLE_ROW, type ListPlaybackStore } from "@/lib/list-playback-store"
import { cn } from "@/lib/utils"

const WorkPlaybackContext = createContext<ListPlaybackStore | null>(null)

type Session = {
  mode: "single" | "list"
  generation: number
  order: string[]
  cursor: number
  skipped: Set<string>
  uris: string[]
  shuffle: boolean
  finished: boolean
}

type Found = { index: number; id: string; uris: string[] }

function serverIdleRow() {
  return IDLE_ROW
}

export function useWorkPlaybackStore(): ListPlaybackStore | null {
  return useContext(WorkPlaybackContext)
}

export function WorkListPlayback({
  oauthConfigured,
  works,
  children,
}: {
  oauthConfigured: boolean
  works: readonly { id: string }[]
  children: ReactNode
}) {
  const storeRef = useRef<ListPlaybackStore | null>(null)
  if (!storeRef.current) storeRef.current = createListPlaybackStore(oauthConfigured)
  const store = storeRef.current

  return (
    <WorkPlaybackContext.Provider value={store}>
      <PlaybackMachine store={store} workIds={works.map((work) => work.id)} />
      {works.length > 0 ? <WorkListToolbar count={works.length} /> : null}
      {children}
    </WorkPlaybackContext.Provider>
  )
}

function PlaybackMachine({ store, workIds }: { store: ListPlaybackStore; workIds: string[] }) {
  const spotify = useSpotifyPlayer()
  const idsRef = useRef(workIds)
  idsRef.current = workIds
  const apiRef = useRef(spotify)
  apiRef.current = spotify
  const sessionRef = useRef<Session | null>(null)
  const lastUriRef = useRef<string | null>(null)
  const advanceTimerRef = useRef<number | null>(null)
  const contextEndTimerRef = useRef<number | null>(null)
  const transportGenerationRef = useRef(0)
  const advancingRef = useRef(false)
  const { activeUri, playerPhase, lastIssue } = spotify

  function clearAdvanceTimers() {
    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
    if (contextEndTimerRef.current != null) {
      window.clearTimeout(contextEndTimerRef.current)
      contextEndTimerRef.current = null
    }
  }

  function bump(): number {
    clearAdvanceTimers()
    advancingRef.current = false
    const session = sessionRef.current
    const generation = (session?.generation ?? 0) + 1
    if (session) session.generation = generation
    return generation
  }

  function cachedIds(session: Session): Set<string> {
    const ids = new Set<string>()
    for (const id of session.order) {
      if (hasPlayableWorkPlayback(id)) ids.add(id)
    }
    return ids
  }

  async function takePlayable(session: Session, from: number, maxAttempts: number): Promise<Found | "stop" | null> {
    let attempts = 0
    for (let index = from; index < session.order.length && attempts < maxAttempts; index += 1) {
      if (sessionRef.current !== session) return "stop"
      const id = session.order[index]
      if (session.skipped.has(id)) continue
      attempts += 1
      store.patch({ resolvingWorkId: id })
      const result = await fetchWorkPlayback(id)
      if (sessionRef.current !== session) return "stop"
      if (!result.ok) {
        store.patch({ notice: result.message, noticeKind: "error", noticeAction: null })
        return "stop"
      }
      if (!result.hit.configured) {
        store.patch({ notice: LIST_PLAY_NOT_CONFIGURED, noticeKind: "error", noticeAction: null })
        return "stop"
      }
      if (result.hit.uris.length === 0) {
        session.skipped.add(id)
        continue
      }
      return { index, id, uris: result.hit.uris }
    }
    return null
  }

  function beginFound(session: Session, found: Found) {
    if (sessionRef.current !== session) return
    session.cursor = found.index
    session.uris = found.uris
    session.finished = false
    lastUriRef.current = null
    store.patch({
      activeWorkId: found.id,
      resolvingWorkId: null,
      starting: false,
      listActive: session.mode === "list",
      notice: null,
      noticeAction: null,
      noticeKind: null,
    })
    apiRef.current.armPlayback()
    apiRef.current.beginPlayback(workRecordingId(found.id), found.uris, 0)
    if (session.mode === "list") void prefetch(session)
  }

  async function prefetch(session: Session) {
    let guard = 0
    const cap = LIST_PLAY_LOOKAHEAD + LIST_PLAY_GAP_ATTEMPTS
    while (sessionRef.current === session && guard < cap) {
      guard += 1
      const id = idsToPrefetch(session.order, session.cursor, session.skipped, cachedIds(session))[0]
      if (!id) return
      const result = await fetchWorkPlayback(id)
      if (sessionRef.current !== session) return
      if (!result.ok || !result.hit.configured) return
      if (result.hit.uris.length === 0) session.skipped.add(id)
    }
  }

  function preparePlayback(): boolean {
    if (!apiRef.current.oauthConfigured) {
      // The toolbar already explains this. Keep that note quiet instead of turning it into an error.
      store.patch({ notice: null, noticeKind: null, noticeAction: null })
      return false
    }
    return true
  }

  function stopSession(session: Session, patch: Parameters<ListPlaybackStore["patch"]>[0]) {
    session.finished = true
    store.patch({ starting: false, resolvingWorkId: null, listActive: false, ...patch })
  }

  async function playWork(workId: string) {
    const current = store.getRow(workId)
    if (current.active && current.phase === "playing") {
      apiRef.current.pausePlayback()
      return
    }
    if (current.active && current.phase === "paused") {
      apiRef.current.resumePlayback()
      return
    }
    if (current.active && current.phase === "connecting") return

    const generation = bump()
    const session: Session = {
      mode: "single",
      generation,
      order: [workId],
      cursor: 0,
      skipped: new Set(),
      uris: [],
      shuffle: false,
      finished: false,
    }
    sessionRef.current = session
    store.patch({
      listActive: false,
      starting: true,
      activeWorkId: workId,
      resolvingWorkId: workId,
      notice: null,
      noticeAction: null,
      noticeKind: null,
    })
    if (!preparePlayback()) {
      stopSession(session, { activeWorkId: null })
      return
    }
    // Unlock browser audio in this click, before the Spotify match returns.
    apiRef.current.armPlayback()
    const found = await takePlayable(session, 0, 1)
    if (sessionRef.current !== session) return
    if (found === "stop") {
      stopSession(session, { activeWorkId: null })
      return
    }
    if (!found) {
      stopSession(session, {
        activeWorkId: null,
        notice: LIST_PLAY_NO_MATCH,
        noticeKind: "error",
        noticeAction: null,
      })
      return
    }
    beginFound(session, found)
  }

  async function playAll(options?: { shuffle?: boolean }) {
    const ids = idsRef.current
    if (ids.length === 0) return
    const shuffle = options?.shuffle ?? store.getState().random
    const generation = bump()
    const session: Session = {
      mode: "list",
      generation,
      order: shuffle ? shuffleWorkIds(ids) : [...ids],
      cursor: 0,
      skipped: new Set(),
      uris: [],
      shuffle,
      finished: false,
    }
    sessionRef.current = session
    store.patch({
      listActive: true,
      starting: true,
      activeWorkId: null,
      resolvingWorkId: null,
      notice: null,
      noticeAction: null,
      noticeKind: null,
    })
    if (!preparePlayback()) {
      stopSession(session, { activeWorkId: null })
      return
    }
    // Unlock browser audio in this click, before the Spotify match returns.
    apiRef.current.armPlayback()
    const found = await takePlayable(session, 0, LIST_PLAY_START_ATTEMPTS)
    if (sessionRef.current !== session) return
    if (found === "stop") {
      stopSession(session, { activeWorkId: null })
      return
    }
    if (!found) {
      stopSession(session, {
        activeWorkId: null,
        notice: LIST_PLAY_NO_LIST_MATCH,
        noticeKind: "error",
        noticeAction: null,
      })
      return
    }
    beginFound(session, found)
  }

  async function continueList(generation: number) {
    const session = sessionRef.current
    if (!session || session.generation !== generation || session.mode !== "list" || session.finished) return
    if (advancingRef.current) return
    const transport = transportGenerationRef.current
    advancingRef.current = true
    try {
      const found = await takePlayable(session, session.cursor + 1, LIST_PLAY_GAP_ATTEMPTS)
      if (transportGenerationRef.current !== transport) {
        if (sessionRef.current === session) store.patch({ resolvingWorkId: null })
        return
      }
      if (sessionRef.current !== session) return
      if (found === "stop") {
        stopSession(session, {})
        return
      }
      if (!found) {
        const early = listStoppedEarly(session.order, session.cursor, session.skipped)
        stopSession(
          session,
          early ? { notice: LIST_PLAY_GAP_STOPPED, noticeKind: "error", noticeAction: null } : {}
        )
        return
      }
      beginFound(session, found)
    } finally {
      advancingRef.current = false
    }
  }

  const continueListRef = useRef(continueList)
  const playWorkRef = useRef(playWork)
  const playAllRef = useRef(playAll)
  continueListRef.current = continueList
  playWorkRef.current = playWork
  playAllRef.current = playAll

  store.setHandlers({
    playWork: (workId) => {
      void playWorkRef.current(workId)
    },
    playAll: () => {
      const toolbar = store.getToolbar()
      const control = listPlayAllControl({
        listActive: toolbar.listActive,
        starting: toolbar.starting,
        phase: toolbar.phase,
      })
      if (control.action === "none") return
      if (control.action === "pause") {
        apiRef.current.pausePlayback()
        return
      }
      const session = sessionRef.current
      if (
        control.action === "resume" &&
        session &&
        !session.finished &&
        session.shuffle === store.getState().random
      ) {
        apiRef.current.resumePlayback()
        return
      }
      void playAllRef.current()
    },
    setRandom: (on) => {
      store.patch({ random: on })
      writeShufflePreference(typeof window === "undefined" ? null : window.localStorage, on)
    },
  })

  useEffect(() => {
    store.patch({ phase: playerPhase })
  }, [playerPhase, store])

  useEffect(() => {
    store.patch({ random: readShufflePreference(window.localStorage) })
  }, [store])

  useEffect(() => {
    if (!lastIssue) return
    apiRef.current.clearLastIssue()
    store.patch({
      notice: lastIssue.message || "Spotify could not start playback.",
      noticeKind: "error",
      noticeAction: null,
      starting: false,
    })
  }, [lastIssue, store])

  useEffect(() => {
    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
    const session = sessionRef.current
    if (activeUri) lastUriRef.current = activeUri
    if (!session || session.mode !== "list" || session.finished) return
    if (
      !shouldAdvanceList({
        mode: session.mode,
        playerPhase,
        activeUri,
        lastUri: lastUriRef.current,
        workUris: session.uris,
      })
    ) {
      return
    }
    const generation = session.generation
    const last = lastUriRef.current
    const cursor = session.cursor
    const transport = transportGenerationRef.current
    advanceTimerRef.current = window.setTimeout(() => {
      clearAdvanceTimers()
      if (transportGenerationRef.current !== transport) return
      if (lastUriRef.current !== last) return
      const current = sessionRef.current
      if (!current || current !== session || current.cursor !== cursor) return
      void continueListRef.current(generation)
    }, LIST_PLAY_ADVANCE_DELAY_MS)
    return () => {
      if (advanceTimerRef.current != null) {
        window.clearTimeout(advanceTimerRef.current)
        advanceTimerRef.current = null
      }
    }
  }, [activeUri, playerPhase])

  useEffect(() => {
    return spotify.registerContextEnded((uri) => {
      const session = sessionRef.current
      if (!session || !shouldChainListWork({
        mode: session.mode,
        finished: session.finished,
        workUris: session.uris,
        endedUri: uri,
      })) {
        return
      }
      const generation = session.generation
      const cursor = session.cursor
      const transport = transportGenerationRef.current
      if (contextEndTimerRef.current != null) window.clearTimeout(contextEndTimerRef.current)
      contextEndTimerRef.current = window.setTimeout(() => {
        clearAdvanceTimers()
        if (transportGenerationRef.current !== transport) return
        const current = sessionRef.current
        if (!current || current !== session || current.generation !== generation || current.finished) return
        if (current.cursor !== cursor) return
        void continueListRef.current(generation)
      }, LIST_PLAY_ADVANCE_DELAY_MS)
    })
  }, [spotify.registerContextEnded])

  useEffect(() => {
    return spotify.registerUserTransport(() => {
      transportGenerationRef.current += 1
      clearAdvanceTimers()
    })
  }, [spotify.registerUserTransport])

  return null
}

function WorkListToolbar({ count }: { count: number }) {
  const store = useWorkPlaybackStore()
  if (!store) return null
  return <WorkListToolbarInner store={store} count={count} />
}

function WorkListToolbarInner({ store, count }: { store: ListPlaybackStore; count: number }) {
  const randomId = useId()
  const toolbar = useSyncExternalStore(store.subscribe, store.getToolbar, store.getServerToolbar)
  const control = listPlayAllControl({
    listActive: toolbar.listActive,
    starting: toolbar.starting,
    phase: toolbar.phase,
  })
  const notice = toolbar.notice ?? (toolbar.oauthConfigured ? null : LIST_PLAY_NOT_CONFIGURED)
  const noticeIsQuiet = toolbar.noticeKind === "premium" || (!toolbar.notice && !toolbar.oauthConfigured)
  const showPause = control.action === "pause"
  const playAllTitle =
    control.action === "pause"
      ? "Pause playback"
      : control.action === "resume"
        ? "Resume this list"
        : toolbar.random
          ? `Play ${count.toLocaleString()} works in random order`
          : `Play ${count.toLocaleString()} works in list order`

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Button
          type="button"
          size="sm"
          className="cursor-pointer"
          disabled={!toolbar.oauthConfigured || control.action === "none"}
          aria-pressed={showPause}
          title={toolbar.oauthConfigured ? playAllTitle : LIST_PLAY_NOT_CONFIGURED}
          onClick={() => store.playAll()}
        >
          {control.action === "none" ? <Loader2 className="animate-spin" /> : showPause ? <Pause /> : <Play />}
          {control.label}
        </Button>
        <div className="flex cursor-pointer items-center gap-2">
          <Shuffle
            className={cn("size-4", toolbar.random ? "text-primary" : "text-muted-foreground")}
            aria-hidden
          />
          <Label htmlFor={randomId} className="cursor-pointer font-normal text-muted-foreground">
            Random
          </Label>
          <Switch
            id={randomId}
            className="cursor-pointer"
            checked={toolbar.random}
            onCheckedChange={(on) => store.setRandom(on)}
          />
        </div>
      </div>
      {notice ? (
        <p className={cn("mt-3 text-sm", noticeIsQuiet ? "text-muted-foreground" : "text-destructive")}>{notice}</p>
      ) : null}
    </div>
  )
}

export function WorkPlayButton({ workId, title }: { workId: string; title: string }) {
  const store = useWorkPlaybackStore()
  if (!store) return null
  return <WorkPlayButtonInner store={store} workId={workId} title={title} />
}

function WorkPlayButtonInner({
  store,
  workId,
  title,
}: {
  store: ListPlaybackStore
  workId: string
  title: string
}) {
  const row = useSyncExternalStore(store.subscribe, () => store.getRow(workId), serverIdleRow)
  const finding = row.resolving || (row.active && row.phase === "connecting")
  const revealed = row.active || row.resolving
  const label = finding
    ? `Finding a recording of ${title}`
    : row.active && row.phase === "playing"
      ? `Pause ${title}`
      : row.active && row.phase === "paused"
        ? `Resume ${title}`
        : `Play ${title}`

  return (
    <button
      type="button"
      className="work-play absolute top-1/2 z-10 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={label}
      title={label}
      aria-busy={finding}
      aria-pressed={row.active && (row.phase === "playing" || row.phase === "paused")}
      data-revealed={revealed ? "true" : undefined}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        store.playWork(workId)
      }}
    >
      {finding ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : row.phase === "playing" && row.active ? (
        <Pause className="size-4" aria-hidden />
      ) : (
        <Play className="size-4" aria-hidden />
      )}
    </button>
  )
}
