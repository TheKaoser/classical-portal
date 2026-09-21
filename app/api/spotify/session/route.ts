import { NextResponse } from "next/server"
import { getSpotifyUserSession } from "@/lib/spotify-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await getSpotifyUserSession()
  return NextResponse.json(session)
}
