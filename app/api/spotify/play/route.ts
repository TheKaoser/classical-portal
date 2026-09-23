import { NextResponse } from "next/server"
import { respondToSpotifyPlay } from "@/lib/spotify-play-api"
import { getUserAccessToken, readGrantedSpotifyScope } from "@/lib/spotify-auth"
import { PLAYBACK_UPSTREAM_MESSAGE } from "@/lib/spotify-playback"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * PUT /api/spotify/play
 * Starts the Web Playback SDK device on the given track URIs.
 * Body: { deviceId, uris, position }
 * Spotify errors are JSON (`code` + `error`). A thrown cookie or network failure
 * is 502, not an HTML 500.
 */
export async function PUT(request: Request) {
  try {
    const token = await getUserAccessToken()
    const grantedScope = await readGrantedSpotifyScope()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON", code: "bad_request" }, { status: 400 })
    }

    const result = await respondToSpotifyPlay({
      accessToken: token,
      grantedScope,
      body,
      refreshAccessToken: () => getUserAccessToken({ forceRefresh: true }),
    })
    return NextResponse.json(result.body, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("PUT /api/spotify/play failed", error)
    return NextResponse.json(
      { error: PLAYBACK_UPSTREAM_MESSAGE, code: "playback_failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    )
  }
}
