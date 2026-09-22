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
