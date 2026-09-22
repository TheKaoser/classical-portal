import { parseWork, scoreTrack, type TrackLike, type WorkQuery } from "./spotify-match.ts"

const NAME_PARTICLES = new Set([
  "van",
  "von",
  "de",
  "da",
  "di",
  "del",
  "della",
  "la",
  "le",
  "du",
  "of",
  "the",
  "y",
])

const CLASSICAL_GENRE =
  /\b(classical|baroque|romantic|opera|renaissance|medieval|early music|composer|orchestral|chamber music|choral|art song)\b/i

export type ArtistCandidate = {
  id: string
  name: string
  popularity: number
  genres?: string[]
}

export type RankedWork = {
  id: string
  title: string
  subtitle?: string
  genre?: string
  catalogue?: string
  catalogueNumber?: string
  additionalNumber?: string
}

export type RankedTrack = {
  name: string
  artists: string
  album?: string
  popularity: number
  albumPopularity?: number | null
}

/** Highest in-range Spotify popularity. Empty or invalid input is unmatched. */
export function spotifyImportance(values: Array<number | null | undefined>): number | null {
  let best: number | null = null
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue
    const score = Math.round(value)
    if (score < 0 || score > 100) continue
    if (best == null || score > best) best = score
  }
  return best
}

export function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function nameTokens(value: string): string[] {
  return foldName(value)
    .split(" ")
    .filter((token) => token && !NAME_PARTICLES.has(token))
}

/**
 * Pick the Spotify artist that is this composer.
 * Exact and token-subset name matches win. A surname match is accepted only
 * when Spotify filed the artist under a classical genre, so "Sebastian Bach"
 * does not stand in for Johann Sebastian Bach.
 */
export function pickComposerArtist(
  composer: { name: string; completeName: string },
  artists: ArtistCandidate[]
): ArtistCandidate | null {
  const completeName = composer.completeName || composer.name
  const complete = foldName(completeName)
  const short = foldName(composer.name)
  const completeTokens = nameTokens(completeName)
  const surname = completeTokens[completeTokens.length - 1] || short
  if (!complete && !short) return null

  let best: { artist: ArtistCandidate; score: number } | null = null

  for (const artist of artists) {
    if (!artist?.id || !artist.name) continue
    const artistNorm = foldName(artist.name)
    const artistTokens = nameTokens(artist.name)
    const classical = (artist.genres ?? []).some((genre) => CLASSICAL_GENRE.test(genre))
    let score = 0

    if (artistNorm && artistNorm === complete) score = 100
    else if (
      completeTokens.length >= 2 &&
      completeTokens.every((token) => artistTokens.includes(token))
    ) {
      score = 80
    } else if (
      artistTokens.length >= 2 &&
      artistTokens.includes(surname) &&
      artistTokens.every((token) => completeTokens.includes(token))
    ) {
      score = 70
    } else if (short && artistNorm === short && (classical || completeTokens.length <= 1)) {
      score = 60
    } else if (surname && artistTokens.includes(surname) && classical) {
      score = 55
    } else {
      continue
    }

    const popularity = typeof artist.popularity === "number" ? artist.popularity : 0
    score += Math.max(0, Math.min(100, popularity)) / 1000
    if (!best || score > best.score) best = { artist, score }
  }

  if (!best || best.score < 55) return null
  return best.artist
}

/**
 * Assign each Spotify track to the single work it matches best.
 * A track that scores about equally for two works is left unused.
 * The work score is the max track (and album, when present) popularity.
 */
export function collectWorkPopularities(
  composer: { name: string; completeName?: string },
  works: RankedWork[],
  tracks: RankedTrack[]
): Map<string, number> {
  const parsed = works
    .filter((work) => work.id && work.title)
    .map((work) => ({
      work,
      parsed: parseWork(toWorkQuery(composer, work)),
    }))

  const buckets = new Map<string, number[]>()

  for (const track of tracks) {
    if (!track?.name) continue
    const like = toTrackLike(track)
    let bestId: string | null = null
    let bestScore = -1
    let secondScore = -1

    for (const entry of parsed) {
      const score = scoreTrack(like, entry.parsed)
      if (score < 0) continue
      if (entry.work.id === bestId) {
        if (score > bestScore) bestScore = score
        continue
      }
      if (score > bestScore) {
        secondScore = bestScore
        bestScore = score
        bestId = entry.work.id
      } else if (score > secondScore) {
        secondScore = score
      }
    }

    if (!bestId || bestScore < 0) continue
    if (secondScore >= 0 && bestScore - secondScore < 8) continue

    const popularity = spotifyImportance([track.popularity, track.albumPopularity])
    if (popularity == null) continue
    const list = buckets.get(bestId) ?? []
    list.push(popularity)
    buckets.set(bestId, list)
  }

  const scores = new Map<string, number>()
  for (const [id, values] of buckets) {
    const score = spotifyImportance(values)
    if (score != null) scores.set(id, score)
  }
  return scores
}

function toWorkQuery(
  composer: { name: string; completeName?: string },
  work: RankedWork
): WorkQuery {
  return {
    composerName: composer.name,
    composerCompleteName: composer.completeName,
    title: work.title,
    subtitle: work.subtitle,
    genre: work.genre,
    catalogue: work.catalogue,
    catalogueNumber: work.catalogueNumber,
    additionalNumber: work.additionalNumber,
  }
}

function toTrackLike(track: RankedTrack): TrackLike {
  return {
    id: "popularity",
    name: track.name,
    artists: track.artists,
    album: track.album ?? "",
    durationMs: 0,
    trackNumber: 0,
    discNumber: 1,
  }
}
