import { LIST_PLAY_UNREACHABLE } from "./list-playback.ts"

export type WorkPlaybackHit = {
  configured: boolean
  title: string
  uris: string[]
  albumId: string | null
}

export type FetchWorkPlayback = { ok: true; hit: WorkPlaybackHit } | { ok: false; message: string }

const memory = new Map<string, WorkPlaybackHit>()
const inflight = new Map<string, Promise<FetchWorkPlayback>>()

/** True when this work already resolved to at least one track during this page session. */
export function hasPlayableWorkPlayback(id: string): boolean {
  const hit = memory.get(id)
  return Boolean(hit?.configured && hit.uris.length > 0)
}

export async function fetchWorkPlayback(id: string): Promise<FetchWorkPlayback> {
  const cached = memory.get(id)
  if (cached) return { ok: true, hit: cached }
  const pending = inflight.get(id)
  if (pending) return pending

  const request = loadWorkPlayback(id)
  inflight.set(id, request)
  try {
    const result = await request
    if (result.ok) memory.set(id, result.hit)
    return result
  } finally {
    inflight.delete(id)
  }
}

async function loadWorkPlayback(id: string): Promise<FetchWorkPlayback> {
  try {
    const res = await fetch(`/api/spotify/work-playback?id=${encodeURIComponent(id)}`)
    const data = (await res.json().catch(() => null)) as
      | (Partial<WorkPlaybackHit> & { error?: string })
      | null
    if (!res.ok || !data) {
      return { ok: false, message: data?.error || LIST_PLAY_UNREACHABLE }
    }
    const uris = Array.isArray(data.uris) ? data.uris.filter((uri): uri is string => typeof uri === "string") : []
    return {
      ok: true,
      hit: {
        configured: Boolean(data.configured),
        title: typeof data.title === "string" ? data.title : "",
        uris,
        albumId: typeof data.albumId === "string" && data.albumId.length > 0 ? data.albumId : null,
      },
    }
  } catch {
    return { ok: false, message: LIST_PLAY_UNREACHABLE }
  }
}
