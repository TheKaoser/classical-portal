import { NextResponse } from "next/server"
import { addTracksToSpotifyPlaylist, createSpotifyPlaylist, getSpotifyUserSession } from "@/lib/spotify-auth"
import {
  SAVED_TRACKS_PLAYLIST_NAME,
  savedTracksPlaylistDescription,
  saveTrackRequest,
} from "@/lib/spotify-playlist"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Save the current movement on a private "Saved tracks" playlist.
 * Uses playlist-modify-private, which Play all / Save playlist already request.
 */
export async function POST(request: Request) {
  const session = await getSpotifyUserSession()
  if (!session.connected) {
    return NextResponse.json({ error: "Not connected to Spotify", code: "not_connected" }, { status: 401 })
  }

  let body: { uri?: unknown; playlistId?: unknown }
  try {
    body = (await request.json()) as { uri?: unknown; playlistId?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "bad_request" }, { status: 400 })
  }

  const parsed = saveTrackRequest(body)
  if (!parsed) {
    return NextResponse.json({ error: "A Spotify track is required", code: "bad_request" }, { status: 400 })
  }

  if (parsed.playlistId) {
    const added = await addTracksToSpotifyPlaylist({ playlistId: parsed.playlistId, trackUris: [parsed.uri] })
    if (!("error" in added)) {
      return NextResponse.json({
        id: parsed.playlistId,
        url: `https://open.spotify.com/playlist/${parsed.playlistId}`,
        created: false,
      })
    }
    if (added.status !== 404) {
      const code = added.status === 403 ? "insufficient_scope" : "save_failed"
      return NextResponse.json({ error: added.error, code }, { status: added.status })
    }
  }

  const created = await createSpotifyPlaylist({
    name: SAVED_TRACKS_PLAYLIST_NAME,
    description: savedTracksPlaylistDescription(),
    trackUris: [parsed.uri],
  })
  if ("error" in created) {
    const code = created.status === 403 ? "insufficient_scope" : created.status === 401 ? "not_connected" : "save_failed"
    return NextResponse.json({ error: created.error, code }, { status: created.status })
  }
  return NextResponse.json({ ...created, created: true })
}
