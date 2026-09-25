import assert from "node:assert/strict"
import { test } from "node:test"
import {
  albumPlaybackControl,
  isAlbumRowActive,
  isPlaybackSessionActive,
  phaseFromPlayerPaused,
  playbackControlAction,
  playbackControlLabel,
  playbackControlShowsPause,
  playbackNaturalEnd,
  type PlaybackProgress,
} from "./spotify-player-session.ts"

test("playback session stays active while a play request has track URIs", () => {
  assert.equal(isPlaybackSessionActive(null), false)
  assert.equal(isPlaybackSessionActive({ uris: [] }), false)
  assert.equal(isPlaybackSessionActive({ uris: ["spotify:track:a"] }), true)
})

test("player_state_changed paused maps to play/pause control phase", () => {
  assert.equal(phaseFromPlayerPaused(false), "playing")
  assert.equal(phaseFromPlayerPaused(true), "paused")
  assert.equal(playbackControlLabel("playing"), "Pause")
  assert.equal(playbackControlLabel("paused"), "Play")
  assert.equal(playbackControlLabel("idle"), "Play")
  assert.equal(playbackControlLabel("connecting"), "Connecting…")
  assert.equal(playbackControlShowsPause("playing"), true)
  assert.equal(playbackControlShowsPause("paused"), false)
  assert.equal(playbackControlShowsPause("connecting"), false)
  assert.equal(playbackControlAction("playing"), "pause")
  assert.equal(playbackControlAction("paused"), "resume")
  assert.equal(playbackControlAction("connecting"), "none")
  assert.equal(playbackControlAction("idle"), "none")
})

test("album Play shares pause/resume when that recording is the active session", () => {
  assert.deepEqual(
    albumPlaybackControl({
      recordingId: "album-1",
      playRequestRecordingId: "album-1",
      playerPhase: "playing",
    }),
    { label: "Pause", action: "pause", pressed: true }
  )
  assert.deepEqual(
    albumPlaybackControl({
      recordingId: "album-1",
      playRequestRecordingId: "album-1",
      playerPhase: "paused",
    }),
    { label: "Play", action: "resume", pressed: false }
  )
  assert.deepEqual(
    albumPlaybackControl({
      recordingId: "album-1",
      playRequestRecordingId: "album-1",
      playerPhase: "connecting",
    }),
    { label: "Connecting…", action: "none", pressed: false }
  )
  assert.deepEqual(
    albumPlaybackControl({
      recordingId: "album-2",
      playRequestRecordingId: "album-1",
      playerPhase: "playing",
    }),
    { label: "Play", action: "start", pressed: false }
  )
})

test("album row stays highlighted for the playing recording across pages", () => {
  assert.equal(
    isAlbumRowActive({
      recordingId: "album-1",
      playRequestRecordingId: "album-1",
    }),
    true
  )
})

test("selected album does not use playing highlight when another recording is playing", () => {
  assert.equal(
    isAlbumRowActive({
      recordingId: "album-2",
      playRequestRecordingId: "album-1",
    }),
    false
  )
})

test("selection alone does not highlight without a play request", () => {
  assert.equal(
    isAlbumRowActive({
      recordingId: "album-1",
      playRequestRecordingId: null,
    }),
    false
  )
})

const LAST = "spotify:track:ii"

function playingNearEnd(positionMs: number, atMs: number): PlaybackProgress {
  return { uri: LAST, positionMs, durationMs: 180_000, paused: false, atMs }
}

test("a finished context pauses rewound to the start after the playhead reached the end", () => {
  assert.equal(
    playbackNaturalEnd({
      previous: playingNearEnd(179_000, 1_000),
      next: { paused: true, positionMs: 0, durationMs: 180_000, uri: LAST },
      nowMs: 2_000,
      userPaused: false,
      isLastInContext: true,
    }),
    true
  )
})

test("a finished context can stay paused on the final moment of the last track", () => {
  assert.equal(
    playbackNaturalEnd({
      previous: playingNearEnd(178_200, 1_000),
      next: { paused: true, positionMs: 179_600, durationMs: 180_000, uri: LAST },
      nowMs: 1_800,
      userPaused: false,
      isLastInContext: true,
    }),
    true
  )
})

test("two playing samples sitting on the end count as the context finishing", () => {
  assert.equal(
    playbackNaturalEnd({
      previous: playingNearEnd(179_800, 1_000),
      next: { paused: false, positionMs: 179_900, durationMs: 180_000, uri: LAST },
      nowMs: 1_500,
      userPaused: false,
      isLastInContext: true,
    }),
    true
  )
  assert.equal(
    playbackNaturalEnd({
      previous: playingNearEnd(179_000, 1_000),
      next: { paused: false, positionMs: 179_400, durationMs: 180_000, uri: LAST },
      nowMs: 1_500,
      userPaused: false,
      isLastInContext: true,
    }),
    false
  )
})

test("a listener pause does not look like the end of the work", () => {
  assert.equal(
    playbackNaturalEnd({
      previous: playingNearEnd(90_000, 1_000),
      next: { paused: true, positionMs: 90_400, durationMs: 180_000, uri: LAST },
      nowMs: 1_400,
      userPaused: false,
      isLastInContext: true,
    }),
    false
  )
  assert.equal(
    playbackNaturalEnd({
      previous: playingNearEnd(179_200, 1_000),
      next: { paused: true, positionMs: 179_500, durationMs: 180_000, uri: LAST },
      nowMs: 1_300,
      userPaused: true,
      isLastInContext: true,
    }),
    false
  )
  assert.equal(
    playbackNaturalEnd({
      previous: playingNearEnd(200, 1_000),
      next: { paused: true, positionMs: 0, durationMs: 180_000, uri: LAST },
      nowMs: 1_200,
      userPaused: false,
      isLastInContext: true,
    }),
    false
  )
})

test("the end of an earlier movement does not finish the context", () => {
  assert.equal(
    playbackNaturalEnd({
      previous: playingNearEnd(179_000, 1_000),
      next: { paused: true, positionMs: 0, durationMs: 180_000, uri: LAST },
      nowMs: 2_000,
      userPaused: false,
      isLastInContext: false,
    }),
    false
  )
  assert.equal(
    playbackNaturalEnd({
      previous: { uri: "spotify:track:i", positionMs: 179_000, durationMs: 180_000, paused: false, atMs: 1_000 },
      next: { paused: true, positionMs: 0, durationMs: 180_000, uri: LAST },
      nowMs: 2_000,
      userPaused: false,
      isLastInContext: true,
    }),
    false
  )
})
