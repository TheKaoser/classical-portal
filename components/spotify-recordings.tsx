"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSpotifyPlayer } from "@/components/spotify-player-provider"
import { cn } from "@/lib/utils"
import { formatDuration, type SpotifyRecording, type SpotifyTrackMatch } from "@/lib/spotify-model"
import { orderedTrackUris } from "@/lib/spotify-playback"
import { albumPlaybackControl, isAlbumRowActive } from "@/lib/spotify-player-session"

export function SpotifyRecordings({
  configured,
  searchUrl,
  recordings,
}: {
  configured: boolean
  searchUrl: string
  recordings: SpotifyRecording[]
}) {
  const {
    playRequest,
    playerPhase,
    activeUri,
    armPlayback,
    pausePlayback,
    resumePlayback,
    beginPlayback,
    lastIssue,
    clearLastIssue,
  } = useSpotifyPlayer()

  const [selectedRecordingId, setSelectedRecordingId] = useState(recordings[0]?.id ?? "")
  const selectedRecording =
    recordings.find((recording) => recording.id === selectedRecordingId) ?? recordings[0] ?? null
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!lastIssue) return
    setNotice(lastIssue.message || "Spotify could not start playback.")
    clearLastIssue()
  }, [lastIssue, clearLastIssue])

  function requestPlayback(recordingId: string, uris: string[], position: number) {
    setNotice(null)
    clearLastIssue()
    armPlayback()
    beginPlayback(recordingId, uris, position)
  }

  function focusRecording(recording: SpotifyRecording) {
    setSelectedRecordingId(recording.id)
  }

  function handlePlay(recording: SpotifyRecording) {
    const uris = orderedTrackUris(recording.tracks)
    if (uris.length === 0) return
    focusRecording(recording)
    requestPlayback(recording.id, uris, 0)
  }

  function handleAlbumPlaybackControl(recording: SpotifyRecording) {
    const control = albumPlaybackControl({
      recordingId: recording.id,
      playRequestRecordingId: playRequest?.recordingId ?? null,
      playerPhase,
    })
    if (control.action === "pause") {
      pausePlayback()
      return
    }
    if (control.action === "resume") {
      resumePlayback()
      return
    }
    if (control.action === "none") return
    handlePlay(recording)
  }

  function playMovement(recording: SpotifyRecording, track: SpotifyTrackMatch) {
    const uris = orderedTrackUris(recording.tracks)
    const index = uris.indexOf(track.uri)
    if (index < 0) return
    setSelectedRecordingId(recording.id)
    requestPlayback(recording.id, uris, index)
  }

  function selectAlbum(recording: SpotifyRecording) {
    if (recording.id === selectedRecordingId) return
    focusRecording(recording)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium tracking-tight text-foreground">On Spotify</h2>
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
        >
          Search on Spotify
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {!configured && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Matching recordings appear here once Spotify API credentials are set on the server.
          </p>
          <Button asChild>
            <a href={searchUrl} target="_blank" rel="noopener noreferrer">
              Open in Spotify
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      )}

      {configured && recordings.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No close catalog matches for this work. Search the work on Spotify instead.
          </p>
          <Button asChild>
            <a href={searchUrl} target="_blank" rel="noopener noreferrer">
              Open in Spotify
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      )}

      {selectedRecording && (
        <div className="space-y-3">
          {notice ? <p className="text-sm text-destructive">{notice}</p> : null}
          <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            {recordings.map((recording) => {
              const selected = selectedRecording.id === recording.id
              const playingThis = playRequest?.recordingId === recording.id
              const albumTitle = recording.album || recording.artists
              const movementCount = recording.tracks.length
              const connecting = playingThis && playerPhase === "connecting"
              const albumControl = albumPlaybackControl({
                recordingId: recording.id,
                playRequestRecordingId: playRequest?.recordingId ?? null,
                playerPhase,
              })
              const albumActive = isAlbumRowActive({
                recordingId: recording.id,
                playRequestRecordingId: playRequest?.recordingId ?? null,
              })
              return (
                <li key={recording.id}>
                  <div
                    className={cn(
                      "flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4",
                      albumActive ? "bg-accent" : selected ? "bg-muted/80" : ""
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectAlbum(recording)}
                      aria-pressed={selected}
                      aria-expanded={selected}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                    >
                      {recording.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={recording.image}
                          alt=""
                          width={40}
                          height={40}
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-secondary" />
                      )}
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block truncate text-sm text-foreground",
                            albumActive && "font-medium text-primary",
                            selected && !albumActive && "font-medium"
                          )}
                        >
                          {albumTitle}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {recording.artists}
                          {movementCount > 1 ? ` · ${movementCount} movements` : ""}
                        </span>
                      </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <Button
                        type="button"
                        onPointerDown={() => armPlayback()}
                        onClick={() => handleAlbumPlaybackControl(recording)}
                        disabled={connecting || movementCount === 0}
                        aria-pressed={albumControl.pressed}
                        className="cursor-pointer"
                        title={
                          albumControl.action === "pause"
                            ? "Pause playback in this page."
                            : albumControl.action === "resume"
                              ? "Resume playback in this page."
                              : "Plays this recording from the first movement, in order, in this page."
                        }
                      >
                        {albumControl.label === "Pause" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {albumControl.label}
                      </Button>
                    </div>
                  </div>
                  {selected && recording.tracks.length > 0 && (
                    <ul className="border-t border-border">
                      {recording.tracks.map((track) => {
                        const active = playingThis && activeUri === track.uri
                        return (
                          <li key={track.id}>
                            <button
                              type="button"
                              onPointerDown={() => armPlayback()}
                              onClick={() => playMovement(recording, track)}
                              aria-pressed={active}
                              title="Play this movement"
                              className={cn(
                                "flex w-full cursor-pointer items-center gap-3 py-2.5 pr-3 pl-6 text-left sm:pr-4",
                                active && "bg-accent"
                              )}
                            >
                              {track.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={track.image}
                                  alt=""
                                  width={40}
                                  height={40}
                                  className="h-10 w-10 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-secondary" />
                              )}
                              <span className="min-w-0">
                                <span
                                  className={cn(
                                    "block truncate text-sm text-foreground",
                                    active && "font-medium text-primary"
                                  )}
                                >
                                  {track.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {track.artists}
                                  {track.durationMs ? ` · ${formatDuration(track.durationMs)}` : ""}
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
