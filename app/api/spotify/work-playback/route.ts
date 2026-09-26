import { NextResponse } from "next/server"
import { isCrawlerUserAgent } from "@/lib/crawler"
import { isCatalogWorkId } from "@/lib/list-playback"
import { isSpotifyConfigured } from "@/lib/spotify-model"
import { SPOTIFY_RECORDINGS_UNAVAILABLE } from "@/lib/spotify-quota"
import { playbackForWorkId } from "@/lib/work-playback"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const NO_STORE = { "Cache-Control": "no-store" }

/**
 * GET /api/spotify/work-playback?id=
 * The primary recording for one work: the same match the work page would play.
 * List playback calls this for the current work and a short lookahead, not the whole list.
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
        id,
        title: "",
        configured: isSpotifyConfigured(),
        recordingId: null,
        albumId: null,
        uris: [],
        skipped: "crawler",
      },
      { headers: NO_STORE }
    )
  }

  try {
    const playback = await playbackForWorkId(id, userAgent)
    if (!playback) {
      return NextResponse.json({ error: "Work not found", code: "not_found" }, { status: 404, headers: NO_STORE })
    }
    if (playback.unavailable) {
      return NextResponse.json(
        { error: SPOTIFY_RECORDINGS_UNAVAILABLE, code: "quota", unavailable: true },
        { status: 503, headers: NO_STORE }
      )
    }
    return NextResponse.json(playback, {
      headers: { "Cache-Control": "private, max-age=600" },
    })
  } catch (error) {
    console.error("GET /api/spotify/work-playback failed", error)
    return NextResponse.json(
      { error: SPOTIFY_RECORDINGS_UNAVAILABLE, code: "quota", unavailable: true },
      { status: 503, headers: NO_STORE }
    )
  }
}
