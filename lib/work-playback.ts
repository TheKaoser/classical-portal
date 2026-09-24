import { unstable_cache } from "next/cache"
import { primaryRecordingUris } from "@/lib/list-playback"
import { getWork, workParts, workSearchTerms } from "@/lib/openopus"
import { searchSpotifyForWork } from "@/lib/spotify"

export type WorkPlayback = {
  id: string
  title: string
  configured: boolean
  recordingId: string | null
  uris: string[]
}

async function resolveWorkPlayback(id: string): Promise<WorkPlayback | null> {
  const { composer, work } = await getWork(id)
  if (!work || !composer) return null
  const spotify = await searchSpotifyForWork({
    composerName: composer.name,
    composerCompleteName: composer.complete_name,
    title: work.title,
    subtitle: work.subtitle,
    genre: work.genre,
    catalogue: work.catalogue,
    catalogueNumber: work.catalogue_number,
    additionalNumber: work.additional_number,
    searchterms: workSearchTerms(work),
    parts: workParts(work),
  })
  const primary = primaryRecordingUris(spotify.recordings)
  return {
    id: work.id,
    title: work.title,
    configured: spotify.configured,
    recordingId: primary?.recordingId ?? null,
    uris: primary?.uris ?? [],
  }
}

/** Same Spotify match as the work page, cached so a row replay does not search again. */
export function playbackForWorkId(id: string): Promise<WorkPlayback | null> {
  return unstable_cache(() => resolveWorkPlayback(id), ["work-playback", id], { revalidate: 600 })()
}
