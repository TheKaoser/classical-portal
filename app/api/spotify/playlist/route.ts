import { NextResponse } from "next/server"
import { createSpotifyPlaylist, getSpotifyUserSession } from "@/lib/spotify-auth"
import { classicalPlaylistDescription, uniqueTrackUris } from "@/lib/spotify-playlist"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const session = await getSpotifyUserSession()
  if (!session.connected) {
    return NextResponse.json({ error: "Not connected to Spotify" }, { status: 401 })
  }

  let body: { name?: unknown; uris?: unknown }
  try {
    body = (await request.json()) as { name?: unknown; uris?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const uris = uniqueTrackUris(
    Array.isArray(body.uris) ? body.uris.filter((uri): uri is string => typeof uri === "string") : []
  )

  if (!name) {
    return NextResponse.json({ error: "Playlist name is required" }, { status: 400 })
  }
  if (uris.length < 2) {
    return NextResponse.json({ error: "At least two tracks are required" }, { status: 400 })
  }

  const result = await createSpotifyPlaylist({
    name,
    description: classicalPlaylistDescription(name),
    trackUris: uris,
  })

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
