import { getWork } from "@/lib/openopus"
import { searchSpotifyForWork, type SpotifyMatches } from "@/lib/spotify"
import { spotifyQueryForWork } from "@/lib/spotify-work-query"

export async function matchSpotifyWork(
  id: string,
  userAgent?: string | null
): Promise<{ id: string; title: string; spotify: SpotifyMatches } | null> {
  const { composer, work } = await getWork(id)
  if (!work || !composer) return null
  const spotify = await searchSpotifyForWork(spotifyQueryForWork(composer, work), { userAgent })
  return { id: work.id, title: work.title, spotify }
}
