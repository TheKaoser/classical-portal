import { NextResponse } from "next/server"
import { isCrawlerUserAgent } from "@/lib/crawler"
import { isCatalogWorkId } from "@/lib/list-playback"
import { isSpotifyConfigured, isSpotifyOAuthConfigured } from "@/lib/spotify-model"
import { SPOTIFY_RECORDINGS_UNAVAILABLE } from "@/lib/spotify-quota"
import { matchSpotifyWork } from "@/lib/work-spotify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const NO_STORE = { "Cache-Control": "no-store" }

/**
 * GET /api/spotify/recordings?id=
 * Client-triggered catalog match for a work page. Crawlers get an empty
 * payload and do not call Spotify.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? ""
  if (!isCatalogWorkId(id)) {
    return NextResponse.json({ error: "A work id is required", code: "bad_request" }, { status: 400, headers: NO_STORE })
  }

  const userAgent = request.headers.get("user-agent")
  if (isCrawlerUserAgent(userAgent)) {
    return NextResponse.json(
      {
        configured: isSpotifyConfigured(),
        oauthConfigured: isSpotifyOAuthConfigured(),
        query: "",
        searchUrl: "",
        recordings: [],
        skipped: "crawler",
      },
      { headers: NO_STORE }
    )
  }

  try {
    const match = await matchSpotifyWork(id, userAgent)
    if (!match) {
      return NextResponse.json({ error: "Work not found", code: "not_found" }, { status: 404, headers: NO_STORE })
    }
    if (match.spotify.unavailable) {
      return NextResponse.json(
        { ...match.spotify, error: SPOTIFY_RECORDINGS_UNAVAILABLE },
        { status: 503, headers: NO_STORE }
      )
    }
    return NextResponse.json(match.spotify, {
      headers: { "Cache-Control": "private, max-age=3600" },
    })
  } catch (error) {
    console.error("GET /api/spotify/recordings failed", error)
    return NextResponse.json(
      {
        configured: isSpotifyConfigured(),
        oauthConfigured: isSpotifyOAuthConfigured(),
        query: "",
        searchUrl: "",
        recordings: [],
        unavailable: true,
        error: SPOTIFY_RECORDINGS_UNAVAILABLE,
      },
      { status: 503, headers: NO_STORE }
    )
  }
}
