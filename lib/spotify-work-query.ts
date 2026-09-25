import { workParts, workSearchTerms, type OpenOpusWorkDetail } from "@/lib/openopus"
import { primarySpotifySearchUrl, type WorkQuery } from "@/lib/spotify-match"

type ComposerName = {
  name: string
  complete_name: string
}

/** The catalog fields the matcher needs. No network. */
export function spotifyQueryForWork(composer: ComposerName, work: OpenOpusWorkDetail): WorkQuery {
  return {
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
  }
}

/** Public Spotify search link for a work. Does not call the Web API. */
export function catalogSpotifySearchUrl(composer: ComposerName, work: OpenOpusWorkDetail): string {
  return primarySpotifySearchUrl(spotifyQueryForWork(composer, work))
}
