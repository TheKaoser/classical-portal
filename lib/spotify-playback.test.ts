import assert from "node:assert/strict"
import { test } from "node:test"
import {
  canonicalSpotifyTrackUri,
  isSpotifyTrackUri,
  orderedTrackUris,
  spotifyAlbumUri,
  uniqueTrackUris,
} from "./spotify-playback.ts"

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
  assert.deepEqual(uniqueTrackUris(["spotify:track:a", "spotify:album:b", "spotify:track:a"]), ["spotify:track:a"])
  assert.equal(isSpotifyTrackUri("spotify:track:abc"), true)
  assert.equal(isSpotifyTrackUri("spotify:album:abc"), false)
})

test("album ids are recognized without becoming an embed target by themselves", () => {
  assert.equal(spotifyAlbumUri("5Z9iiGl2FcIfa3BMiv6OIw"), "spotify:album:5Z9iiGl2FcIfa3BMiv6OIw")
  assert.equal(spotifyAlbumUri("work:9231"), null)
  assert.equal(spotifyAlbumUri(""), null)
  assert.equal(spotifyAlbumUri(null), null)
})

test("embed playingURI values canonicalize to a track URI", () => {
  assert.equal(canonicalSpotifyTrackUri("spotify:track:02EjNQRJohFLY4NaXiFdH1"), "spotify:track:02EjNQRJohFLY4NaXiFdH1")
  assert.equal(
    canonicalSpotifyTrackUri("https://open.spotify.com/track/02EjNQRJohFLY4NaXiFdH1"),
    "spotify:track:02EjNQRJohFLY4NaXiFdH1"
  )
  assert.equal(
    canonicalSpotifyTrackUri("https://open.spotify.com/embed/track/02EjNQRJohFLY4NaXiFdH1?si=abc"),
    "spotify:track:02EjNQRJohFLY4NaXiFdH1"
  )
  assert.equal(
    canonicalSpotifyTrackUri("https://open.spotify.com/intl-de/track/02EjNQRJohFLY4NaXiFdH1"),
    "spotify:track:02EjNQRJohFLY4NaXiFdH1"
  )
  assert.equal(canonicalSpotifyTrackUri("spotify:album:5Z9iiGl2FcIfa3BMiv6OIw"), null)
  assert.equal(canonicalSpotifyTrackUri("https://open.spotify.com/album/5Z9iiGl2FcIfa3BMiv6OIw"), null)
  assert.equal(canonicalSpotifyTrackUri(""), null)
  assert.equal(canonicalSpotifyTrackUri(null), null)
})
