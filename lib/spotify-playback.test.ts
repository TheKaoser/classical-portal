import assert from "node:assert/strict"
import { test } from "node:test"
import { isSpotifyTrackUri, orderedTrackUris, uniqueTrackUris } from "./spotify-playback.ts"

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
