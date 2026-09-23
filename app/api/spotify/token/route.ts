import { NextResponse } from "next/server"
import { readGrantedSpotifyScope, readSdkAccess } from "@/lib/spotify-auth"
import { PLAYBACK_RECONNECT_MESSAGE, tokenCanControlPlayback } from "@/lib/spotify-playback"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Short-lived access token for Spotify.Player getOAuthToken. Same-origin only.
 * `?refresh=1` forces a refresh after Spotify has rejected the current token.
 */
export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get("refresh") === "1"
  const access = await readSdkAccess({ forceRefresh: refresh })
  if (!access) {
    return NextResponse.json({ error: "Not connected to Spotify" }, { status: 401 })
  }

  const scope = await readGrantedSpotifyScope()
  if (scope && !tokenCanControlPlayback(scope)) {
    return NextResponse.json(
      { error: PLAYBACK_RECONNECT_MESSAGE, code: "insufficient_scope" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    )
  }

  return NextResponse.json(
    {
      accessToken: access.accessToken,
      product: access.session.product,
      premium: access.session.premium,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
