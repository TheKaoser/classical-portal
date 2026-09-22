import { NextResponse } from "next/server"
import {
  applyAuthCookies,
  authorizeUrl,
  createOAuthState,
  createPkce,
  isSpotifyOAuthConfigured,
  safeReturnPath,
  spotifyRedirectUri,
} from "@/lib/spotify-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  if (!isSpotifyOAuthConfigured()) {
    return NextResponse.json({ error: "Spotify is not configured" }, { status: 501 })
  }

  const url = new URL(request.url)
  const returnTo = safeReturnPath(url.searchParams.get("returnTo"))
  const redirectUri = spotifyRedirectUri(request.url)
  const state = createOAuthState()
  const { verifier, challenge } = createPkce()
  const showDialog = url.searchParams.get("reconnect") === "1"

  const response = NextResponse.redirect(authorizeUrl({ redirectUri, state, challenge, showDialog }))
  applyAuthCookies(response, { state, verifier, returnTo })
  return response
}
