import assert from "node:assert/strict"
import { test } from "node:test"
import {
  EMBED_AUTOPLAY_GRACE_MS,
  EMBED_END_DEBOUNCE_MS,
  EMBED_FOREGROUND_DELAY_MS,
  EMBED_LOAD_RETRY_DELAY_MS,
  EMBED_LOAD_RETRY_LIMIT,
  EMBED_PLAY_RETRY_DELAYS_MS,
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
const FOURTH = "spotify:track:iv"
const DURATION = 180_000

function loadsOf(calls: string[], uri: string): string[] {
  return calls.filter((call) => call === `loadUri:${uri}`)
}

/** Each delay is scheduled when the previous one fires, so step them one at a time. */
function stepDelays(advance: (ms: number) => void, delays: readonly number[]) {
  for (const delay of delays) advance(delay)
}

function harness(options: Pick<MovementQueueOptions, "hidden" | "subscribeHidden"> = {}) {
  let time = 0
  const calls: string[] = []
  const events: string[] = []
  let nextTimerId = 1
  const timers: { id: number; fn: () => void; at: number }[] = []
  let queue!: MovementQueue

  const schedule = (fn: () => void, delayMs: number): CancelTimer => {
    const id = nextTimerId
    nextTimerId += 1
    timers.push({ id, fn, at: time + delayMs })
    return () => {
      const index = timers.findIndex((timer) => timer.id === id)
      if (index >= 0) timers.splice(index, 1)
    }
  }
  const drain = () => {
    for (;;) {
      let earliest = -1
      for (let i = 0; i < timers.length; i += 1) {
        const timer = timers[i]
        if (!timer || timer.at > time) continue
        if (earliest < 0) {
          earliest = i
          continue
        }
        const best = timers[earliest]
        if (!best) continue
        if (timer.at < best.at || (timer.at === best.at && timer.id < best.id)) earliest = i
      }
      if (earliest < 0) return
      const [timer] = timers.splice(earliest, 1)
      timer?.fn()
    }
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
    onUserTransport: () => events.push("user"),
  })

  return {
    queue,
    calls,
    events,
    flush: drain,
    advance(ms: number) {
      time += ms
      drain()
    },
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
  assert.deepEqual(events.slice(0, 2), [`track:${FIRST}`, "phase:connecting"])
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
  assert.deepEqual(calls, [`loadUri:${SECOND}`, "play", "pause"])
  assert.equal(events.includes(`ended:${SECOND}`), true)
  assert.equal(calls.some((call) => call.includes("spotify:album:")), false)
})

test("autoplay that never starts stays on the loaded track until play or visibility", () => {
  const { queue, calls, events, update, advance } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: true, position: 0, duration: DURATION, playingURI: FIRST })
  stepDelays(advance, EMBED_PLAY_RETRY_DELAYS_MS)
  for (let attempt = 0; attempt < EMBED_LOAD_RETRY_LIMIT; attempt += 1) {
    advance(EMBED_LOAD_RETRY_DELAY_MS)
    stepDelays(advance, EMBED_PLAY_RETRY_DELAYS_MS)
  }
  advance(EMBED_AUTOPLAY_GRACE_MS)
  assert.equal(events.includes("phase:paused"), true)
  assert.equal(events.some((event) => event.startsWith("gesture:")), false)
  assert.equal(loadsOf(calls, FIRST).length, 1 + EMBED_LOAD_RETRY_LIMIT)
  assert.equal(calls.includes(`loadUri:${SECOND}`), false)
  queue.resume()
  assert.equal(calls.at(-1), "resume")
  update({ isPaused: false, position: 200, playingURI: FIRST })
  assert.equal(events.at(-1), "phase:playing")
  queue.nudgeIfWaiting()
  assert.equal(calls.includes(`loadUri:${SECOND}`), false)
  assert.equal(calls.some((call) => call.includes("spotify:album:")), false)
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

test("a hidden tab queues the next movement and starts it when the tab returns", () => {
  let hidden = false
  const { queue, calls, events, update, advance } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND, THIRD], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  hidden = true
  update({ isPaused: true, position: 179_200, playingURI: FIRST })
  assert.equal(events.includes(`track:${SECOND}`), true)
  assert.equal(events.includes(`track:${THIRD}`), false)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "pause"])
  hidden = false
  queue.nudgeIfWaiting()
  assert.equal(calls.includes(`loadUri:${SECOND}`), false)
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "pause", `loadUri:${SECOND}`, "play"])
  assert.equal(calls.includes(`loadUri:${THIRD}`), false)
  assert.equal(calls.some((call) => call.includes("spotify:album:")), false)
})

test("a hidden tab does not cut the track in the last moments", () => {
  let hidden = false
  const { queue, calls, events, update, advance } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  hidden = true
  update({ isPaused: false, position: DURATION - 1_000, playingURI: FIRST })
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
  assert.equal(events.includes(`track:${SECOND}`), false)
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  assert.equal(events.includes(`track:${SECOND}`), true)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "pause"])
  hidden = false
  queue.nudgeIfWaiting()
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "pause", `loadUri:${SECOND}`, "play"])
})

test("a work loads its first movement track and never an album", () => {
  const { queue, calls, events } = harness()
  queue.start([FIRST, SECOND, THIRD], 0)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
  assert.equal(calls.some((call) => call.includes("spotify:album:")), false)
  assert.deepEqual(events.slice(0, 2), [`track:${FIRST}`, "phase:connecting"])
})

test("ending a movement highlights the next one and loads only that track", () => {
  const { queue, calls, events, update } = harness()
  queue.start([FIRST, SECOND, THIRD], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  assert.equal(events.includes(`track:${SECOND}`), true)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", `loadUri:${SECOND}`, "play"])
  update({ isPaused: false, position: 1_000, playingURI: SECOND })
  update({ isPaused: false, position: DURATION, playingURI: SECOND })
  assert.equal(events.includes(`track:${THIRD}`), true)
  assert.deepEqual(calls, [
    `loadUri:${FIRST}`,
    "play",
    `loadUri:${SECOND}`,
    "play",
    `loadUri:${THIRD}`,
    "play",
  ])
})

test("the last movement pauses and a later album track does not load", () => {
  const { queue, calls, events, update } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  update({ isPaused: false, position: 1_000, playingURI: SECOND })
  update({ isPaused: false, position: DURATION, playingURI: SECOND })
  assert.deepEqual(
    calls.filter((call) => call.startsWith("loadUri:")),
    [`loadUri:${FIRST}`, `loadUri:${SECOND}`]
  )
  assert.equal(events.filter((event) => event.startsWith("ended:")).length, 1)
  assert.equal(events.includes(`ended:${SECOND}`), true)
  assert.equal(calls.at(-1), "pause")
  update({ isPaused: false, position: 40, playingURI: "spotify:track:extra" })
  assert.equal(calls.filter((call) => call === "pause").length, 2)
  assert.equal(calls.some((call) => call.includes("extra") || call.includes("spotify:album:")), false)
  assert.deepEqual(
    events.filter((event) => event.startsWith("ended:")),
    [`ended:${SECOND}`]
  )
})

test("a stale URI from the previous document does not skip or stop", () => {
  const { queue, calls, events, update } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 170_000, playingURI: "spotify:track:previous" })
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
  assert.equal(events.some((event) => event.startsWith("ended:")), false)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  assert.equal(events.includes(`track:${SECOND}`), false)
})

test("a later movement starts on that track", () => {
  const { queue, calls } = harness()
  queue.start([FIRST, SECOND], 1)
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
  let hidden = false
  const hiddenListener: { fn: (() => void) | null } = { fn: null }
  const { queue, calls, events, update, advance } = harness({
    hidden: () => hidden,
    subscribeHidden(fn: () => void) {
      hiddenListener.fn = fn
      return () => {
        hiddenListener.fn = null
      }
    },
  })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 179_000, playingURI: FIRST })
  update({ isPaused: true, position: 179_200, playingURI: FIRST })
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
  hidden = true
  hiddenListener.fn?.()
  assert.equal(events.includes(`track:${SECOND}`), true)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "pause"])
  hidden = false
  queue.nudgeIfWaiting()
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "pause", `loadUri:${SECOND}`, "play"])
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

test("spotify advancing inside the work highlights that movement and loads only its track", () => {
  const { queue, calls, events, update } = harness()
  queue.start([FIRST, SECOND, THIRD], 0)
  update({ isPaused: false, position: 4_000, playingURI: FIRST })
  update({ isPaused: false, position: 50_000, playingURI: "https://open.spotify.com/track/iii?si=abc" })
  update({ isPaused: false, position: 51_000, playingURI: THIRD })
  update({ isPaused: false, position: 50_000, playingURI: SECOND })
  assert.equal(events.includes(`track:${THIRD}`), true)
  assert.equal(events.includes(`track:${SECOND}`), true)
  assert.deepEqual(
    calls.filter((call) => call.startsWith("loadUri:")),
    [`loadUri:${FIRST}`, `loadUri:${THIRD}`, `loadUri:${SECOND}`]
  )
  assert.equal(calls.includes("pause"), false)
  assert.equal(calls.some((call) => call.includes("spotify:album:")), false)
})

test("a hidden tab does not cut a movement that is not the last", () => {
  let hidden = false
  const { queue, calls, events, update, advance } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  hidden = true
  update({ isPaused: false, position: DURATION - 200, playingURI: FIRST })
  assert.equal(calls.includes("pause"), false)
  assert.equal(events.includes(`track:${SECOND}`), false)
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  assert.equal(events.includes(`track:${SECOND}`), true)
  assert.equal(calls.includes(`loadUri:${SECOND}`), false)
  hidden = false
  queue.nudgeIfWaiting()
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "pause", `loadUri:${SECOND}`, "play"])
})

test("a missing playingURI still stops the last movement from position", () => {
  let hidden = false
  const { queue, calls, events, update } = harness({ hidden: () => hidden })
  queue.start([FIRST], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  hidden = true
  update({ isPaused: false, position: DURATION - 800, playingURI: "" })
  assert.equal(calls.includes("pause"), false)
  update({ isPaused: false, position: DURATION, playingURI: "" })
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "pause"])
  assert.equal(events.includes(`ended:${FIRST}`), true)
  hidden = false
  queue.nudgeIfWaiting()
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "pause"])
})

test("a missing playingURI at the boundary advances to the next movement", () => {
  const { queue, calls, events, update } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION - 500, playingURI: FIRST })
  update({ isPaused: false, position: DURATION, playingURI: "" })
  assert.equal(events.includes(`track:${SECOND}`), true)
  assert.equal(calls.includes("pause"), false)
  update({ isPaused: false, position: 1_000, playingURI: SECOND })
  update({ isPaused: false, position: DURATION, playingURI: "" })
  assert.equal(events.includes(`ended:${SECOND}`), true)
  assert.equal(calls.at(-1), "pause")
})

test("the same playingURI rewinding is not the next movement", () => {
  const { queue, calls, events, update } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION - 500, playingURI: FIRST })
  update({ isPaused: false, position: 200, playingURI: FIRST })
  assert.equal(events.includes(`track:${SECOND}`), false)
  assert.equal(calls.includes("pause"), false)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
})

test("playback_started syncs an in-work URI and stops an outside one", () => {
  const { queue, calls, events, update } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  queue.notePlayingUri("https://open.spotify.com/embed/track/ii")
  assert.equal(events.includes(`track:${SECOND}`), true)
  assert.equal(calls.includes("pause"), false)
  assert.equal(calls.includes(`loadUri:${SECOND}`), true)
  update({ isPaused: false, position: 1_000, playingURI: SECOND })
  queue.notePlayingUri("spotify:track:extra")
  assert.equal(calls.at(-1), "pause")
  assert.equal(events.includes(`ended:${SECOND}`), true)
  assert.equal(calls.some((call) => call.includes("extra")), false)
})

test("leaving the work for another album track pauses and does not resume that track", () => {
  const { queue, calls, events, update } = harness()
  queue.start([FIRST, SECOND, THIRD], 0)
  update({ isPaused: false, position: 4_000, playingURI: FIRST })
  update({ isPaused: false, position: 20_000, playingURI: "spotify:track:extra" })
  assert.equal(calls.at(-1), "pause")
  assert.equal(events.includes(`ended:${FIRST}`), true)
  assert.equal(events.includes(`track:${SECOND}`), false)
  queue.resume()
  assert.equal(calls.at(-2), `loadUri:${FIRST}`)
  assert.equal(calls.at(-1), "play")
  assert.equal(events.includes(`track:${FIRST}`), true)
})

test("a background rewind after real playback queues the next movement", () => {
  let hidden = false
  const { queue, calls, events, update, advance } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  hidden = true
  queue.notePageHidden(true)
  update({ isPaused: true, position: 0, playingURI: FIRST })
  assert.equal(events.includes(`track:${SECOND}`), true)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "pause"])
  hidden = false
  queue.notePageHidden(false)
  queue.nudgeIfWaiting()
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play", "pause", `loadUri:${SECOND}`, "play"])
})

test("a visible scrub back to the start does not advance", () => {
  const { queue, calls, events, update, setTime, flush } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  setTime(2_000)
  update({ isPaused: true, position: 0, playingURI: FIRST })
  setTime(2_000 + EMBED_END_DEBOUNCE_MS)
  flush()
  assert.equal(events.includes(`track:${SECOND}`), false)
  assert.deepEqual(calls, [`loadUri:${FIRST}`, "play"])
})

test("a rewound playhead that arrives after the tab is visible starts the next movement", () => {
  let hidden = false
  const { queue, calls, events, update, advance } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  hidden = true
  queue.notePageHidden(true)
  hidden = false
  queue.notePageHidden(false)
  queue.nudgeIfWaiting()
  update({ isPaused: true, position: 0, playingURI: FIRST })
  assert.equal(events.includes(`track:${SECOND}`), true)
  assert.equal(calls.includes(`loadUri:${SECOND}`), false)
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.equal(calls.includes(`loadUri:${SECOND}`), true)
  assert.equal(calls.includes(`loadUri:${THIRD}`), false)
})

test("the next queued work waits for a visible tab and does not load an album", () => {
  let hidden = false
  const { queue, calls, events, advance } = harness({ hidden: () => hidden })
  hidden = true
  queue.start([FIRST, SECOND], 0)
  assert.equal(events.includes(`track:${FIRST}`), true)
  assert.deepEqual(calls, ["pause"])
  assert.equal(calls.some((call) => call.includes("spotify:album:")), false)
  queue.nudgeIfWaiting()
  assert.deepEqual(calls, ["pause"])
  hidden = false
  queue.nudgeIfWaiting()
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.deepEqual(calls, ["pause", `loadUri:${FIRST}`, "play"])
})

test("a held movement ignores an outside track and still starts the held one", () => {
  let hidden = false
  const { queue, calls, events, update, advance } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  hidden = true
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  update({ isPaused: false, position: 20_000, playingURI: "spotify:track:extra" })
  assert.equal(events.some((event) => event.startsWith("ended:")), false)
  assert.equal(calls.some((call) => call.includes("extra") || call.includes("spotify:album:")), false)
  hidden = false
  queue.nudgeIfWaiting()
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.equal(events.includes(`track:${SECOND}`), true)
  assert.equal(calls.at(-2), `loadUri:${SECOND}`)
  assert.equal(calls.at(-1), "play")
})

test("a listener pause keeps a held movement from starting until resume", () => {
  let hidden = false
  const { queue, calls, events, update } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  hidden = true
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  queue.pause()
  hidden = false
  queue.nudgeIfWaiting()
  assert.equal(calls.includes(`loadUri:${SECOND}`), false)
  queue.resume()
  assert.equal(calls.at(-2), `loadUri:${SECOND}`)
  assert.equal(calls.at(-1), "play")
  assert.equal(events.includes(`track:${SECOND}`), true)
})

test("next while hidden reloads that same movement if it never starts", () => {
  let hidden = false
  const { queue, calls, update, advance } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND, THIRD], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  hidden = true
  queue.next()
  assert.equal(calls.at(-2), `loadUri:${SECOND}`)
  assert.equal(calls.at(-1), "play")
  hidden = false
  queue.nudgeIfWaiting()
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.deepEqual(
    calls.filter((call) => call.startsWith("loadUri:")),
    [`loadUri:${FIRST}`, `loadUri:${SECOND}`, `loadUri:${SECOND}`]
  )
  assert.equal(calls.includes(`loadUri:${THIRD}`), false)
})

test("next while hidden is not reloaded once that movement is playing", () => {
  let hidden = false
  const { queue, calls, update } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  hidden = true
  queue.next()
  update({ isPaused: false, position: 1_000, playingURI: SECOND })
  hidden = false
  queue.nudgeIfWaiting()
  assert.deepEqual(
    calls.filter((call) => call.startsWith("loadUri:")),
    [`loadUri:${FIRST}`, `loadUri:${SECOND}`]
  )
})

test("next on the last movement pauses and ends the work", () => {
  const { queue, calls, events, update } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  queue.next()
  update({ isPaused: false, position: 1_000, playingURI: SECOND })
  queue.next()
  assert.equal(calls.at(-1), "pause")
  assert.equal(events.includes(`ended:${SECOND}`), true)
  assert.deepEqual(
    calls.filter((call) => call.startsWith("loadUri:")),
    [`loadUri:${FIRST}`, `loadUri:${SECOND}`]
  )
})

test("returning to a tab does not navigate until the foreground delay, and only once", () => {
  let hidden = false
  const { queue, calls, update, advance } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  hidden = true
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  hidden = false
  queue.nudgeIfWaiting()
  queue.nudgeIfWaiting()
  assert.equal(calls.includes(`loadUri:${SECOND}`), false)
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.deepEqual(
    calls.filter((call) => call.startsWith("loadUri:")),
    [`loadUri:${FIRST}`, `loadUri:${SECOND}`]
  )
  queue.nudgeIfWaiting()
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.equal(calls.filter((call) => call.startsWith("loadUri:")).length, 2)
})

test("a listener pause during the foreground wait does not start the next movement", () => {
  let hidden = false
  const { queue, calls, update, advance } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  hidden = true
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  hidden = false
  queue.nudgeIfWaiting()
  queue.pause()
  advance(EMBED_FOREGROUND_DELAY_MS + 1_000)
  assert.equal(calls.includes(`loadUri:${SECOND}`), false)
  queue.resume()
  assert.equal(calls.at(-2), `loadUri:${SECOND}`)
  assert.equal(calls.at(-1), "play")
})

test("a resumed movement plays again until it is heard and does not skip ahead", () => {
  let hidden = false
  const { queue, calls, events, update, advance } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND, THIRD], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  hidden = true
  queue.notePageHidden(true)
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  hidden = false
  queue.nudgeIfWaiting()
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.equal(calls.at(-2), `loadUri:${SECOND}`)
  assert.equal(calls.at(-1), "play")
  update({ isPaused: true, position: 0, playingURI: SECOND })
  queue.noteEmbedReady()
  assert.equal(calls.at(-1), "play")
  advance(EMBED_PLAY_RETRY_DELAYS_MS[0])
  const playsWhileWaiting = calls.filter((call) => call === "play").length
  assert.ok(playsWhileWaiting >= 3)
  update({ isPaused: false, position: 1_000, playingURI: SECOND })
  assert.equal(events.includes(`track:${SECOND}`), true)
  queue.noteEmbedReady()
  advance(5_000)
  assert.equal(calls.filter((call) => call === "play").length, playsWhileWaiting)
  assert.equal(calls.includes(`loadUri:${THIRD}`), false)
  assert.equal(calls.some((call) => call.includes("spotify:album:")), false)
})

test("a hidden tab that drifts to another track still queues the next movement", () => {
  let hidden = false
  const { queue, calls, events, update, advance } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 40_000, playingURI: FIRST })
  hidden = true
  queue.notePageHidden(true)
  update({ isPaused: false, position: 1_000, playingURI: "spotify:track:extra" })
  assert.equal(events.includes(`ended:${FIRST}`), false)
  assert.equal(events.includes(`track:${SECOND}`), true)
  assert.equal(calls.includes(`loadUri:${SECOND}`), false)
  assert.equal(calls.some((call) => call.includes("extra") || call.includes("spotify:album:")), false)
  hidden = false
  queue.nudgeIfWaiting()
  advance(EMBED_FOREGROUND_DELAY_MS)
  assert.equal(calls.at(-2), `loadUri:${SECOND}`)
  assert.equal(calls.at(-1), "play")
})

test("a hidden tab does not follow an outside track after the last movement", () => {
  let hidden = false
  const { queue, calls, events, update, advance } = harness({ hidden: () => hidden })
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: 40_000, playingURI: SECOND })
  update({ isPaused: false, position: 2_000, playingURI: SECOND })
  hidden = true
  queue.notePageHidden(true)
  update({ isPaused: false, position: 1_000, playingURI: "spotify:track:extra" })
  assert.equal(events.includes(`ended:${SECOND}`), true)
  assert.equal(calls.at(-1), "pause")
  hidden = false
  queue.nudgeIfWaiting()
  advance(EMBED_FOREGROUND_DELAY_MS + 2_000)
  assert.equal(calls.some((call) => call.includes("extra") || call.includes("spotify:album:")), false)
  assert.deepEqual(
    calls.filter((call) => call.startsWith("loadUri:")),
    [`loadUri:${FIRST}`, `loadUri:${SECOND}`]
  )
})

test("a visible advance plays again when the document is ready, then retries and reloads that movement", () => {
  const { queue, calls, events, update, advance } = harness()
  queue.start([FIRST, SECOND, THIRD], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  assert.deepEqual(loadsOf(calls, SECOND), [`loadUri:${SECOND}`])
  queue.noteEmbedReady()
  assert.equal(calls.at(-1), "play")
  stepDelays(advance, EMBED_PLAY_RETRY_DELAYS_MS)
  assert.equal(calls.filter((call) => call === "play").length, 2 + 1 + EMBED_PLAY_RETRY_DELAYS_MS.length)
  assert.deepEqual(loadsOf(calls, SECOND), [`loadUri:${SECOND}`])
  assert.equal(events.includes(`track:${THIRD}`), false)
  advance(EMBED_LOAD_RETRY_DELAY_MS)
  assert.deepEqual(loadsOf(calls, SECOND), [`loadUri:${SECOND}`, `loadUri:${SECOND}`])
  for (let attempt = 1; attempt < EMBED_LOAD_RETRY_LIMIT; attempt += 1) {
    stepDelays(advance, EMBED_PLAY_RETRY_DELAYS_MS)
    advance(EMBED_LOAD_RETRY_DELAY_MS)
  }
  assert.equal(loadsOf(calls, SECOND).length, 1 + EMBED_LOAD_RETRY_LIMIT)
  assert.equal(calls.some((call) => call.includes(THIRD) || call.includes("spotify:album:")), false)
  const loads = calls.filter((call) => call.startsWith("loadUri:")).length
  stepDelays(advance, EMBED_PLAY_RETRY_DELAYS_MS)
  advance(EMBED_LOAD_RETRY_DELAY_MS)
  assert.equal(calls.filter((call) => call.startsWith("loadUri:")).length, loads)
})

test("hearing the next movement cancels play retries and does not reload it", () => {
  const { queue, calls, update, advance } = harness()
  queue.start([FIRST, SECOND, THIRD], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  advance(EMBED_PLAY_RETRY_DELAYS_MS[0])
  update({ isPaused: false, position: 1_000, playingURI: SECOND })
  const loads = loadsOf(calls, SECOND).length
  const plays = calls.filter((call) => call === "play").length
  stepDelays(advance, EMBED_PLAY_RETRY_DELAYS_MS)
  for (let attempt = 0; attempt < EMBED_LOAD_RETRY_LIMIT + 1; attempt += 1) advance(EMBED_LOAD_RETRY_DELAY_MS)
  assert.equal(loadsOf(calls, SECOND).length, loads)
  assert.equal(calls.filter((call) => call === "play").length, plays)
  assert.equal(calls.includes(`loadUri:${THIRD}`), false)
})

test("pausing during an advance retry does not play or reload", () => {
  const { queue, calls, update, advance } = harness()
  queue.start([FIRST, SECOND, THIRD], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  queue.pause()
  const count = calls.length
  stepDelays(advance, EMBED_PLAY_RETRY_DELAYS_MS)
  for (let attempt = 0; attempt < EMBED_LOAD_RETRY_LIMIT + 1; attempt += 1) advance(EMBED_LOAD_RETRY_DELAY_MS)
  assert.equal(calls.length, count)
  assert.equal(calls.at(-1), "pause")
  assert.deepEqual(loadsOf(calls, SECOND), [`loadUri:${SECOND}`])
  assert.equal(calls.includes(`loadUri:${THIRD}`), false)
})

test("next retries the same movement when it never starts", () => {
  const { queue, calls, update, advance } = harness()
  queue.start([FIRST, SECOND, THIRD], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  queue.next()
  assert.deepEqual(loadsOf(calls, SECOND), [`loadUri:${SECOND}`])
  stepDelays(advance, EMBED_PLAY_RETRY_DELAYS_MS)
  assert.equal(calls.filter((call) => call === "play").length, 2 + EMBED_PLAY_RETRY_DELAYS_MS.length)
  assert.deepEqual(loadsOf(calls, SECOND), [`loadUri:${SECOND}`])
  advance(EMBED_LOAD_RETRY_DELAY_MS)
  assert.deepEqual(loadsOf(calls, SECOND), [`loadUri:${SECOND}`, `loadUri:${SECOND}`])
  assert.equal(calls.some((call) => call.includes(THIRD) || call.includes("spotify:album:")), false)
})

test("the next work retries its first movement and does not skip to the second", () => {
  const { queue, calls, events, update, advance } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  update({ isPaused: false, position: 1_000, playingURI: SECOND })
  update({ isPaused: false, position: DURATION, playingURI: SECOND })
  assert.equal(events.includes(`ended:${SECOND}`), true)
  queue.start([THIRD, FOURTH], 0)
  assert.deepEqual(loadsOf(calls, THIRD), [`loadUri:${THIRD}`])
  queue.noteEmbedReady()
  stepDelays(advance, EMBED_PLAY_RETRY_DELAYS_MS)
  advance(EMBED_LOAD_RETRY_DELAY_MS)
  assert.equal(loadsOf(calls, THIRD).length, 2)
  assert.equal(calls.includes(`loadUri:${FOURTH}`), false)
  assert.equal(calls.some((call) => call.includes("spotify:album:")), false)
})

test("a first play that never starts retries and reloads that movement", () => {
  const { queue, calls, advance } = harness()
  queue.start([FIRST, SECOND], 0)
  queue.noteEmbedReady()
  assert.equal(calls.filter((call) => call === "play").length, 2)
  assert.deepEqual(loadsOf(calls, FIRST), [`loadUri:${FIRST}`])
  stepDelays(advance, EMBED_PLAY_RETRY_DELAYS_MS)
  assert.equal(calls.filter((call) => call === "play").length, 2 + EMBED_PLAY_RETRY_DELAYS_MS.length)
  assert.deepEqual(loadsOf(calls, FIRST), [`loadUri:${FIRST}`])
  advance(EMBED_LOAD_RETRY_DELAY_MS)
  assert.deepEqual(loadsOf(calls, FIRST), [`loadUri:${FIRST}`, `loadUri:${FIRST}`])
  assert.equal(calls.includes(`loadUri:${SECOND}`), false)
  assert.equal(calls.some((call) => call.includes("spotify:album:")), false)
})

test("hearing the first play cancels retries and does not reload it", () => {
  const { queue, calls, update, advance } = harness()
  queue.start([FIRST, SECOND], 0)
  queue.noteEmbedReady()
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  const plays = calls.filter((call) => call === "play").length
  stepDelays(advance, EMBED_PLAY_RETRY_DELAYS_MS)
  for (let attempt = 0; attempt < EMBED_LOAD_RETRY_LIMIT + 1; attempt += 1) advance(EMBED_LOAD_RETRY_DELAY_MS)
  assert.equal(calls.filter((call) => call === "play").length, plays)
  assert.deepEqual(loadsOf(calls, FIRST), [`loadUri:${FIRST}`])
  assert.equal(calls.includes(`loadUri:${SECOND}`), false)
})

test("ending the last movement does not reload it", () => {
  const { queue, calls, events, update, advance } = harness()
  queue.start([FIRST, SECOND], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  update({ isPaused: false, position: 1_000, playingURI: SECOND })
  update({ isPaused: false, position: DURATION, playingURI: SECOND })
  assert.equal(events.includes(`ended:${SECOND}`), true)
  assert.equal(calls.at(-1), "pause")
  const count = calls.length
  stepDelays(advance, EMBED_PLAY_RETRY_DELAYS_MS)
  for (let attempt = 0; attempt < EMBED_LOAD_RETRY_LIMIT + 1; attempt += 1) advance(EMBED_LOAD_RETRY_DELAY_MS)
  assert.equal(calls.length, count)
  assert.deepEqual(loadsOf(calls, SECOND), [`loadUri:${SECOND}`])
})

test("playback_started while buffering does not cancel advance retries", () => {
  const { queue, calls, update, advance } = harness()
  queue.start([FIRST, SECOND, THIRD], 0)
  update({ isPaused: false, position: 1_000, playingURI: FIRST })
  update({ isPaused: false, position: DURATION, playingURI: FIRST })
  const plays = calls.filter((call) => call === "play").length
  queue.notePlayingUri(SECOND)
  advance(EMBED_PLAY_RETRY_DELAYS_MS[0])
  assert.ok(calls.filter((call) => call === "play").length > plays)
  assert.deepEqual(loadsOf(calls, SECOND), [`loadUri:${SECOND}`])
  assert.equal(calls.includes(`loadUri:${THIRD}`), false)
})
