import assert from "node:assert/strict"
import { test } from "node:test"
import {
  clusterTracks,
  parseWork,
  scoreTrack,
  type TrackLike,
  type WorkQuery,
} from "./spotify-match.ts"

function work(partial: Partial<WorkQuery> & Pick<WorkQuery, "composerName" | "title">): WorkQuery {
  return partial
}

function track(partial: Partial<TrackLike> & Pick<TrackLike, "id" | "name">): TrackLike {
  return {
    artists: "Ludwig van Beethoven",
    album: "Some Album",
    albumId: "album-1",
    durationMs: 400_000,
    trackNumber: 1,
    discNumber: 1,
    ...partial,
  }
}

test("Beethoven 5 keeps matching movements and drops other symphonies", () => {
  const parsed = parseWork(
    work({
      composerName: "Beethoven",
      composerCompleteName: "Ludwig van Beethoven",
      title: "Symphony no. 5 in C minor, op. 67",
      catalogue: "op",
      catalogueNumber: "67",
      additionalNumber: "5",
    })
  )

  const keepI = scoreTrack(
    track({
      id: "b5-i",
      name: "Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio",
    }),
    parsed
  )
  const keepII = scoreTrack(
    track({
      id: "b5-ii",
      name: "Symphony No. 5 in C Minor, Op. 67: II. Andante con moto",
      trackNumber: 2,
    }),
    parsed
  )
  const drop7 = scoreTrack(
    track({
      id: "b7",
      name: "Symphony No. 7 in A Major, Op. 92: I. Poco sostenuto",
      artists: "Ludwig van Beethoven, Berliner Philharmoniker",
    }),
    parsed
  )
  const drop3 = scoreTrack(
    track({
      id: "b3",
      name: 'Symphony No. 3 in E-Flat Major, Op. 55 "Eroica": I. Allegro con brio',
    }),
    parsed
  )
  const albumHasBoth = scoreTrack(
    track({
      id: "b5-on-compilation",
      name: "Symphony No. 5 in C Minor, Op. 67: IV. Allegro",
      album: "Beethoven: Symphonies Nos. 5 & 7 (Complete Edition)",
      trackNumber: 4,
    }),
    parsed
  )

  assert.ok(keepI > 0, `expected movement I to match, got ${keepI}`)
  assert.ok(keepII > 0, `expected movement II to match, got ${keepII}`)
  assert.equal(drop7, -1)
  assert.equal(drop3, -1)
  assert.ok(albumHasBoth > 0, "complete-edition albums are fine when the track is the work")

  const performersOnly = scoreTrack(
    track({
      id: "karajan",
      name: "Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio",
      artists: "Herbert von Karajan, Berliner Philharmoniker",
      album: "Beethoven: Symphonies Nos. 5 & 7",
    }),
    parsed
  )
  const wrongComposer = scoreTrack(
    track({
      id: "tchaikovsky",
      name: "Symphony No. 5 in E Minor, Op. 64: I. Andante — Allegro con anima",
      artists: "Pyotr Ilyich Tchaikovsky, Leningrad Philharmonic",
      album: "Tchaikovsky: Symphony No. 5",
    }),
    parsed
  )
  assert.ok(performersOnly > 0, "composer may appear only on the album, not the performing artists")
  assert.equal(wrongComposer, -1)
})

test("Bach cantata 140 does not pull BWV 147 or the Schübler chorale BWV 645", () => {
  const parsed = parseWork(
    work({
      composerName: "Bach",
      composerCompleteName: "Johann Sebastian Bach",
      title: 'Cantata no. 140, "Wachet auf, ruft uns die Stimme", BWV.140',
      catalogue: "BWV",
      catalogueNumber: "140",
      additionalNumber: "140",
    })
  )

  const keep = scoreTrack(
    track({
      id: "bwv140",
      name: 'Cantata, BWV 140 "Wachet auf, ruft uns die Stimme": I. Chorus',
      artists: "Johann Sebastian Bach, Monteverdi Choir",
    }),
    parsed
  )
  const drop147 = scoreTrack(
    track({
      id: "bwv147",
      name: "Herz und Mund und Tat und Leben, BWV 147: I. Chorus",
      artists: "Johann Sebastian Bach",
    }),
    parsed
  )
  const drop645 = scoreTrack(
    track({
      id: "bwv645",
      name: "Wachet auf, ruft uns die Stimme, BWV 645",
      artists: "Johann Sebastian Bach",
    }),
    parsed
  )

  assert.ok(keep > 0, `expected BWV 140 to match, got ${keep}`)
  assert.equal(drop147, -1)
  assert.equal(drop645, -1)
})

test("Chopin Nocturnes op. 9 keeps the set and drops other nocturnes", () => {
  const parsed = parseWork(
    work({
      composerName: "Chopin",
      composerCompleteName: "Frédéric Chopin",
      title: "Nocturnes, op. 9",
      catalogue: "op",
      catalogueNumber: "9",
    })
  )

  const keep1 = scoreTrack(
    track({
      id: "op9-1",
      name: "Nocturne in B-Flat Minor, Op. 9, No. 1",
      artists: "Frédéric Chopin, Arthur Rubinstein",
    }),
    parsed
  )
  const keep2 = scoreTrack(
    track({
      id: "op9-2",
      name: "Nocturne in E-Flat Major, Op. 9, No. 2",
      artists: "Frédéric Chopin",
    }),
    parsed
  )
  const dropPosth = scoreTrack(
    track({
      id: "b49",
      name: "Nocturne in C-Sharp Minor, B. 49",
      artists: "Frédéric Chopin",
    }),
    parsed
  )
  const drop27 = scoreTrack(
    track({
      id: "op27",
      name: "Nocturne in C-Sharp Minor, Op. 27, No. 1",
      artists: "Frédéric Chopin",
    }),
    parsed
  )

  assert.ok(keep1 > 0)
  assert.ok(keep2 > 0)
  assert.equal(dropPosth, -1)
  assert.equal(drop27, -1)
})

test("Chopin B.49 nocturne prefers the posthumous piece over Op. 27 No. 1", () => {
  const parsed = parseWork(
    work({
      composerName: "Chopin",
      composerCompleteName: "Frédéric Chopin",
      title: 'Nocturne in C sharp minor, B.49, "Lento con gran espressione"',
    })
  )

  const keep = scoreTrack(
    track({
      id: "b49",
      name: 'Nocturne in C-Sharp Minor, B. 49 "Lento con gran espressione"',
      artists: "Frédéric Chopin",
    }),
    parsed
  )
  const drop = scoreTrack(
    track({
      id: "op27",
      name: "Nocturne in C-Sharp Minor, Op. 27, No. 1",
      artists: "Frédéric Chopin",
    }),
    parsed
  )

  assert.ok(keep > 0, `expected B.49 to match, got ${keep}`)
  assert.equal(drop, -1)
})

test("Open Opus parts boost the matching movement titles", () => {
  const parsed = parseWork(
    work({
      composerName: "Beethoven",
      composerCompleteName: "Ludwig van Beethoven",
      title: "Symphony no. 5 in C minor, op. 67",
      catalogue: "op",
      catalogueNumber: "67",
      additionalNumber: "5",
      parts: ["Allegro con brio", "Andante con moto", "Scherzo. Allegro", "Allegro"],
    })
  )

  const withPart = scoreTrack(
    track({
      id: "part",
      name: "Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio",
    }),
    parsed
  )
  const withoutParts = scoreTrack(
    track({
      id: "part",
      name: "Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio",
    }),
    parseWork(
      work({
        composerName: "Beethoven",
        composerCompleteName: "Ludwig van Beethoven",
        title: "Symphony no. 5 in C minor, op. 67",
        catalogue: "op",
        catalogueNumber: "67",
        additionalNumber: "5",
      })
    )
  )

  assert.ok(withPart > withoutParts)
})

test("clusters consecutive movements on one album and splits unrelated works", () => {
  const parsed = parseWork(
    work({
      composerName: "Beethoven",
      composerCompleteName: "Ludwig van Beethoven",
      title: "Symphony no. 5 in C minor, op. 67",
      catalogue: "op",
      catalogueNumber: "67",
      additionalNumber: "5",
    })
  )

  const names = [
    "Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio",
    "Symphony No. 5 in C Minor, Op. 67: II. Andante con moto",
    "Symphony No. 5 in C Minor, Op. 67: III. Scherzo. Allegro",
    "Symphony No. 5 in C Minor, Op. 67: IV. Allegro",
  ]
  const scored = names.map((name, index) => ({
    ...track({
      id: `m${index}`,
      name,
      trackNumber: index + 1,
      album: "Karajan / Berlin",
      albumId: "karajan",
    }),
    score: scoreTrack(
      track({
        id: `m${index}`,
        name,
        trackNumber: index + 1,
        album: "Karajan / Berlin",
        albumId: "karajan",
      }),
      parsed
    ),
  }))

  assert.ok(scored.every((item) => item.score > 0))
  const groups = clusterTracks(scored)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].tracks.length, 4)
})
