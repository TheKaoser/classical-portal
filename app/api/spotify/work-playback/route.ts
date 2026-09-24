import { NextResponse } from "next/server"
import { isCatalogWorkId } from "@/lib/list-playback"
import { playbackForWorkId } from "@/lib/work-playback"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * GET /api/spotify/work-playback?id=
 * The primary recording for one work: the same match the work page would play.
 * List playback calls this for the current work and a short lookahead, not the whole list.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? ""
  if (!isCatalogWorkId(id)) {
    return NextResponse.json({ error: "A work id is required", code: "bad_request" }, { status: 400 })
  }

  try {
    const playback = await playbackForWorkId(id)
    if (!playback) {
      return NextResponse.json({ error: "Work not found", code: "not_found" }, { status: 404 })
    }
    return NextResponse.json(playback, {
      headers: { "Cache-Control": "public, max-age=600" },
    })
  } catch (error) {
    console.error("GET /api/spotify/work-playback failed", error)
    return NextResponse.json(
      { error: "Spotify could not be reached. Try again.", code: "playback_failed" },
      { status: 502 }
    )
  }
}
