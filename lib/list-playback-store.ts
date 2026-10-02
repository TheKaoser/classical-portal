import type { ListPlayerPhase } from "./list-playback.ts"

export type RowPlayback = {
  active: boolean
  resolving: boolean
  phase: ListPlayerPhase
}

export const IDLE_ROW: RowPlayback = { active: false, resolving: false, phase: "idle" }

export type NoticeKind = "error" | "premium" | null
export type NoticeAction = "login" | "reconnect" | null

export type ToolbarPlayback = {
  starting: boolean
  listActive: boolean
  phase: ListPlayerPhase
  notice: string | null
  noticeKind: NoticeKind
  noticeAction: NoticeAction
  random: boolean
  oauthConfigured: boolean
  /** True while a work's Spotify match is in flight (row play, Play all, or Next). */
  resolving: boolean
}

type State = Omit<ToolbarPlayback, "resolving"> & {
  activeWorkId: string | null
  resolvingWorkId: string | null
}

export type PlaybackHandlers = {
  playWork: (workId: string) => void
  playAll: () => void
  setRandom: (on: boolean) => void
  nextWork: () => void
}

const noopHandlers: PlaybackHandlers = {
  playWork: () => {},
  playAll: () => {},
  setRandom: () => {},
  nextWork: () => {},
}

export type ListPlaybackStore = {
  subscribe: (listener: () => void) => () => void
  getRow: (workId: string) => RowPlayback
  getToolbar: () => ToolbarPlayback
  getServerToolbar: () => ToolbarPlayback
  getState: () => State
  patch: (partial: Partial<State>) => void
  setHandlers: (handlers: PlaybackHandlers) => void
  playWork: (workId: string) => void
  playAll: () => void
  setRandom: (on: boolean) => void
  nextWork: () => void
}

function toToolbar(state: State): ToolbarPlayback {
  return {
    starting: state.starting,
    listActive: state.listActive,
    phase: state.phase,
    notice: state.notice,
    noticeKind: state.noticeKind,
    noticeAction: state.noticeAction,
    random: state.random,
    oauthConfigured: state.oauthConfigured,
    resolving: state.resolvingWorkId !== null,
  }
}

function toolbarEqual(a: ToolbarPlayback, b: ToolbarPlayback): boolean {
  return (
    a.starting === b.starting &&
    a.listActive === b.listActive &&
    a.phase === b.phase &&
    a.notice === b.notice &&
    a.noticeKind === b.noticeKind &&
    a.noticeAction === b.noticeAction &&
    a.random === b.random &&
    a.oauthConfigured === b.oauthConfigured &&
    a.resolving === b.resolving
  )
}

/**
 * Row snapshots stay stable for works that are not playing or resolving,
 * so a long list does not re-render every row when the active work changes.
 */
export function createListPlaybackStore(oauthConfigured: boolean): ListPlaybackStore {
  let handlers = noopHandlers
  let state: State = {
    activeWorkId: null,
    resolvingWorkId: null,
    starting: false,
    listActive: false,
    phase: "idle",
    notice: null,
    noticeKind: null,
    noticeAction: null,
    random: false,
    oauthConfigured,
  }
  const initialToolbar = toToolbar(state)
  let toolbar = initialToolbar
  const rowSnaps = new Map<string, { key: string; row: RowPlayback }>()
  const listeners = new Set<() => void>()

  function emit() {
    for (const listener of listeners) listener()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getRow(workId) {
      const active = state.activeWorkId === workId
      const resolving = state.resolvingWorkId === workId
      if (!active && !resolving) {
        rowSnaps.delete(workId)
        return IDLE_ROW
      }
      const phase = active ? state.phase : "idle"
      const key = `${resolving}:${phase}`
      const cached = rowSnaps.get(workId)
      if (cached && cached.key === key) return cached.row
      const row = { active, resolving, phase }
      rowSnaps.set(workId, { key, row })
      return row
    },
    getToolbar() {
      return toolbar
    },
    getServerToolbar() {
      return initialToolbar
    },
    getState() {
      return state
    },
    patch(partial) {
      const next: State = { ...state, ...partial }
      const keys = Object.keys(partial) as (keyof State)[]
      if (keys.length === 0 || keys.every((key) => state[key] === next[key])) return
      state = next
      const nextToolbar = toToolbar(state)
      if (!toolbarEqual(toolbar, nextToolbar)) toolbar = nextToolbar
      emit()
    },
    setHandlers(next) {
      handlers = next
    },
    playWork(workId) {
      handlers.playWork(workId)
    },
    playAll() {
      handlers.playAll()
    },
    setRandom(on) {
      handlers.setRandom(on)
    },
    nextWork() {
      handlers.nextWork()
    },
  }
}
