/**
 * Loads the Spotify iFrame API once, in the browser.
 * https://developer.spotify.com/documentation/embeds/references/iframe-api
 */

export const SPOTIFY_IFRAME_API_SRC = "https://open.spotify.com/embed/iframe-api/v1"

let api: SpotifyIFrameAPI | null = null
let pending: Promise<SpotifyIFrameAPI> | null = null

export function getSpotifyIframeApi(): SpotifyIFrameAPI | null {
  return api
}

export function loadSpotifyIframeApi(): Promise<SpotifyIFrameAPI> {
  if (api) return Promise.resolve(api)
  if (pending) return pending
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Spotify iFrame API can only load in the browser"))
  }

  pending = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending = null
      reject(new Error("timeout"))
    }, 15_000)

    const previous = window.onSpotifyIframeApiReady
    window.onSpotifyIframeApiReady = (next) => {
      window.clearTimeout(timeout)
      api = next
      previous?.(next)
      resolve(next)
    }

    if (document.querySelector(`script[src="${SPOTIFY_IFRAME_API_SRC}"]`)) return
    const script = document.createElement("script")
    script.src = SPOTIFY_IFRAME_API_SRC
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timeout)
      pending = null
      reject(new Error("script"))
    }
    document.head.appendChild(script)
  })

  return pending
}
