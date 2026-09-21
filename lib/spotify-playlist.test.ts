import assert from "node:assert/strict"
import { test } from "node:test"
import {
  choosePlaybackEmbed,
  classicalPlaylistDescription,
  classicalPlaylistName,
  dedupePlaylistCreate,
  nextPlaybackAction,
  orderedTrackUris,
  parsePendingPlaylist,
  playlistCacheKey,
  rememberPlaylistCache,
  sanitizePlaylistCache,
  spotifyPlaylistCreateBody,
  uniqueTrackUris,
} from "./spotify-playlist.ts"

test("playlist name identifies Classical Portal and the work", () => {
  assert.equal(
    classicalPlaylistName("Brahms", "Piano Concerto no. 2"),
    "Classical Portal · Brahms Piano Concerto no. 2"
  )
})

test("playlist name collapses space and stays within Spotify's 100 character limit", () => {
  const name = classicalPlaylistName("  Beethoven  ", "  Symphony no. 5   ")
  assert.equal(name, "Classical Portal · Beethoven Symphony no. 5")
  const long = classicalPlaylistName("Mahler", "x".repeat(200))
  assert.equal(long.length, 100)
  assert.equal(long.startsWith("Classical Portal · Mahler "), true)
})

test("playlist description says the playlist is private and fits Spotify's limit", () => {
  const description = classicalPlaylistDescription(classicalPlaylistName("Brahms", "Piano Concerto no. 2"))
  assert.match(description, /Private playlist/)
  assert.ok(description.length <= 300)
})

test("create body is always a private playlist", () => {
  const body = spotifyPlaylistCreateBody({
    name: `  ${"n".repeat(140)}  `,
    description: "d".repeat(400),
  })
  assert.equal(body.public, false)
  assert.equal(body.name.length, 100)
  assert.equal(body.description.length, 300)
})

test("track URIs stay in movement order and drop invalid duplicates", () => {
  assert.deepEqual(
    orderedTrackUris([
      { uri: "spotify:track:second" },
      { uri: "not-a-uri" },
      { uri: "spotify:track:first" },
      { uri: "spotify:track:second" },
    ]),
    ["spotify:track:second", "spotify:track:first"]
  )
  assert.deepEqual(uniqueTrackUris(["spotify:track:a", "spotify:album:b", "spotify:track:a"]), [
    "spotify:track:a",
  ])
})

test("multi-track groups embed the playlist until a single movement is chosen", () => {
  const track = { id: "t1", name: "I. Allegro" }
  assert.deepEqual(
    choosePlaybackEmbed({
      trackCount: 3,
      playlistId: "pl",
      playlistTitle: "Classical Portal · Brahms Piano Concerto no. 2",
      selectedTrack: track,
      preferSingleTrack: false,
    }),
    {
      kind: "playlist",
      id: "pl",
      title: "Classical Portal · Brahms Piano Concerto no. 2",
      height: 352,
    }
  )
  assert.equal(
    choosePlaybackEmbed({
      trackCount: 3,
      playlistId: "pl",
      playlistTitle: "playlist",
      selectedTrack: track,
      preferSingleTrack: true,
    })?.kind,
    "track"
  )
})

test("single-track groups stay on the track embed", () => {
  assert.equal(
    choosePlaybackEmbed({
      trackCount: 1,
      playlistId: "pl",
      playlistTitle: "playlist",
      selectedTrack: { id: "only", name: "Adagio" },
      preferSingleTrack: false,
    })?.kind,
    "track"
  )
  assert.equal(
    choosePlaybackEmbed({
      trackCount: 2,
      playlistId: null,
      playlistTitle: "playlist",
      selectedTrack: null,
      preferSingleTrack: false,
    }),
    null
  )
})

test("a saved playlist is embedded again and a new one is not created on page view", () => {
  const cached = { id: "pl", url: "https://open.spotify.com/playlist/pl" }
  assert.deepEqual(
    nextPlaybackAction({
      trackCount: 4,
      hasPlaylist: false,
      cached,
    }),
    { type: "embed-cached", id: "pl", url: cached.url }
  )
  assert.equal(
    nextPlaybackAction({
      trackCount: 4,
      hasPlaylist: false,
      cached: null,
    }).type,
    "none"
  )
  assert.equal(nextPlaybackAction({ trackCount: 1, hasPlaylist: false, cached: null }).type, "none")
  assert.equal(nextPlaybackAction({ trackCount: 3, hasPlaylist: true, cached: null }).type, "none")
})

test("playlist cache keys include the listener and keep the newest groups", () => {
  const uris = ["spotify:track:i", "spotify:track:ii"]
  assert.equal(playlistCacheKey("user-1", uris), "user-1\nspotify:track:i\nspotify:track:ii")
  const first = rememberPlaylistCache({}, "a", { id: "1", url: "https://open.spotify.com/playlist/1" }, 2)
  const second = rememberPlaylistCache(first, "b", { id: "2", url: "https://open.spotify.com/playlist/2" }, 2)
  const third = rememberPlaylistCache(second, "a", { id: "1b", url: "https://open.spotify.com/playlist/1b" }, 2)
  assert.deepEqual(Object.keys(third), ["b", "a"])
  assert.equal(third.a?.id, "1b")
  assert.deepEqual(
    sanitizePlaylistCache({
      ok: { id: "pl", url: "https://open.spotify.com/playlist/pl" },
      bad: { id: 1 },
    }),
    { ok: { id: "pl", url: "https://open.spotify.com/playlist/pl" } }
  )
})

test("pending playlist payload resumes only a real multi-track group", () => {
  const raw = JSON.stringify({
    name: "Classical Portal · Brahms Piano Concerto no. 2",
    recordingId: "album:track",
    uris: ["spotify:track:i", "nope", "spotify:track:i", "spotify:track:ii"],
  })
  assert.deepEqual(parsePendingPlaylist(raw), {
    name: "Classical Portal · Brahms Piano Concerto no. 2",
    recordingId: "album:track",
    uris: ["spotify:track:i", "spotify:track:ii"],
  })
  assert.equal(parsePendingPlaylist("{"), null)
  assert.equal(parsePendingPlaylist(JSON.stringify({ name: "x", recordingId: "r", uris: ["spotify:track:only"] })), null)
})

test("in-flight playlist creates are shared and failures can be retried", async () => {
  const inflight = new Map()
  let calls = 0
  const create = async () => {
    calls += 1
    return { ok: true as const, playlist: { id: "pl", url: "https://open.spotify.com/playlist/pl" } }
  }
  const [first, second] = await Promise.all([
    dedupePlaylistCreate("group", create, inflight),
    dedupePlaylistCreate("group", create, inflight),
  ])
  assert.equal(calls, 1)
  assert.deepEqual(first, second)

  const retries = new Map()
  let attempts = 0
  const fail = async () => {
    attempts += 1
    return { ok: false as const, error: "nope", status: 500 }
  }
  await dedupePlaylistCreate("group", fail, retries)
  await dedupePlaylistCreate("group", fail, retries)
  assert.equal(attempts, 2)
})
