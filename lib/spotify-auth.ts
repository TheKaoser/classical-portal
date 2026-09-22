import { createHash, randomBytes } from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { spotifyOAuthScopeString, spotifyPremiumState } from "@/lib/spotify-playback"
import {
  classifySpotifyPlaylistWriteError,
  LIBRARY_RECONNECT_MESSAGE,
  PLAYLIST_RECONNECT_MESSAGE,
  spotifyAddPlaylistItemsUrl,
  spotifyCheckLikedTracksUrl,
  spotifyCreatePlaylistUrl,
  spotifyPlaylistCreateBody,
  spotifySaveLikedTracksUrl,
  spotifyTrackIdFromUri,
  tokenCanReadLikedTracks,
  tokenCanSaveLikedTracks,
  tokenCanSavePrivatePlaylist,
  type PlaylistWriteCode,
} from "@/lib/spotify-playlist"

const STATE_COOKIE = "cp_spotify_oauth_state"
const VERIFIER_COOKIE = "cp_spotify_pkce"
const RETURN_COOKIE = "cp_spotify_oauth_return"
const ACCESS_COOKIE = "cp_spotify_at"
const REFRESH_COOKIE = "cp_spotify_rt"
const EXPIRY_COOKIE = "cp_spotify_exp"
const USER_COOKIE = "cp_spotify_user"
const SCOPE_COOKIE = "cp_spotify_scope"

// Web Playback SDK, private playlist save, and Liked Songs (Save track).
// `playlist-modify-public` stays so tokens granted before private-only still refresh.
const SCOPES = spotifyOAuthScopeString()

export type SpotifyUserSession = {
  connected: boolean
  displayName: string | null
  userId: string | null
  product: string | null
  /** `null` when the product is unknown (older token or missing user-read-private). */
  premium: boolean | null
}

type StoredSpotifyUser = {
  displayName?: string
  userId?: string
  product?: string | null
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
  for (const name of [
    STATE_COOKIE,
    VERIFIER_COOKIE,
    RETURN_COOKIE,
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    EXPIRY_COOKIE,
    USER_COOKIE,
    SCOPE_COOKIE,
  ]) {
    response.cookies.set(name, "", base)
  }
  return response
}

function userCookieValue(user: StoredSpotifyUser): string {
  return encodeURIComponent(
    JSON.stringify({
      displayName: user.displayName ?? null,
      userId: user.userId ?? null,
      product: user.product ?? null,
    })
  )
}

function scopeCookieValue(scope: string): string {
  return encodeURIComponent(scope.trim())
}

function applySessionCookies(
  response: NextResponse,
  session: {
    accessToken: string
    refreshToken?: string
    expiresIn: number
    displayName: string
    userId: string
    product: string | null
    scope?: string
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
    userCookieValue({
      displayName: session.displayName,
      userId: session.userId,
      product: session.product,
    }),
    {
      ...base,
      maxAge: 60 * 60 * 24 * 30,
    }
  )
  if (session.scope?.trim()) {
    response.cookies.set(SCOPE_COOKIE, scopeCookieValue(session.scope), {
      ...base,
      maxAge: 60 * 60 * 24 * 30,
    })
  }
  response.cookies.set(STATE_COOKIE, "", { ...base, maxAge: 0 })
  response.cookies.set(VERIFIER_COOKIE, "", { ...base, maxAge: 0 })
  response.cookies.set(RETURN_COOKIE, "", { ...base, maxAge: 0 })
  return response
}

async function spotifyToken(body: URLSearchParams): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
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
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope?: string }
}

async function fetchSpotifyMe(
  accessToken: string
): Promise<{ id: string; display_name?: string; product?: string } | null> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return (await res.json()) as { id: string; display_name?: string; product?: string }
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
    product: me.product ?? null,
    scope: tokens.scope,
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
  if (tokens.scope?.trim()) {
    store.set(SCOPE_COOKIE, scopeCookieValue(tokens.scope), { ...cookieBase(), maxAge: 60 * 60 * 24 * 30 })
  }
  return tokens.access_token
}

/** Scopes granted at login. `null` for sessions created before this cookie existed. */
export async function readGrantedSpotifyScope(): Promise<string | null> {
  const raw = (await cookies()).get(SCOPE_COOKIE)?.value
  if (!raw) return null
  try {
    const scope = decodeURIComponent(raw).trim()
    return scope || null
  } catch {
    return raw.trim() || null
  }
}

type PlaylistWriteResult = { error: string; status: number; code: PlaylistWriteCode }

async function readSpotifyFailure(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "")
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text.slice(0, 300)
  }
}

/** Refuse before calling Spotify when we already know this token cannot save a private playlist. */
async function playlistScopeBlock(): Promise<PlaylistWriteResult | null> {
  const scope = await readGrantedSpotifyScope()
  if (scope == null || tokenCanSavePrivatePlaylist(scope)) return null
  return { error: PLAYLIST_RECONNECT_MESSAGE, status: 403, code: "insufficient_scope" }
}

/** Refuse before calling Spotify when this token cannot write Liked Songs. */
async function libraryModifyScopeBlock(): Promise<PlaylistWriteResult | null> {
  const scope = await readGrantedSpotifyScope()
  if (scope == null || tokenCanSaveLikedTracks(scope)) return null
  return { error: LIBRARY_RECONNECT_MESSAGE, status: 403, code: "insufficient_scope" }
}

/** Refuse before reading Liked Songs state when the read scope is missing. */
async function libraryReadScopeBlock(): Promise<PlaylistWriteResult | null> {
  const scope = await readGrantedSpotifyScope()
  if (scope == null || tokenCanReadLikedTracks(scope)) return null
  return { error: LIBRARY_RECONNECT_MESSAGE, status: 403, code: "insufficient_scope" }
}

const DISCONNECTED: SpotifyUserSession = {
  connected: false,
  displayName: null,
  userId: null,
  product: null,
  premium: null,
}

function sessionFromStored(stored: StoredSpotifyUser): SpotifyUserSession {
  const product = typeof stored.product === "string" && stored.product ? stored.product : null
  return {
    connected: true,
    displayName: stored.displayName ?? null,
    userId: stored.userId ?? null,
    product,
    premium: spotifyPremiumState(product),
  }
}

/**
 * Access token plus the stored profile, with one token read.
 * The Web Playback SDK calls this often, so it does not hit /me.
 */
export async function readSdkAccess(): Promise<{ accessToken: string; session: SpotifyUserSession } | null> {
  const accessToken = await getUserAccessToken()
  if (!accessToken) return null
  const raw = (await cookies()).get(USER_COOKIE)?.value
  if (!raw) return null
  try {
    const session = sessionFromStored(JSON.parse(decodeURIComponent(raw)) as StoredSpotifyUser)
    if (!session.connected) return null
    return { accessToken, session }
  } catch {
    return null
  }
}

export async function getSpotifyUserSession(): Promise<SpotifyUserSession> {
  const store = await cookies()
  const raw = store.get(USER_COOKIE)?.value
  const token = await getUserAccessToken()
  if (!token || !raw) return DISCONNECTED
  let stored: StoredSpotifyUser
  try {
    stored = JSON.parse(decodeURIComponent(raw)) as StoredSpotifyUser
  } catch {
    return DISCONNECTED
  }
  const me = await fetchSpotifyMe(token)
  if (me) {
    const product = me.product ?? stored.product ?? null
    const next: StoredSpotifyUser = {
      displayName: me.display_name || stored.displayName || me.id,
      userId: me.id || stored.userId,
      product,
    }
    if (next.displayName !== stored.displayName || next.userId !== stored.userId || next.product !== stored.product) {
      store.set(USER_COOKIE, userCookieValue(next), { ...cookieBase(), maxAge: 60 * 60 * 24 * 30 })
    }
    return sessionFromStored(next)
  }

  return sessionFromStored(stored)
}

export async function createSpotifyPlaylist(input: {
  name: string
  description?: string
  trackUris: string[]
}): Promise<{ id: string; url: string } | PlaylistWriteResult> {
  const token = await getUserAccessToken()
  if (!token) return { error: "Not connected to Spotify", status: 401, code: "not_connected" }
  const blocked = await playlistScopeBlock()
  if (blocked) return blocked

  const create = await fetch(spotifyCreatePlaylistUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      spotifyPlaylistCreateBody({
        name: input.name,
        description: input.description,
      })
    ),
    cache: "no-store",
  })
  if (!create.ok) {
    const failure = classifySpotifyPlaylistWriteError(
      create.status,
      await readSpotifyFailure(create),
      "Could not create playlist"
    )
    return { error: failure.message, status: failure.status, code: failure.code }
  }
  const playlist = (await create.json()) as { id?: string; external_urls?: { spotify?: string } }
  if (!playlist.id) return { error: "Could not create playlist", status: 502, code: "save_failed" }

  if (input.trackUris.length) {
    const itemsUrl = spotifyAddPlaylistItemsUrl(playlist.id)
    if (!itemsUrl) return { error: "Could not add tracks to the playlist", status: 502, code: "save_failed" }
    const add = await fetch(itemsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: input.trackUris.slice(0, 100) }),
      cache: "no-store",
    })
    if (!add.ok) {
      const failure = classifySpotifyPlaylistWriteError(
        add.status,
        await readSpotifyFailure(add),
        "Playlist created but tracks could not be added"
      )
      return { error: failure.message, status: failure.status, code: failure.code }
    }
  }

  return {
    id: playlist.id,
    url: playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlist.id}`,
  }
}

export async function addTracksToSpotifyPlaylist(input: {
  playlistId: string
  trackUris: string[]
}): Promise<{ ok: true } | PlaylistWriteResult> {
  const token = await getUserAccessToken()
  if (!token) return { error: "Not connected to Spotify", status: 401, code: "not_connected" }
  const uris = input.trackUris.slice(0, 100)
  if (!uris.length) return { error: "A track is required", status: 400, code: "save_failed" }
  const blocked = await playlistScopeBlock()
  if (blocked) return blocked

  const itemsUrl = spotifyAddPlaylistItemsUrl(input.playlistId)
  if (!itemsUrl) return { error: "Could not save the track", status: 400, code: "save_failed" }

  const add = await fetch(itemsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris }),
    cache: "no-store",
  })
  if (!add.ok) {
    const failure = classifySpotifyPlaylistWriteError(add.status, await readSpotifyFailure(add), "Could not save the track")
    return { error: failure.message, status: failure.status, code: failure.code }
  }
  return { ok: true }
}

/**
 * Save the current movement into Spotify Liked Songs (`PUT /v1/me/tracks`).
 * This is not a private playlist.
 */
export async function saveLikedTrack(uri: string): Promise<{ ok: true } | PlaylistWriteResult> {
  const token = await getUserAccessToken()
  if (!token) return { error: "Not connected to Spotify", status: 401, code: "not_connected" }
  const id = spotifyTrackIdFromUri(uri)
  if (!id) return { error: "A Spotify track is required", status: 400, code: "save_failed" }
  const blocked = await libraryModifyScopeBlock()
  if (blocked) return blocked

  const save = await fetch(spotifySaveLikedTracksUrl(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids: [id] }),
    cache: "no-store",
  })
  if (!save.ok) {
    const failure = classifySpotifyPlaylistWriteError(
      save.status,
      await readSpotifyFailure(save),
      "Could not save this track",
      LIBRARY_RECONNECT_MESSAGE
    )
    return { error: failure.message, status: failure.status, code: failure.code }
  }
  return { ok: true }
}

/** Whether each URI is already in Liked Songs (`GET /v1/me/tracks/contains`). */
export async function checkLikedTracks(
  uris: string[]
): Promise<{ saved: boolean[] } | PlaylistWriteResult> {
  const token = await getUserAccessToken()
  if (!token) return { error: "Not connected to Spotify", status: 401, code: "not_connected" }
  const ids = uris.map(spotifyTrackIdFromUri).filter((id): id is string => Boolean(id))
  if (ids.length === 0) return { error: "A Spotify track is required", status: 400, code: "save_failed" }
  const blocked = await libraryReadScopeBlock()
  if (blocked) return blocked

  const url = spotifyCheckLikedTracksUrl(ids)
  if (!url) return { error: "A Spotify track is required", status: 400, code: "save_failed" }

  const check = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!check.ok) {
    const failure = classifySpotifyPlaylistWriteError(
      check.status,
      await readSpotifyFailure(check),
      "Could not check liked tracks",
      LIBRARY_RECONNECT_MESSAGE
    )
    return { error: failure.message, status: failure.status, code: failure.code }
  }
  const payload = (await check.json().catch(() => null)) as unknown
  if (!Array.isArray(payload) || payload.some((entry) => typeof entry !== "boolean")) {
    return { error: "Could not check liked tracks", status: 502, code: "save_failed" }
  }
  return { saved: payload as boolean[] }
}

export function authorizeUrl(input: {
  redirectUri: string
  state: string
  challenge: string
  showDialog?: boolean
}): string {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID || "",
    response_type: "code",
    redirect_uri: input.redirectUri,
    scope: SCOPES,
    state: input.state,
    code_challenge_method: "S256",
    code_challenge: input.challenge,
    show_dialog: input.showDialog ? "true" : "false",
  })
  return `https://accounts.spotify.com/authorize?${params.toString()}`
}
