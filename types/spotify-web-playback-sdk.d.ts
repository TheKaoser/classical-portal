export {}

declare global {
  interface SpotifyPlaybackTrack {
    uri: string
    name: string
    duration_ms: number
    artists: { name: string }[]
  }

  interface SpotifyPlaybackState {
    paused: boolean
    position: number
    duration: number
    track_window: {
      current_track: SpotifyPlaybackTrack
      previous_tracks: SpotifyPlaybackTrack[]
      next_tracks: SpotifyPlaybackTrack[]
    }
  }

  interface SpotifyPlayer {
    connect(): Promise<boolean>
    disconnect(): void
    addListener(event: "ready" | "not_ready", callback: (event: { device_id: string }) => void): boolean
    addListener(event: "player_state_changed", callback: (state: SpotifyPlaybackState | null) => void): boolean
    addListener(
      event: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
      callback: (event: { message: string }) => void
    ): boolean
    togglePlay(): Promise<void>
    pause(): Promise<void>
    nextTrack(): Promise<void>
    previousTrack(): Promise<void>
    seek(positionMs: number): Promise<void>
    getCurrentState(): Promise<SpotifyPlaybackState | null>
    setVolume(volume: number): Promise<void>
  }

  interface SpotifyPlayerInit {
    name: string
    getOAuthToken: (callback: (token: string) => void) => void
    volume?: number
  }

  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: {
      Player: new (options: SpotifyPlayerInit) => SpotifyPlayer
    }
  }
}
