import { NextResponse } from "next/server"
import { readSdkAccess } from "@/lib/spotify-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Short-lived access token for Spotify.Player getOAuthToken. Same-origin only. */
export async function GET() {
  const access = await readSdkAccess()
  if (!access) {
    return NextResponse.json({ error: "Not connected to Spotify" }, { status: 401 })
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
