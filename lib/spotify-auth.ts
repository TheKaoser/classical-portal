import { createHash, randomBytes } from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const STATE_COOKIE = "cp_spotify_oauth_state"
const VERIFIER_COOKIE = "cp_spotify_pkce"
const RETURN_COOKIE = "cp_spotify_oauth_return"
const ACCESS_COOKIE = "cp_spotify_at"
const REFRESH_COOKIE = "cp_spotify_rt"
const EXPIRY_COOKIE = "cp_spotify_exp"
const USER_COOKIE = "cp_spotify_user"

const SCOPES = ["playlist-modify-private", "playlist-modify-public"].join(" ")

export type SpotifyUserSession = {
  connected: boolean
  displayName: string | null
  userId: string | null
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  }
}

export function isSpotifyOAuthConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET)
}

export function spotifyRedirectUri(requestUrl: string): string {
  if (process.env.SPOTIFY_REDIRECT_URI) return process.env.SPOTIFY_REDIRECT_URI
  return `${new URL(requestUrl).origin}/api/spotify/callback`
}

export function safeReturnPath(value: string | null | undefined): string {
  if (!value) return "/"
  if (!value.startsWith("/")) return "/"
  if (value.startsWith("//")) return "/"
  if (value.includes("://")) return "/"
  return value
}

function base64url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash("sha256").update(verifier).digest())
  return { verifier, challenge }
}

export function createOAuthState(): string {
  return randomBytes(16).toString("hex")
}

export function applyAuthCookies(
  response: NextResponse,
  values: {
    state: string
    verifier: string
    returnTo: string
  }
) {
  const base = { ...cookieBase(), maxAge: 600 }
  response.cookies.set(STATE_COOKIE, values.state, base)
  response.cookies.set(VERIFIER_COOKIE, values.verifier, base)
  response.cookies.set(RETURN_COOKIE, values.returnTo, base)
  return response
}

export function clearAuthCookies(response: NextResponse) {
  const base = { ...cookieBase(), maxAge: 0 }
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE, RETURN_COOKIE, ACCESS_COOKIE, REFRESH_COOKIE, EXPIRY_COOKIE, USER_COOKIE]) {
    response.cookies.set(name, "", base)
  }
  return response
}

function applySessionCookies(
  response: NextResponse,
  session: {
    accessToken: string
    refreshToken?: string
    expiresIn: number
    displayName: string
    userId: string
  }
) {
  const base = cookieBase()
  response.cookies.set(ACCESS_COOKIE, session.accessToken, { ...base, maxAge: session.expiresIn })
  if (session.refreshToken) {
    response.cookies.set(REFRESH_COOKIE, session.refreshToken, { ...base, maxAge: 60 * 60 * 24 * 30 })
  }
  response.cookies.set(EXPIRY_COOKIE, String(Date.now() + session.expiresIn * 1000), {
    ...base,
    maxAge: 60 * 60 * 24 * 30,
  })
  response.cookies.set(
    USER_COOKIE,
    encodeURIComponent(JSON.stringify({ displayName: session.displayName, userId: session.userId })),
    {
      ...base,
      maxAge: 60 * 60 * 24 * 30,
    }
  )
  response.cookies.set(STATE_COOKIE, "", { ...base, maxAge: 0 })
  response.cookies.set(VERIFIER_COOKIE, "", { ...base, maxAge: 0 })
  response.cookies.set(RETURN_COOKIE, "", { ...base, maxAge: 0 })
  return response
}

async function spotifyToken(body: URLSearchParams): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
} | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  })
  if (!res.ok) {
    console.error("Spotify user token request failed", res.status, await res.text().catch(() => ""))
    return null
  }
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
}

async function fetchSpotifyMe(accessToken: string): Promise<{ id: string; display_name?: string } | null> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return (await res.json()) as { id: string; display_name?: string }
}

export async function exchangeCodeForSession(input: {
  code: string
  redirectUri: string
  verifier: string
  response: NextResponse
}): Promise<boolean> {
  const tokens = await spotifyToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.verifier,
    })
  )
  if (!tokens) return false
  const me = await fetchSpotifyMe(tokens.access_token)
  if (!me) return false
  applySessionCookies(input.response, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    displayName: me.display_name || me.id,
    userId: me.id,
  })
  return true
}

export async function readOAuthHandshake(): Promise<{
  state: string | null
  verifier: string | null
  returnTo: string
}> {
  const store = await cookies()
  return {
    state: store.get(STATE_COOKIE)?.value ?? null,
    verifier: store.get(VERIFIER_COOKIE)?.value ?? null,
    returnTo: safeReturnPath(store.get(RETURN_COOKIE)?.value),
  }
}

export async function getUserAccessToken(): Promise<string | null> {
  const store = await cookies()
  const access = store.get(ACCESS_COOKIE)?.value
  const expiry = Number(store.get(EXPIRY_COOKIE)?.value || 0)
  if (access && Date.now() < expiry - 30_000) return access

  const refresh = store.get(REFRESH_COOKIE)?.value
  if (!refresh) return null
  const tokens = await spotifyToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
    })
  )
  if (!tokens) return null
  store.set(ACCESS_COOKIE, tokens.access_token, { ...cookieBase(), maxAge: tokens.expires_in })
  store.set(EXPIRY_COOKIE, String(Date.now() + tokens.expires_in * 1000), {
    ...cookieBase(),
    maxAge: 60 * 60 * 24 * 30,
  })
  if (tokens.refresh_token) {
    store.set(REFRESH_COOKIE, tokens.refresh_token, { ...cookieBase(), maxAge: 60 * 60 * 24 * 30 })
  }
  return tokens.access_token
}

export async function getSpotifyUserSession(): Promise<SpotifyUserSession> {
  const store = await cookies()
  const raw = store.get(USER_COOKIE)?.value
  const token = await getUserAccessToken()
  if (!token || !raw) return { connected: false, displayName: null, userId: null }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { displayName?: string; userId?: string }
    return {
      connected: true,
      displayName: parsed.displayName ?? null,
      userId: parsed.userId ?? null,
    }
  } catch {
    return { connected: false, displayName: null, userId: null }
  }
}

export async function createSpotifyPlaylist(input: {
  name: string
  description?: string
  trackUris: string[]
}): Promise<{ id: string; url: string } | { error: string; status: number }> {
  const token = await getUserAccessToken()
  const session = await getSpotifyUserSession()
  if (!token || !session.userId) return { error: "Not connected to Spotify", status: 401 }

  const create = await fetch(`https://api.spotify.com/v1/users/${session.userId}/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name.slice(0, 100),
      description: (input.description || "Created by Classical Portal").slice(0, 300),
      public: false,
    }),
    cache: "no-store",
  })
  if (!create.ok) {
    return { error: "Could not create playlist", status: create.status }
  }
  const playlist = (await create.json()) as { id: string; external_urls?: { spotify?: string } }

  if (input.trackUris.length) {
    const add = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: input.trackUris.slice(0, 100) }),
      cache: "no-store",
    })
    if (!add.ok) {
      return { error: "Playlist created but tracks could not be added", status: add.status }
    }
  }

  return {
    id: playlist.id,
    url: playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlist.id}`,
  }
}

export function authorizeUrl(input: { redirectUri: string; state: string; challenge: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID || "",
    response_type: "code",
    redirect_uri: input.redirectUri,
    scope: SCOPES,
    state: input.state,
    code_challenge_method: "S256",
    code_challenge: input.challenge,
    show_dialog: "false",
  })
  return `https://accounts.spotify.com/authorize?${params.toString()}`
}
