/**
 * Spotify's Embed iFrame API loads each URI by assigning `iframe.src`.
 * Once the frame is in the document, that assignment is a navigation in the
 * joint session history, so the browser Back button steps through movements
 * and works instead of leaving the page.
 *
 * `location.replace` on the iframe's window loads the next embed in place,
 * including the first track, and does not push a history entry. If the frame
 * has no window yet, assigning `src` is the initial load and also does not push.
 */

export type IframeLocation = {
  replace: (url: string) => void
}

export type IframeHistoryTarget = {
  contentWindow: { location: IframeLocation } | null
}

export function navigateIframeWithoutHistory(
  iframe: IframeHistoryTarget,
  url: string,
  assignSrc: (url: string) => void
): void {
  const next = String(url)
  if (!next) return
  const win = iframe.contentWindow
  if (win) {
    try {
      win.location.replace(next)
      return
    } catch {
      // A detached frame can refuse replace. Fall back so playback still starts.
    }
  }
  assignSrc(next)
}

const guarded = new WeakSet<object>()

/** Make later `src` assignments on this frame use `location.replace`. */
export function installIframeHistoryGuard(iframe: HTMLIFrameElement): void {
  if (guarded.has(iframe)) return
  const proto = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src")
  if (!proto?.get || !proto.set) return
  guarded.add(iframe)
  Object.defineProperty(iframe, "src", {
    configurable: true,
    enumerable: true,
    get() {
      return proto.get!.call(this)
    },
    set(value: string) {
      navigateIframeWithoutHistory(this, String(value), (next) => {
        proto.set!.call(this, next)
      })
    },
  })
}
