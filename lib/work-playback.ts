import { primaryRecordingUris } from "@/lib/list-playback"
import { matchSpotifyWork } from "@/lib/work-spotify"

export type WorkPlayback = {
  id: string
  title: string
  configured: boolean
  recordingId: string | null
  uris: string[]
  /** Set when the quota circuit is open and no cached recording was available. */
  unavailable?: boolean
}

/** Same Spotify match as the work page. Search results are cached inside the matcher. */
export async function playbackForWorkId(
  id: string,
  userAgent?: string | null
): Promise<WorkPlayback | null> {
  const match = await matchSpotifyWork(id, userAgent)
  if (!match) return null
  if (match.spotify.unavailable) {
    return {
      id: match.id,
      title: match.title,
      configured: match.spotify.configured,
      recordingId: null,
      uris: [],
      unavailable: true,
    }
  }
  const primary = primaryRecordingUris(match.spotify.recordings)
  return {
    id: match.id,
    title: match.title,
    configured: match.spotify.configured,
    recordingId: primary?.recordingId ?? null,
    uris: primary?.uris ?? [],
  }
}
