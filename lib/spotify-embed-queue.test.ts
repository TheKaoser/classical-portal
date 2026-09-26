import assert from "node:assert/strict"
import { test } from "node:test"
import {
  EMBED_AUTOPLAY_GRACE_MS,
  EMBED_END_DEBOUNCE_MS,
  createMovementQueue,
  spotifyEmbedTheme,
  type CancelTimer,
  type EmbedPlaybackUpdate,
  type EmbedTransport,
  type MovementQueue,
  type MovementQueueOptions,
} from "./spotify-embed-queue.ts"

const FIRST = "spotify:track:i"
const SECOND = "spotify:track:ii"
const THIRD = "spotify:track:iii"
const DURATION = 180_000

function harness(options: Pick<MovementQueueOptions, "hidden" | "subscribeHidden"> = {}) {
  let time = 0
  const calls: string[] = []
  const events: string[] = []
  let pending: { fn: () => void; at: number } | null = null
  let queue!: MovementQueue

  const cancel = () => {
    pending = null
  }
  const schedule = (fn: () => void, delayMs: number): CancelTimer => {
    pending = { fn, at: time + delayMs }
    return cancel
  }
  const flush = () => {
    const due = pending
    if (!due || due.at > time) return
    pending = null
    due.fn()
  }

  const controller: EmbedTransport = {
    loadUri(uri) {
      calls.push(`loadUri:${uri}`)
    },
    play() {
      calls.push("play")
      queue.notePlayDispatched()
    },
    pause() {
      calls.push("pause")
    },
    resume() {
      calls.push("resume")
      queue.notePlayDispatched()
    },
  }

  queue = createMovementQueue(controller, {
    now: () => time,
    schedule,
    hidden: options.hidden,
    subscribeHidden: options.subscribeHidden,
    onPhase: (phase) => events.push(`phase:${phase}`),
    onTrack: (uri) => events.push(`track:${uri}`),
    onWorkEnded: (uri) => events.push(`ended:${uri}`),
    onNeedsGesture: (needed) => events.push(`gesture:${needed}`),
    onUserTransport: () => events.push("user"),
  })

  return {
    queue,
    calls,
    events,
    flush,
    setTime(ms: number) {
      time = ms
    },
    update(partial: Partial<EmbedPlaybackUpdate>) {
      queue.onPlaybackUpdate({
        isPaused: false,
        isBuffering: false,
        duration: DURATION,
        position: 0,
        playingURI: undefined,
        ...partial,
      })
    },
  }
}

test("spotify embed theme is dark only when the page is dark", () => {
  assert.equal(spotifyEmbedTheme(true), "dark")
  assert.equal(spotifyEmbedTheme(false), undefined)
})

test("play loads the first movement and plays it on the controller", () => {
  const { queue, calls, events } = harness()
  queue.start([FIRST, SECOND], 0)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
  assert.deepEqual(events.slice(0, 2), [`gesture:false`, `track:${FIRST}`])
})

test("play from a later movement starts there", () => {
  const { queue, calls } = harness()
  queue.start([FIRST, SECOND, THIRD], 1)
  assert.deepEqual(calls, [`loadUri:${SECOND}`, "play"])
})

test("a paused playhead near the duration advances after the debounce", () => {
  const { queue, calls, update, setTime, flush } = harness()
  queue.start([FIRST, SECOND, THIRD], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  setTime(1_000)
  update({ isPaused: false, position: 179_000, playingURI: FIRST })
  setTime(1_400)
  update({ isPaused: true, position: 179_200, playingURI: FIRST })
  setTime(1_400 + EMBED_END_DEBOUNCE_MS - 1)
  flush()
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
  setTime(1_400 + EMBED_END_DEBOUNCE_MS)
  flush()
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", `loadUri:${SECOND}`, "play"])
})

test("a flicker of pause at the end does not advance the queue", () => {
  const { queue, calls, update, setTime, flush } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 179_000, playingURI: FIRST })
  setTime(500)
  update({ isPaused: true, position: 179_400, playingURI: FIRST })
  setTime(500 + 100)
  update({ isPaused: false, position: 179_500, playingURI: FIRST })
  setTime(500 + EMBED_END_DEBOUNCE_MS + 50)
  flush()
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
})

test("rewind to 0 after the playhead reached the end advances", () => {
  const { queue, calls, update, setTime, flush } = harness()
  queue.start([FIRST, SECOND], 0)
  setTime(1_000)
  update({ isPaused: false, position: 170_000, playingURI: FIRST })
  setTime(12_000)
  update({ isPaused: true, position: 0, playingURI: FIRST })
  setTime(12_000 + EMBED_END_DEBOUNCE_MS)
  flush()
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", `loadUri:${SECOND}`, "play"])
})

test("a listener pause does not advance, including near the end", () => {
  const { queue, calls, events, update, setTime, flush } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 179_000, playingURI: FIRST })
  queue.pause()
  setTime(2_000)
  update({ isPaused: true, position: 179_200, playingURI: FIRST })
  setTime(2_000 + EMBED_END_DEBOUNCE_MS)
  flush()
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "pause"])
  assert.equal(events.includes("user"), true)
  assert.equal(events.some((event) => event.startsWith("ended:")), false)
})

test("the last movement ends the work and does not load another URI", () => {
  const { queue, calls, events, update, setTime, flush } = harness()
  queue.start([FIRST, SECOND], 1)
  update({ isPaused: false, position: 179_000, playingURI: SECOND })
  setTime(800)
  update({ isPaused: true, position: 179_600, playingURI: SECOND })
  setTime(800 + EMBED_END_DEBOUNCE_MS)
  flush()
  assert.deepEqual(calls, [`loadUri:${SECOND}`, "play"])
  assert.equal(events.includes(`ended:${SECOND}`), true)
})

test("autoplay that never starts asks for a tap and does not skip ahead", () => {
  const { queue, calls, events, update, setTime, flush } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: true, position: 0, duration: DURATION, playingURI: FIRST })
  setTime(EMBED_AUTOPLAY_GRACE_MS)
  flush()
  assert.equal(events.includes("gesture:true"), true)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
  queue.resume()
  assert.equal(calls.at(-1), "resume")
  update({ isPaused: false, position: 200, playingURI: FIRST })
  assert.equal(events.at(-1), "phase:playing")
  assert.equal(events.includes("gesture:false"), true)
})

test("a pause in the middle of a movement is not the end", () => {
  const { queue, calls, update, setTime, flush } = harness()
  queue.start([FIRST, SECOND], 0)
  setTime(1_000)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  setTime(1_200)
  update({ isPaused: true, position: 40_200, playingURI: FIRST })
  setTime(1_200 + EMBED_END_DEBOUNCE_MS)
  flush()
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
})

test("starting another queue cancels the previous end timer", () => {
  const { queue, calls, update, setTime, flush } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 179_000, playingURI: FIRST })
  setTime(300)
  update({ isPaused: true, position: 179_500, playingURI: FIRST })
  queue.start([THIRD], 0)
  setTime(300 + EMBED_END_DEBOUNCE_MS)
  flush()
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", `loadUri:${THIRD}`, "play"])
})

test("a hidden tab advances on the playback update without waiting", () => {
  const { queue, calls, update } = harness({ hidden: () => true })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  update({ isPaused: true, position: 179_200, playingURI: FIRST })
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", `loadUri:${SECOND}`, "play"])
})

test("a hidden tab does not cut the track in the last moments", () => {
  const { queue, calls, update } = harness({ hidden: () => true })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION - 1_000, playingURI: FIRST })
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", `loadUri:${SECOND}`, "play"])
})

test("an album document advances movements without another load", () => {
  const ALBUM = "spotify:album:5Z9iiGl2FcIfa3BMiv6OIw"
  const { queue, calls, events, update } = harness()
  queue.start([FIRST, SECOND], 0, ALBUM)
  assert.deepEqual(calls, [`loadUri:${ALBUM}`, "play"])
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: 2_000, playingURI: SECOND })
  assert.deepEqual(calls, [`loadUri:${ALBUM}`, "play"])
  assert.equal(events.includes(`track:${SECOND}`), true)
  update({ isPaused: false, position: 1_000, playingURI: "spotify:track:extra" })
  assert.deepEqual(calls, [`loadUri:${ALBUM}`, "play", "pause"])
  assert.equal(events.includes(`ended:${SECOND}`), true)
})

test("an album that does not open on the first movement falls back to that track", () => {
  const ALBUM = "spotify:album:5Z9iiGl2FcIfa3BMiv6OIw"
  const { queue, calls, update } = harness()
  queue.start([FIRST, SECOND], 0, ALBUM)
  update({ isPaused: false, isBuffering: true, position: 0, duration: 0, playingURI: "" })
  update({ isPaused: false, position: 1_000, playingURI: "spotify:track:other" })
  assert.deepEqual(calls, [`loadUri:${ALBUM}`, "play", `loadUri:${FIRST}`, "play"])
})

test("the last album track ends the work without loading another document", () => {
  const ALBUM = "spotify:album:5Z9iiGl2FcIfa3BMiv6OIw"
  const { queue, calls, events, update } = harness({ hidden: () => true })
  queue.start([FIRST], 0, ALBUM)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  assert.deepEqual(calls, [`loadUri:${ALBUM}`, "play", "pause"])
  assert.equal(events.includes(`ended:${FIRST}`), true)
})

test("a leftover update is not treated as the album's first track", () => {
  const ALBUM = "spotify:album:5Z9iiGl2FcIfa3BMiv6OIw"
  const { queue, calls, update } = harness()
  queue.start([FIRST, SECOND], 0, ALBUM)
  update({ isPaused: false, position: 1_000, playingURI: "spotify:track:previous" })
  assert.deepEqual(calls, [`loadUri:${ALBUM}`, "play"])
})

test("a later movement does not use the album document", () => {
  const ALBUM = "spotify:album:5Z9iiGl2FcIfa3BMiv6OIw"
  const { queue, calls } = harness()
  queue.start([FIRST, SECOND], 1, ALBUM)
  assert.deepEqual(calls, [`loadUri:${SECOND}`, "play"])
})

test("nudge replays only while the load has not started", () => {
  const { queue, calls, update } = harness()
  queue.start([FIRST], 0)
  queue.nudgeIfWaiting()
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  queue.nudgeIfWaiting()
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "play"])
})

test("reaching the duration advances even while the embed still says playing", () => {
  const { queue, calls, update } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", `loadUri:${SECOND}`, "play"])
})

test("hiding the tab flushes a pending end without the debounce", () => {
  let listener: (() => void) | null = null
  const { queue, calls, update } = harness({
    subscribeHidden(fn) {
      listener = fn
      return () => {
        listener = null
      }
    },
  })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 179_000, playingURI: FIRST })
  update({ isPaused: true, position: 179_200, playingURI: FIRST })
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
  listener?.()
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", `loadUri:${SECOND}`, "play"])
})

test("next and previous load another movement on the same controller", () => {
  const { queue, calls, events } = harness()
  queue.start([FIRST, SECOND, THIRD], 0)
  queue.next()
  queue.previous()
  queue.next()
  queue.next()
  assert.deepEqual(calls, [
    `loadUri:${FIRST}`,
    "play",
    `loadUri:${SECOND}`,
    "play",
    `loadUri:${FIRST}`,
    "play",
    `loadUri:${SECOND}`,
    "play",
    `loadUri:${THIRD}`,
    "play",
  ])
  queue.next()
  assert.equal(events.includes(`ended:${THIRD}`), true)
  assert.equal(calls.filter((call) => call.startsWith("loadUri:")).length, 5)
})

test("buffering at the end is not treated as the end", () => {
  const { queue, calls, update, setTime, flush } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 179_000, playingURI: FIRST })
  setTime(100)
  update({ isPaused: true, isBuffering: true, position: 179_800, playingURI: FIRST })
  setTime(100 + EMBED_END_DEBOUNCE_MS)
  flush()
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
})
