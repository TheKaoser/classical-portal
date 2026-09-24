import { orderedTrackUris } from "./spotify-playback.ts"

/**
 * List playback resolves Spotify the same way a work page does, but only for
 * the work that is about to play and a short lookahead.
 *
 * Play all starts on the first filtered work that has a recording (shuffled
 * first when Random is on). While that recording plays, the next two works
 * are matched in the background. When its last movement ends, the next work
 * starts through the existing in-page player. A list of thousands never
 * fans out into thousands of Spotify searches up front.
 *
 * Matching stops after a bounded number of misses so an unmatched stretch
 * cannot walk the whole catalog. The next Play all, or a row play, continues.
 */

/** Works matched ahead of the one currently playing. */
export const LIST_PLAY_LOOKAHEAD = 2

/** Spotify searches while starting Play all, including misses. */
export const LIST_PLAY_START_ATTEMPTS = 40

/** Spotify searches between works before playback stops and reports the gap. */
export const LIST_PLAY_GAP_ATTEMPTS = 8

/**
 * Wait after the player reports silence on the last movement.
 * A brief null state between movements must not skip the rest of the work.
 */
export const LIST_PLAY_ADVANCE_DELAY_MS = 700

export const LIST_SHUFFLE_STORAGE_KEY = "cp_list_shuffle"
export const PENDING_LIST_PLAYBACK_KEY = "cp_pending_list_playback"

export const LIST_PLAY_NOT_CONFIGURED =
  "Sequential playback needs Spotify login, which is not configured on this server."
export const LIST_PLAY_NO_MATCH = "No close catalog match for this work."
export const LIST_PLAY_NO_LIST_MATCH = "No close catalog matches in this list."
export const LIST_PLAY_STORAGE_BLOCKED = "Spotify login needs browser storage, which is blocked."
export const LIST_PLAY_GAP_STOPPED =
  "Playback stopped after several works in a row had no Spotify match."
export const LIST_PLAY_UNREACHABLE = "Spotify could not be reached. Try again."

export type ListPlayerPhase = "idle" | "connecting" | "playing" | "paused"

export type PendingListPlayback =
  | { kind: "work"; workId: string }
  | { kind: "list"; shuffle: boolean }

const WORK_ID = /^\d{1,12}$/

export function isCatalogWorkId(id: string): boolean {
  return WORK_ID.test(id)
}

export function workRecordingId(workId: string): string {
  return `work:${workId}`
}

/** Fisher–Yates. `random` returns a value in [0, 1). Does not mutate `ids`. */
export function shuffleWorkIds(ids: readonly string[], random: () => number = Math.random): string[] {
  const next = [...ids]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const swap = next[i]
    next[i] = next[j]
    next[j] = swap
  }
  return next
}

/** First recording that has playable tracks — the same default the work page selects. */
export function primaryRecordingUris(
  recordings: readonly { id: string; tracks: readonly { uri: string }[] }[]
): { recordingId: string; uris: string[] } | null {
  for (const recording of recordings) {
    const uris = orderedTrackUris([...recording.tracks])
    if (uris.length === 0) continue
    return { recordingId: recording.id, uris }
  }
  return null
}

export function isLastTrack(uris: readonly string[], uri: string | null): boolean {
  return Boolean(uri && uris.length > 0 && uris[uris.length - 1] === uri)
}

/**
 * True when list playback should move to the next work: the in-page player
 * has gone silent, and the last track it reported was the end of this work.
 */
export function shouldAdvanceList(input: {
  mode: "single" | "list"
  playerPhase: ListPlayerPhase
  activeUri: string | null
  lastUri: string | null
  workUris: readonly string[]
}): boolean {
  return (
    input.mode === "list" &&
    input.playerPhase === "playing" &&
    input.activeUri == null &&
    isLastTrack(input.workUris, input.lastUri)
  )
}

/**
 * Unresolved works within the lookahead window.
 * Skipped works (no recording) do not count. Cached playable works do.
 */
export function idsToPrefetch(
  order: readonly string[],
  cursor: number,
  skipped: ReadonlySet<string>,
  cached: ReadonlySet<string>,
  lookahead = LIST_PLAY_LOOKAHEAD
): string[] {
  const needed: string[] = []
  let ahead = 0
  for (let index = cursor + 1; index < order.length && ahead < lookahead; index += 1) {
    const id = order[index]
    if (skipped.has(id)) continue
    ahead += 1
    if (!cached.has(id)) needed.push(id)
  }
  return needed
}

/** True when works after `cursor` were never resolved (the miss cap stopped the scan). */
export function listStoppedEarly(
  order: readonly string[],
  cursor: number,
  skipped: ReadonlySet<string>
): boolean {
  for (let index = cursor + 1; index < order.length; index += 1) {
    if (!skipped.has(order[index])) return true
  }
  return false
}

export function listPlayAllControl(input: {
  listActive: boolean
  starting: boolean
  phase: ListPlayerPhase
}): { label: string; action: "start" | "pause" | "resume" | "none" } {
  if (input.starting) return { label: "Finding…", action: "none" }
  if (!input.listActive) return { label: "Play all", action: "start" }
  if (input.phase === "connecting") return { label: "Connecting…", action: "none" }
  if (input.phase === "playing") return { label: "Pause", action: "pause" }
  if (input.phase === "paused") return { label: "Play all", action: "resume" }
  return { label: "Play all", action: "start" }
}

export function readShufflePreference(storage: { getItem(key: string): string | null } | null): boolean {
  if (!storage) return false
  try {
    return storage.getItem(LIST_SHUFFLE_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function writeShufflePreference(
  storage: { setItem(key: string, value: string): void } | null,
  on: boolean
): void {
  if (!storage) return
  try {
    storage.setItem(LIST_SHUFFLE_STORAGE_KEY, on ? "1" : "0")
  } catch {
    // The toggle still works for this view when storage is blocked.
  }
}

export function parsePendingListPlayback(raw: string): PendingListPlayback | null {
  try {
    const value = JSON.parse(raw) as unknown
    if (!value || typeof value !== "object") return null
    const record = value as Record<string, unknown>
    if (record.kind === "work" && typeof record.workId === "string" && isCatalogWorkId(record.workId)) {
      return { kind: "work", workId: record.workId }
    }
    if (record.kind === "list" && typeof record.shuffle === "boolean") {
      return { kind: "list", shuffle: record.shuffle }
    }
    return null
  } catch {
    return null
  }
}
