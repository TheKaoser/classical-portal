import { NextResponse } from "next/server"
import { respondToSpotifyPlay } from "@/lib/spotify-play-api"
import { getUserAccessToken } from "@/lib/spotify-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * PUT /api/spotify/play
 * Starts the Web Playback SDK device on the given track URIs.
 * Body: { deviceId, uris, position }
 */
export async function PUT(request: Request) {
  const token = await getUserAccessToken()
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "bad_request" }, { status: 400 })
  }

  const result = await respondToSpotifyPlay({ accessToken: token, body })
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  })
}
