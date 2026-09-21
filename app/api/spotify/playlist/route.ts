import { NextResponse } from "next/server"
import { createSpotifyPlaylist, getSpotifyUserSession } from "@/lib/spotify-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TRACK_URI = /^spotify:track:[A-Za-z0-9]+$/

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
  const uris = Array.isArray(body.uris)
    ? body.uris.filter((uri): uri is string => typeof uri === "string" && TRACK_URI.test(uri))
    : []

  if (!name) {
    return NextResponse.json({ error: "Playlist name is required" }, { status: 400 })
  }
  if (!uris.length) {
    return NextResponse.json({ error: "At least one track is required" }, { status: 400 })
  }

  const result = await createSpotifyPlaylist({
    name,
    description: `Only the matched movements/tracks for ${name}. Created by Classical Portal.`,
    trackUris: uris,
  })

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
