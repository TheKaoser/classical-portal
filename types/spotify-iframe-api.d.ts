/** Spotify Embed iFrame API. https://developer.spotify.com/documentation/embeds/references/iframe-api */

interface SpotifyIFrameAPIOptions {
  uri?: string
  url?: string
  width?: number | string
  height?: number | string
}

interface SpotifyEmbedPlaybackEvent {
  data?: {
    playingURI?: string
    isPaused: boolean
    isBuffering?: boolean
    duration: number
    position: number
  }
}

interface SpotifyEmbedController {
  loadUri(spotifyUri: string, preferVideo?: boolean, startAt?: number, theme?: "dark"): void
  play(): void
  pause(): void
  resume(): void
  togglePlay(): void
  destroy(): void
  addListener(event: "ready", callback: () => void): void
  addListener(event: "playback_started", callback: (event: { data?: { playingURI?: string } }) => void): void
  addListener(event: "playback_update", callback: (event: SpotifyEmbedPlaybackEvent) => void): void
}

interface SpotifyIFrameAPI {
  createController(
    element: HTMLElement,
    options: SpotifyIFrameAPIOptions,
    callback: (controller: SpotifyEmbedController) => void
  ): void
}

interface Window {
  onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void
}
