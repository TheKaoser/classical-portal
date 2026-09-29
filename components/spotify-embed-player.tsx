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
import {
  SPOTIFY_BROWSER_LOGIN_LABEL,
  SPOTIFY_BROWSER_LOGIN_TITLE,
  clearSpotifyBrowserLoginPending,
  embedSessionHasFullTracks,
  markSpotifyBrowserLoginPending,
  openSpotifyBrowserLogin,
  shouldReloadEmbedForLogin,
  spotifyBrowserLoginHref,
  spotifyBrowserLoginIsNewDocument,
  spotifyBrowserLoginIsPending,
  spotifyBrowserLoginPromptDelayMs,
  type BrowserLoginWindow,
} from "@/lib/spotify-browser-login"

export type EmbedPlaybackIssue = {
  code: "browser" | "playback_failed"
  message?: string
}

type StartCommand = (uris: string[], index: number, generation: number) => void

type PendingStart = { uris: string[]; index: number; generation: number }

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
  onRegisterCommands,
  onPhase,
  onTrackUri,
  onContextEnded,
  onUserTransport,
  onIssue,
}: {
  uris: string[]
  startIndex: number
  generation: number
  visible: boolean
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
  onIssue?: (issue: EmbedPlaybackIssue) => void
}) {
  const onPhaseRef = useRef(onPhase)
  const onTrackUriRef = useRef(onTrackUri)
  const onContextEndedRef = useRef(onContextEnded)
  const onUserTransportRef = useRef(onUserTransport)
  const onIssueRef = useRef(onIssue)
  const onRegisterRef = useRef(onRegisterCommands)
  onPhaseRef.current = onPhase
  onTrackUriRef.current = onTrackUri
  onContextEndedRef.current = onContextEnded
  onUserTransportRef.current = onUserTransport
  onIssueRef.current = onIssue
  onRegisterRef.current = onRegisterCommands

  const hostRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<SpotifyEmbedController | null>(null)
  const queueRef = useRef<MovementQueue | null>(null)
  const appliedGenerationRef = useRef(-1)
  const pendingRef = useRef<PendingStart | null>(null)
  const creatingRef = useRef<Promise<void> | null>(null)
  const sessionEpochRef = useRef(0)
  const loginWindowRef = useRef<BrowserLoginWindow | null>(null)
  const queuedRef = useRef<Array<(controller: SpotifyEmbedController) => void>>([])
  const [portalReady, setPortalReady] = useState(false)
  const [hasFullTracks, setHasFullTracks] = useState(false)
  const [showBrowserLogin, setShowBrowserLogin] = useState(false)
  const hasFullTracksRef = useRef(false)
  const noteEmbedDurationRef = useRef<(duration: number) => void>(() => {})
  const iframeWatchRef = useRef<MutationObserver | null>(null)

  noteEmbedDurationRef.current = (duration) => {
    if (hasFullTracksRef.current || !embedSessionHasFullTracks(duration)) return
    hasFullTracksRef.current = true
    setHasFullTracks(true)
    clearSpotifyBrowserLoginPending(window.sessionStorage)
  }

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
    const epoch = sessionEpochRef.current
    const attempt: { current: Promise<void> | null } = { current: null }

    const promise = loadSpotifyIframeApi()
      .then(
        (iframeApi) =>
          new Promise<void>((resolve) => {
            if (sessionEpochRef.current !== epoch || controllerRef.current) {
              resolve()
              return
            }
            const mount = hostRef.current
            if (!mount) {
              if (creatingRef.current === attempt.current) creatingRef.current = null
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
                  if (sessionEpochRef.current !== epoch) {
                    try {
                      controller.destroy()
                    } catch {
                      // A controller from a discarded sign-in reload is already gone.
                    }
                    if (creatingRef.current === attempt.current) creatingRef.current = null
                    finish()
                    return
                  }
                  // Guard before any loadUri. The API assigns iframe.src, which
                  // would otherwise push a joint session history entry per track.
                  // The src setter also refreshes `allow` before location.replace.
                  armEmbedIframe(mount)
                  controllerRef.current = controller
                  controller.addListener("playback_update", (event) => {
                    const update = readUpdate(event)
                    if (!update) return
                    queueRef.current?.onPlaybackUpdate(update)
                    noteEmbedDurationRef.current(update.duration)
                  })
                  controller.addListener("playback_started", (event) => {
                    const uri = event?.data?.playingURI
                    if (typeof uri === "string" && uri.length > 0) queueRef.current?.notePlayingUri(uri)
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
        if (creatingRef.current === attempt.current) creatingRef.current = null
        onIssueRef.current?.({ code: "browser", message: EMBED_PLAYER_LOAD_FAILED })
      })

    attempt.current = promise
    creatingRef.current = promise
    return promise
  }, [armEmbedIframe, flushController])

  const playPending = useCallback(
    (pending: PendingStart) => {
      const queue = queueRef.current
      if (!queue) return
      if (appliedGenerationRef.current !== pending.generation) {
        appliedGenerationRef.current = pending.generation
        queue.start(pending.uris, pending.index)
      }
      flushController()
      void ensureController()?.then(() => flushController())
    },
    [ensureController, flushController]
  )

  const reloadEmbedSession = useCallback(() => {
    sessionEpochRef.current += 1
    const previous = controllerRef.current
    controllerRef.current = null
    creatingRef.current = null
    queuedRef.current = []
    appliedGenerationRef.current = -1
    hasFullTracksRef.current = false
    setHasFullTracks(false)
    try {
      previous?.destroy()
    } catch {
      // The embed frame is replaced either way.
    }
    const host = hostRef.current
    if (host) host.replaceChildren()
    const pending = pendingRef.current
    if (pending && queueRef.current) playPending(pending)
  }, [playPending])

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
        onUserTransport: () => onUserTransportRef.current?.(),
      }
    )
    queueRef.current = queue
    const onVisibility = () => {
      queue.notePageHidden(document.hidden)
      if (!document.hidden) queue.nudgeIfWaiting()
    }
    // Focus covers a window that is shown again without a visibility flip.
    const onFocus = () => {
      if (!document.hidden) queue.nudgeIfWaiting()
    }
    const onPageShow = () => {
      if (!document.hidden) queue.nudgeIfWaiting()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onPageShow)
    const session = navigator.mediaSession
    if (session) {
      try {
        session.setActionHandler("nexttrack", () => queue.next())
        session.setActionHandler("previoustrack", () => queue.previous())
      } catch {
        // The action is unsupported in this browser.
      }
    }
    const start: StartCommand = (nextUris, index, nextGeneration) => {
      const pending = { uris: nextUris, index, generation: nextGeneration }
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
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
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

  useEffect(() => {
    if (!portalReady) return
    let leftPage = false
    const storage = window.sessionStorage
    // A new document creates a new embed, which already sends whatever cookie
    // exists. A page restored from memory keeps the same time origin and the
    // anonymous frame; pageshow reloads that one.
    if (spotifyBrowserLoginIsNewDocument(storage, performance.timeOrigin)) {
      clearSpotifyBrowserLoginPending(storage)
    }
    const reloadIfReturning = (restoredFromCache: boolean) => {
      const popup = loginWindowRef.current
      const popupClosed = Boolean(popup?.closed)
      if (
        !shouldReloadEmbedForLogin({
          pending: spotifyBrowserLoginIsPending(storage),
          popupClosed,
          becameVisible: leftPage && document.visibilityState === "visible",
          restoredFromCache,
        })
      ) {
        return
      }
      if (popupClosed) loginWindowRef.current = null
      clearSpotifyBrowserLoginPending(storage)
      leftPage = false
      reloadEmbedSession()
    }
    const onVisibility = () => {
      if (document.hidden) {
        leftPage = true
        return
      }
      reloadIfReturning(false)
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      leftPage = true
      reloadIfReturning(true)
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pageshow", onPageShow)
    const timer = window.setInterval(() => reloadIfReturning(false), 400)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pageshow", onPageShow)
      window.clearInterval(timer)
    }
  }, [portalReady, reloadEmbedSession])

  useEffect(() => {
    if (!visible || hasFullTracks) {
      setShowBrowserLogin(false)
      return
    }
    const coarse =
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches
    const delay = spotifyBrowserLoginPromptDelayMs(coarse)
    if (delay === 0) {
      setShowBrowserLogin(true)
      return
    }
    const id = window.setTimeout(() => setShowBrowserLogin(true), delay)
    return () => window.clearTimeout(id)
  }, [visible, hasFullTracks])

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
  }, [visible, portalReady])

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
        {showBrowserLogin ? (
          <a
            href={spotifyBrowserLoginHref()}
            data-spotify-browser-login=""
            title={SPOTIFY_BROWSER_LOGIN_TITLE}
            className="flex min-h-11 items-center justify-center border-b border-border bg-card px-3 text-center text-sm font-medium text-primary hover:bg-accent hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-9"
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                markSpotifyBrowserLoginPending(window.sessionStorage, Date.now(), performance.timeOrigin)
                return
              }
              event.preventDefault()
              loginWindowRef.current = openSpotifyBrowserLogin({
                open: (url, target, features) => window.open(url, target, features),
                assign: (url) => window.location.assign(url),
                storage: window.sessionStorage,
                documentOrigin: performance.timeOrigin,
              })
            }}
          >
            {SPOTIFY_BROWSER_LOGIN_LABEL}
          </a>
        ) : null}
        <div ref={hostRef} className="pointer-events-auto h-[152px] w-full overflow-hidden bg-card" />
      </div>
    </div>,
    document.body
  )
}
