import assert from "node:assert/strict"
import { test } from "node:test"
import {
  collectWorkPopularities,
  pickComposerArtist,
  spotifyImportance,
  type ArtistCandidate,
} from "./spotify-rank.ts"

test("spotify importance is the highest popularity from 0 to 100", () => {
  assert.equal(spotifyImportance([]), null)
  assert.equal(spotifyImportance([null, undefined, Number.NaN]), null)
  assert.equal(spotifyImportance([-1, 101, 40.2, 70]), 70)
  assert.equal(spotifyImportance([12]), 12)
})

test("artist pick prefers the classical composer over a same-surname namesake", () => {
  const artists: ArtistCandidate[] = [
    { id: "rock", name: "Sebastian Bach", popularity: 62, genres: ["glam metal", "hard rock"] },
    {
      id: "js",
      name: "Johann Sebastian Bach",
      popularity: 78,
      genres: ["baroque", "classical", "german baroque"],
    },
    { id: "cpe", name: "Carl Philipp Emanuel Bach", popularity: 54, genres: ["classical"] },
  ]
  const picked = pickComposerArtist(
    { name: "Bach", completeName: "Johann Sebastian Bach" },
    artists
  )
  assert.equal(picked?.id, "js")
})

test("artist pick accepts a shorter classical name that still tokens as the composer", () => {
  const picked = pickComposerArtist(
    { name: "Bach", completeName: "Johann Sebastian Bach" },
    [{ id: "short", name: "J. S. Bach", popularity: 70, genres: ["classical"] }]
  )
  assert.equal(picked?.id, "short")
})

test("artist pick rejects an unrelated artist", () => {
  const picked = pickComposerArtist(
    { name: "Bach", completeName: "Johann Sebastian Bach" },
    [{ id: "other", name: "Johann Strauss II", popularity: 80, genres: ["classical"] }]
  )
  assert.equal(picked, null)
})

test("work scores follow the best-matching recording and ignore a different symphony", () => {
  const composer = { name: "Beethoven", completeName: "Ludwig van Beethoven" }
  const works = [
    {
      id: "5",
      title: "Symphony no. 5 in C minor, op. 67",
      catalogue: "op",
      catalogueNumber: "67",
      additionalNumber: "5",
    },
    {
      id: "7",
      title: "Symphony no. 7 in A major, op. 92",
      catalogue: "op",
      catalogueNumber: "92",
      additionalNumber: "7",
    },
  ]
  const scores = collectWorkPopularities(composer, works, [
    {
      name: "Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio",
      artists: "Ludwig van Beethoven",
      album: "Beethoven: Symphony No. 5",
      popularity: 40,
    },
    {
      name: "Symphony No. 5 in C Minor, Op. 67: IV. Allegro",
      artists: "Herbert von Karajan, Berliner Philharmoniker",
      album: "Beethoven: Symphonies Nos. 5 & 7",
      popularity: 77,
      albumPopularity: 90,
    },
    {
      name: "Symphony No. 7 in A Major, Op. 92: I. Poco sostenuto",
      artists: "Ludwig van Beethoven",
      album: "Beethoven: Symphonies",
      popularity: 61,
    },
  ])

  assert.equal(scores.get("5"), 90)
  assert.equal(scores.get("7"), 61)
})
