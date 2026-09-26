import assert from "node:assert/strict"
import { test } from "node:test"
import { createListPlaybackStore, IDLE_ROW } from "./list-playback-store.ts"
import {
  idsToPrefetch,
  isCatalogWorkId,
  isLastTrack,
  LIST_PLAY_ADVANCE_DELAY_MS,
  listPlayAllControl,
  listStoppedEarly,
  runListChain,
  parsePendingListPlayback,
  primaryRecordingUris,
  readShufflePreference,
  shouldAdvanceList,
  shouldChainListWork,
  shuffleWorkIds,
  workRecordingId,
  writeShufflePreference,
} from "./list-playback.ts"

test("shuffleWorkIds permutes without mutating the source", () => {
  const ids = ["a", "b", "c", "d"]
  assert.deepEqual(shuffleWorkIds(ids, () => 0), ["b", "c", "d", "a"])
  assert.deepEqual(ids, ["a", "b", "c", "d"])
  assert.deepEqual(shuffleWorkIds(["only"], () => 0), ["only"])
})

test("primaryRecordingUris uses the first recording that has tracks", () => {
  assert.equal(primaryRecordingUris([]), null)
  assert.equal(primaryRecordingUris([{ id: "empty", tracks: [] }]), null)
  assert.deepEqual(
    primaryRecordingUris([
      { id: "empty", tracks: [{ uri: "not-a-track" }] },
      { id: "album", tracks: [{ uri: "spotify:track:aaa" }, { uri: "spotify:track:aaa" }, { uri: "spotify:track:bbb" }] },
    ]),
    { recordingId: "album", uris: ["spotify:track:aaa", "spotify:track:bbb"] }
  )
})

test("shouldChainListWork follows the play-all order after the last movement", () => {
  const uris = ["spotify:track:i", "spotify:track:ii"]
  assert.equal(
    shouldChainListWork({ mode: "list", finished: false, workUris: uris, endedUri: "spotify:track:ii" }),
    true
  )
  assert.equal(
    shouldChainListWork({ mode: "list", finished: false, workUris: uris, endedUri: "spotify:track:i" }),
    false
  )
  assert.equal(
    shouldChainListWork({ mode: "single", finished: false, workUris: uris, endedUri: "spotify:track:ii" }),
    false
  )
  assert.equal(
    shouldChainListWork({ mode: "list", finished: true, workUris: uris, endedUri: "spotify:track:ii" }),
    false
  )
})

test("shouldAdvanceList only at the end of a list session", () => {
  const uris = ["spotify:track:i", "spotify:track:ii"]
  assert.equal(
    shouldAdvanceList({
      mode: "list",
      playerPhase: "playing",
      activeUri: null,
      lastUri: "spotify:track:ii",
      workUris: uris,
    }),
    true
  )
  assert.equal(
    shouldAdvanceList({
      mode: "list",
      playerPhase: "playing",
      activeUri: null,
      lastUri: "spotify:track:i",
      workUris: uris,
    }),
    false
  )
  assert.equal(
    shouldAdvanceList({
      mode: "single",
      playerPhase: "playing",
      activeUri: null,
      lastUri: "spotify:track:ii",
      workUris: uris,
    }),
    false
  )
  assert.equal(
    shouldAdvanceList({
      mode: "list",
      playerPhase: "paused",
      activeUri: null,
      lastUri: "spotify:track:ii",
      workUris: uris,
    }),
    false
  )
  assert.equal(
    shouldAdvanceList({
      mode: "list",
      playerPhase: "connecting",
      activeUri: null,
      lastUri: "spotify:track:ii",
      workUris: uris,
    }),
    false
  )
  assert.equal(isLastTrack(uris, "spotify:track:ii"), true)
  assert.equal(isLastTrack(uris, null), false)
})

test("idsToPrefetch fills the lookahead and skips known misses", () => {
  const order = ["a", "b", "c", "d", "e"]
  assert.deepEqual(idsToPrefetch(order, 0, new Set(), new Set()), ["b", "c"])
  assert.deepEqual(idsToPrefetch(order, 0, new Set(), new Set(["b"])), ["c"])
  assert.deepEqual(idsToPrefetch(order, 0, new Set(["b"]), new Set()), ["c", "d"])
  assert.deepEqual(idsToPrefetch(order, 4, new Set(), new Set()), [])
})

test("listStoppedEarly reports an unfinished tail", () => {
  assert.equal(listStoppedEarly(["a", "b", "c"], 0, new Set(["b"])), true)
  assert.equal(listStoppedEarly(["a", "b", "c"], 0, new Set(["b", "c"])), false)
  assert.equal(listStoppedEarly(["a", "b"], 1, new Set()), false)
})

test("runListChain waits while the tab is visible and runs immediately in the background", () => {
  let ran = 0
  const scheduled: number[] = []
  const visible = runListChain(false, () => {
    ran += 1
  }, (_chain, delayMs) => {
    scheduled.push(delayMs)
    return 4
  })
  assert.equal(ran, 0)
  assert.deepEqual(scheduled, [LIST_PLAY_ADVANCE_DELAY_MS])
  assert.equal(visible, 4)

  const hidden = runListChain(true, () => {
    ran += 1
  }, () => {
    throw new Error("background chaining must not schedule a timer")
  })
  assert.equal(ran, 1)
  assert.equal(hidden, null)
})

test("listPlayAllControl", () => {
  assert.deepEqual(listPlayAllControl({ listActive: false, starting: false, phase: "idle" }), {
    label: "Play all",
    action: "start",
  })
  assert.deepEqual(listPlayAllControl({ listActive: true, starting: true, phase: "playing" }), {
    label: "Finding…",
    action: "none",
  })
  assert.deepEqual(listPlayAllControl({ listActive: true, starting: false, phase: "playing" }), {
    label: "Pause",
    action: "pause",
  })
  assert.deepEqual(listPlayAllControl({ listActive: true, starting: false, phase: "paused" }), {
    label: "Play all",
    action: "resume",
  })
  assert.deepEqual(listPlayAllControl({ listActive: true, starting: false, phase: "connecting" }), {
    label: "Connecting…",
    action: "none",
  })
})

test("parsePendingListPlayback accepts a work or the filtered list", () => {
  assert.deepEqual(parsePendingListPlayback(JSON.stringify({ kind: "work", workId: "7884" })), {
    kind: "work",
    workId: "7884",
  })
  assert.deepEqual(parsePendingListPlayback(JSON.stringify({ kind: "list", shuffle: true })), {
    kind: "list",
    shuffle: true,
  })
  assert.equal(parsePendingListPlayback("{"), null)
  assert.equal(parsePendingListPlayback(JSON.stringify({ kind: "work", workId: "../x" })), null)
  assert.equal(parsePendingListPlayback(JSON.stringify({ kind: "list", shuffle: "yes" })), null)
  assert.equal(isCatalogWorkId("7884"), true)
  assert.equal(isCatalogWorkId("work:1"), false)
  assert.equal(workRecordingId("7884"), "work:7884")
})

test("shuffle preference is a stored boolean", () => {
  const saved = new Map<string, string>()
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value)
    },
  }
  assert.equal(readShufflePreference(storage), false)
  writeShufflePreference(storage, true)
  assert.equal(readShufflePreference(storage), true)
  writeShufflePreference(storage, false)
  assert.equal(readShufflePreference(storage), false)
  assert.equal(readShufflePreference(null), false)
})

test("row snapshots stay stable for works that are not playing", () => {
  const store = createListPlaybackStore(true)
  const idleA = store.getRow("1")
  const idleB = store.getRow("2")
  assert.equal(idleA, IDLE_ROW)
  assert.equal(idleB, IDLE_ROW)

  store.patch({ activeWorkId: "1", resolvingWorkId: "2", phase: "playing" })
  const active = store.getRow("1")
  const resolving = store.getRow("2")
  const stillIdle = store.getRow("3")
  assert.equal(stillIdle, IDLE_ROW)
  assert.deepEqual(active, { active: true, resolving: false, phase: "playing" })
  assert.deepEqual(resolving, { active: false, resolving: true, phase: "idle" })
  assert.equal(store.getRow("1"), active)
  assert.equal(store.getRow("2"), resolving)

  const toolbar = store.getToolbar()
  store.patch({ activeWorkId: "9" })
  assert.equal(store.getToolbar(), toolbar)
  assert.equal(store.getRow("3"), IDLE_ROW)
  assert.notEqual(store.getRow("1"), active)
})
