import { NextResponse } from "next/server"
import { getUserAccessToken } from "@/lib/spotify-auth"
import {
  classifySpotifyPlayError,
  isSpotifyDeviceId,
  spotifyPlayRequest,
  uniqueTrackUris,
} from "@/lib/spotify-playback"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Start the Web Playback SDK device on a list of track URIs.
 * PUT https://api.spotify.com/v1/me/player/play?device_id=...
 */
export async function PUT(request: Request) {
  const token = await getUserAccessToken()
  if (!token) {
    return NextResponse.json({ error: "Not connected to Spotify", code: "not_connected" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "bad_request" }, { status: 400 })
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const deviceId = typeof record.deviceId === "string" ? record.deviceId : ""
  const position = typeof record.position === "number" ? record.position : record.position === undefined ? 0 : -1
  const uris = uniqueTrackUris(
    Array.isArray(record.uris) ? record.uris.filter((uri): uri is string => typeof uri === "string") : []
  )

  if (!isSpotifyDeviceId(deviceId)) {
    return NextResponse.json({ error: "A Spotify player device is required", code: "bad_request" }, { status: 400 })
  }

  const play = spotifyPlayRequest({ uris, position })
  if (!play) {
    return NextResponse.json({ error: "At least one track is required", code: "bad_request" }, { status: 400 })
  }

  const res = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(play),
      cache: "no-store",
    }
  )

  if (res.status === 200 || res.status === 202 || res.status === 204) {
    return NextResponse.json({ ok: true })
  }

  const payload = await res.json().catch(() => null)
  const classified = classifySpotifyPlayError(res.status, payload)
  return NextResponse.json({ error: classified.message, code: classified.code }, { status: classified.status })
}
