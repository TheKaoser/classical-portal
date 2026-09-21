import { NextResponse } from "next/server"
import {
  exchangeCodeForSession,
  readOAuthHandshake,
  safeReturnPath,
  spotifyRedirectUri,
} from "@/lib/spotify-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const handshake = await readOAuthHandshake()
  const returnTo = safeReturnPath(handshake.returnTo)

  const fail = () => NextResponse.redirect(new URL(returnTo, url.origin))

  if (!code || !state || !handshake.state || state !== handshake.state || !handshake.verifier) {
    return fail()
  }

  const response = NextResponse.redirect(new URL(returnTo, url.origin))
  const ok = await exchangeCodeForSession({
    code,
    redirectUri: spotifyRedirectUri(request.url),
    verifier: handshake.verifier,
    response,
  })
  if (!ok) return fail()
  return response
}
