import assert from "node:assert/strict"
import { test } from "node:test"
import { isAlbumRowActive, isPlaybackSessionActive } from "./spotify-player-session.ts"

test("playback session stays active while a play request has track URIs", () => {
  assert.equal(isPlaybackSessionActive(null), false)
  assert.equal(isPlaybackSessionActive({ uris: [] }), false)
  assert.equal(isPlaybackSessionActive({ uris: ["spotify:track:a"] }), true)
})

test("album row stays highlighted for the playing recording across pages", () => {
  assert.equal(
    isAlbumRowActive({
      recordingId: "album-1",
      selected: false,
      playRequestRecordingId: "album-1",
    }),
    true
  )
})

test("selected album still highlights when another recording is playing", () => {
  assert.equal(
    isAlbumRowActive({
      recordingId: "album-2",
      selected: true,
      playRequestRecordingId: "album-1",
    }),
    true
  )
})

test("idle selection highlights without a play request", () => {
  assert.equal(
    isAlbumRowActive({
      recordingId: "album-1",
      selected: true,
      playRequestRecordingId: null,
    }),
    true
  )
  assert.equal(
    isAlbumRowActive({
      recordingId: "album-1",
      selected: false,
      playRequestRecordingId: null,
    }),
    false
  )
})
