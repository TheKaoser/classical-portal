import { NextResponse } from "next/server"
import { checkLikedTracks, getSpotifyUserSession, saveLikedTrack } from "@/lib/spotify-auth"
import { saveTrackRequest } from "@/lib/spotify-playlist"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Save the current movement into Spotify Liked Songs.
 * Uses `PUT /v1/me/tracks`, not a private playlist.
 */
export async function POST(request: Request) {
  const session = await getSpotifyUserSession()
  if (!session.connected) {
    return NextResponse.json({ error: "Not connected to Spotify", code: "not_connected" }, { status: 401 })
  }

  let body: { uri?: unknown }
  try {
    body = (await request.json()) as { uri?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "bad_request" }, { status: 400 })
  }

  const parsed = saveTrackRequest(body)
  if (!parsed) {
    return NextResponse.json({ error: "A Spotify track is required", code: "bad_request" }, { status: 400 })
  }

  const saved = await saveLikedTrack(parsed.uri)
  if ("error" in saved) {
    return NextResponse.json({ error: saved.error, code: saved.code }, { status: saved.status })
  }
  return NextResponse.json({ saved: true, uri: parsed.uri })
}

/** Whether the given track URI is already in Liked Songs. */
export async function GET(request: Request) {
  const session = await getSpotifyUserSession()
  if (!session.connected) {
    return NextResponse.json({ error: "Not connected to Spotify", code: "not_connected" }, { status: 401 })
  }

  const uri = new URL(request.url).searchParams.get("uri")
  const parsed = saveTrackRequest({ uri })
  if (!parsed) {
    return NextResponse.json({ error: "A Spotify track is required", code: "bad_request" }, { status: 400 })
  }

  const checked = await checkLikedTracks([parsed.uri])
  if ("error" in checked) {
    return NextResponse.json({ error: checked.error, code: checked.code }, { status: checked.status })
  }
  return NextResponse.json({ saved: Boolean(checked.saved[0]), uri: parsed.uri })
}
