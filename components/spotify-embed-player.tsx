"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  PLAYER_BAR_DOCK_CLASS,
  PLAYER_BAR_DOCK_STYLE,
  PLAYER_BAR_FALLBACK_HEIGHT_PX,
  PLAYER_BAR_HEIGHT_VAR,
  PLAYER_BAR_SHELL_CLASS,
  PLAYER_BAR_SHELL_STYLE,
  playerBarPaddingCss,
} from "@/lib/player-bar-layout"
import {
  EMBED_PLAYER_LOAD_FAILED,
  SPOTIFY_EMBED_HEIGHT_PX,
  createMovementQueue,
  spotifyEmbedTheme,
  type EmbedPlaybackUpdate,
  type MovementQueue,
} from "@/lib/spotify-embed-queue"
import {
  applyMergedIframeAllow,
  instrumentEmbedIframeCreation,
  patchEmbedIframeElement,
} from "@/lib/iframe-allow"
import { installIframeHistoryGuard } from "@/lib/iframe-history"
import { loadSpotifyIframeApi } from "@/lib/spotify-iframe-api"

export type EmbedPlaybackIssue = {
  code: "browser" | "playback_failed"
  message?: string
}

type StartCommand = (uris: string[], index: number, generation: number, contextUri: string | null) => void

type PendingStart = { uris: string[]; index: number; generation: number; contextUri: string | null }

function pageIsDark(): boolean {
  const root = document.documentElement
  if (root.classList.contains("dark") || root.dataset.theme === "dark") return true
  if (root.classList.contains("light") || root.dataset.theme === "light") return false
  return false
}

function publishMediaSession(state: "playing" | "paused") {
  const session = navigator.mediaSession
  if (!session) return
  try {
    session.playbackState = state
    if (!session.metadata) session.metadata = new MediaMetadata({ title: "Classical Portal" })
  } catch {
    // A browser without Media Session metadata still plays.
  }
}

function readUpdate(event: SpotifyEmbedPlaybackEvent | EmbedPlaybackUpdate): EmbedPlaybackUpdate | null {
  if (!event || typeof event !== "object") return null
  if ("isPaused" in event && typeof event.isPaused === "boolean" && "position" in event && "duration" in event) {
    return event
  }
  const data = "data" in event ? event.data : undefined
  if (!data || typeof data.isPaused !== "boolean") return null
  return data
}

function fitIframe(host: HTMLElement) {
  const iframe = host.querySelector("iframe")
  if (!(iframe instanceof HTMLIFrameElement)) return
  iframe.style.width = "100%"
  iframe.style.maxWidth = "100%"
  iframe.style.height = `${SPOTIFY_EMBED_HEIGHT_PX}px`
  iframe.style.border = "0"
  iframe.style.display = "block"
  iframe.title = "Spotify player"
  // Re-apply in case the attribute was reset after the frame was created.
  // The value has to be in place before a navigation starts; the src guard
  // and the creation patch do that for the first load and each loadUri.
  applyMergedIframeAllow(iframe)
}

export function SpotifyEmbedPlayer({
  uris,
  startIndex,
  generation,
  visible,
  needsGesture,
  onRegisterCommands,
  onPhase,
  onTrackUri,
  onContextEnded,
  onUserTransport,
  onNeedsGesture,
  onIssue,
}: {
  uris: string[]
  startIndex: number
  generation: number
  visible: boolean
  needsGesture: boolean
  onRegisterCommands: (commands: {
    start: StartCommand
    pause: () => void
    resume: () => void
    arm: () => void
  }) => void
  onPhase?: (phase: "connecting" | "playing" | "paused") => void
  onTrackUri?: (uri: string | null) => void
  onContextEnded?: (uri: string) => void
  onUserTransport?: () => void
  onNeedsGesture?: (needed: boolean) => void
  onIssue?: (issue: EmbedPlaybackIssue) => void
}) {
  const onPhaseRef = useRef(onPhase)
  const onTrackUriRef = useRef(onTrackUri)
  const onContextEndedRef = useRef(onContextEnded)
  const onUserTransportRef = useRef(onUserTransport)
  const onNeedsGestureRef = useRef(onNeedsGesture)
  const onIssueRef = useRef(onIssue)
  const onRegisterRef = useRef(onRegisterCommands)
  onPhaseRef.current = onPhase
  onTrackUriRef.current = onTrackUri
  onContextEndedRef.current = onContextEnded
  onUserTransportRef.current = onUserTransport
  onNeedsGestureRef.current = onNeedsGesture
  onIssueRef.current = onIssue
  onRegisterRef.current = onRegisterCommands

  const hostRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<SpotifyEmbedController | null>(null)
  const queueRef = useRef<MovementQueue | null>(null)
  const appliedGenerationRef = useRef(-1)
  const pendingRef = useRef<PendingStart | null>(null)
  const creatingRef = useRef<Promise<void> | null>(null)
  const queuedRef = useRef<Array<(controller: SpotifyEmbedController) => void>>([])
  const commandsRef = useRef<{ pause: () => void; resume: () => void }>({
    pause: () => {},
    resume: () => {},
  })
  const [portalReady, setPortalReady] = useState(false)
  const iframeWatchRef = useRef<MutationObserver | null>(null)

  const armEmbedIframe = useCallback((host: HTMLElement) => {
    const iframe = host.querySelector("iframe")
    if (!(iframe instanceof HTMLIFrameElement)) return
    // Spotify inserts the iframe before setting src. Patching here, and from
    // the creation hook below, puts the merged allow list on the element
    // before that navigation. A later loadUri goes through the src guard.
    patchEmbedIframeElement(iframe)
    applyMergedIframeAllow(iframe)
    installIframeHistoryGuard(iframe)
  }, [])

  const flushController = useCallback(() => {
    const controller = controllerRef.current
    if (!controller) return
    const fns = queuedRef.current.splice(0)
    for (const fn of fns) fn(controller)
    const host = hostRef.current
    if (host) fitIframe(host)
  }, [])

  const runOnController = useCallback(
    (fn: (controller: SpotifyEmbedController) => void) => {
      const controller = controllerRef.current
      if (controller) fn(controller)
      else queuedRef.current.push(fn)
    },
    []
  )

  const ensureController = useCallback(() => {
    if (controllerRef.current) return Promise.resolve()
    if (creatingRef.current) return creatingRef.current
    const host = hostRef.current
    if (!host) return Promise.resolve()

    creatingRef.current = loadSpotifyIframeApi()
      .then(
        (iframeApi) =>
          new Promise<void>((resolve) => {
            if (controllerRef.current) {
              resolve()
              return
            }
            const mount = hostRef.current
            if (!mount) {
              creatingRef.current = null
              resolve()
              return
            }
            if (!iframeWatchRef.current && typeof MutationObserver !== "undefined") {
              const observer = new MutationObserver(() => {
                const node = hostRef.current
                if (node) armEmbedIframe(node)
              })
              observer.observe(mount, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["allow"],
              })
              iframeWatchRef.current = observer
            }
            const placeholder = document.createElement("div")
            mount.replaceChildren(placeholder)
            let settled = false
            const finish = () => {
              if (settled) return
              settled = true
              resolve()
            }
            // Spotify creates the iframe and sets `allow` inside this call,
            // before the callback. Patch the element as it is created so the
            // merged policy is in place before the first src navigation.
            const restoreIframeCreation = instrumentEmbedIframeCreation()
            try {
              iframeApi.createController(
                placeholder,
                {
                  width: Math.max(320, mount.clientWidth || 640),
                  height: SPOTIFY_EMBED_HEIGHT_PX,
                },
                (controller) => {
                  // Guard before any loadUri. The API assigns iframe.src, which
                  // would otherwise push a joint session history entry per track.
                  // The src setter also refreshes `allow` before location.replace.
                  armEmbedIframe(mount)
                  controllerRef.current = controller
                  controller.addListener("playback_update", (event) => {
                    const update = readUpdate(event)
                    if (update) queueRef.current?.onPlaybackUpdate(update)
                  })
                  controller.addListener("ready", () => {
                    const node = hostRef.current
                    if (node) fitIframe(node)
                    finish()
                  })
                  flushController()
                  const node = hostRef.current
                  if (node) fitIframe(node)
                  window.setTimeout(finish, 1_500)
                }
              )
            } finally {
              restoreIframeCreation()
            }
          })
      )
      .catch(() => {
        creatingRef.current = null
        onIssueRef.current?.({ code: "browser", message: EMBED_PLAYER_LOAD_FAILED })
      })

    return creatingRef.current
  }, [armEmbedIframe, flushController])

  const playPending = useCallback(
    (pending: PendingStart) => {
      const queue = queueRef.current
      if (!queue) return
      if (appliedGenerationRef.current !== pending.generation) {
        appliedGenerationRef.current = pending.generation
        queue.start(pending.uris, pending.index, pending.contextUri)
      }
      flushController()
      void ensureController()?.then(() => flushController())
    },
    [ensureController, flushController]
  )

  useEffect(() => {
    const queue = createMovementQueue(
      {
        loadUri(uri) {
          runOnController((controller) => {
            const theme = spotifyEmbedTheme(pageIsDark())
            if (theme) controller.loadUri(uri, false, 0, theme)
            else controller.loadUri(uri, false, 0)
          })
        },
        play() {
          runOnController((controller) => {
            controller.play()
            queueRef.current?.notePlayDispatched()
          })
        },
        pause() {
          runOnController((controller) => controller.pause())
        },
        resume() {
          runOnController((controller) => {
            controller.resume()
            queueRef.current?.notePlayDispatched()
          })
        },
      },
      {
        schedule: (callback, delayMs) => {
          const id = window.setTimeout(callback, delayMs)
          return () => window.clearTimeout(id)
        },
        hidden: () => document.hidden,
        subscribeHidden(listener) {
          const onChange = () => {
            if (document.hidden) listener()
          }
          document.addEventListener("visibilitychange", onChange)
          return () => document.removeEventListener("visibilitychange", onChange)
        },
        onPhase: (phase) => {
          onPhaseRef.current?.(phase)
          publishMediaSession(phase === "playing" ? "playing" : "paused")
        },
        onTrack: (uri) => {
          onTrackUriRef.current?.(uri)
          publishMediaSession("playing")
        },
        onWorkEnded: (uri) => onContextEndedRef.current?.(uri),
        onNeedsGesture: (needed) => onNeedsGestureRef.current?.(needed),
        onUserTransport: () => onUserTransportRef.current?.(),
      }
    )
    queueRef.current = queue
    const onVisible = () => {
      if (!document.hidden) queue.nudgeIfWaiting()
    }
    document.addEventListener("visibilitychange", onVisible)
    const session = navigator.mediaSession
    if (session) {
      try {
        session.setActionHandler("nexttrack", () => queue.next())
        session.setActionHandler("previoustrack", () => queue.previous())
      } catch {
        // The action is unsupported in this browser.
      }
    }
    commandsRef.current = {
      pause: () => queue.pause(),
      resume: () => queue.resume(),
    }

    const start: StartCommand = (nextUris, index, nextGeneration, contextUri) => {
      const pending = { uris: nextUris, index, generation: nextGeneration, contextUri }
      pendingRef.current = pending
      const host = hostRef.current
      const measurable = Boolean(host && host.clientWidth > 0 && !host.closest("[hidden]"))
      if (!measurable) return
      playPending(pending)
    }

    onRegisterRef.current({
      start,
      pause: () => queue.pause(),
      resume: () => queue.resume(),
      arm: () => {
        void loadSpotifyIframeApi().catch(() => {
          // The play attempt reports a missing script.
        })
      },
    })

    const pending = pendingRef.current
    if (pending) playPending(pending)

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      queue.destroy()
      if (queueRef.current === queue) queueRef.current = null
      const media = navigator.mediaSession
      if (!media) return
      try {
        media.setActionHandler("nexttrack", null)
        media.setActionHandler("previoustrack", null)
      } catch {
        // Ignore unsupported actions on the way out.
      }
    }
  }, [playPending, runOnController])

  useLayoutEffect(() => {
    const pending = pendingRef.current
    if (!visible || !portalReady || !pending || !queueRef.current) return
    playPending(pending)
  }, [visible, generation, uris, startIndex, playPending, portalReady])

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useLayoutEffect(() => {
    if (!visible) return
    const root = document.documentElement
    const previousVar = root.style.getPropertyValue(PLAYER_BAR_HEIGHT_VAR)
    const applyHeight = (heightPx: number) => {
      root.style.setProperty(PLAYER_BAR_HEIGHT_VAR, playerBarPaddingCss(heightPx))
    }
    applyHeight(PLAYER_BAR_FALLBACK_HEIGHT_PX)
    const node = barRef.current
    if (!node || typeof ResizeObserver === "undefined") {
      return () => {
        if (previousVar) root.style.setProperty(PLAYER_BAR_HEIGHT_VAR, previousVar)
        else root.style.removeProperty(PLAYER_BAR_HEIGHT_VAR)
      }
    }
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? node.getBoundingClientRect().height
      applyHeight(height)
    })
    observer.observe(node)
    applyHeight(node.getBoundingClientRect().height)
    return () => {
      observer.disconnect()
      if (previousVar) root.style.setProperty(PLAYER_BAR_HEIGHT_VAR, previousVar)
      else root.style.removeProperty(PLAYER_BAR_HEIGHT_VAR)
    }
  }, [visible, portalReady, needsGesture])

  if (!portalReady) return null

  return createPortal(
    <div
      ref={barRef}
      role="region"
      aria-label="Spotify player"
      hidden={!visible}
      data-player-dock={visible ? "flush" : undefined}
      className={visible ? PLAYER_BAR_DOCK_CLASS : "hidden"}
      style={visible ? PLAYER_BAR_DOCK_STYLE : undefined}
    >
      <div className={PLAYER_BAR_SHELL_CLASS} style={PLAYER_BAR_SHELL_STYLE} data-player-shell="">
        {needsGesture ? (
          <div className="pointer-events-auto flex items-center justify-between gap-3 border-b border-border bg-card px-3 py-2 sm:px-4">
            <p className="text-sm text-foreground">Tap play to continue</p>
            <button
              type="button"
              className="pointer-events-auto shrink-0 cursor-pointer rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
              onClick={() => commandsRef.current.resume()}
            >
              Play
            </button>
          </div>
        ) : null}
        <div ref={hostRef} className="pointer-events-auto h-[152px] w-full overflow-hidden bg-card" />
      </div>
    </div>,
    document.body
  )
}
