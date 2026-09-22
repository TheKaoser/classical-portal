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
 * Uses the same playlist write path as Save playlist (`POST /me/playlists` and `POST /playlists/{id}/items`).
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
      return NextResponse.json({ error: added.error, code: added.code }, { status: added.status })
    }
  }

  const created = await createSpotifyPlaylist({
    name: SAVED_TRACKS_PLAYLIST_NAME,
    description: savedTracksPlaylistDescription(),
    trackUris: [parsed.uri],
  })
  if ("error" in created) {
    return NextResponse.json({ error: created.error, code: created.code }, { status: created.status })
  }
  return NextResponse.json({ ...created, created: true })
}
