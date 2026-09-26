/**
 * Permissions delegated to the Spotify embed iframe.
 *
 * A bare feature token in `allow` (what Spotify's iFrame API writes) allowlists
 * only the iframe's `src` origin. The history guard navigates with
 * `location.replace`, which does not update `src`, so Chrome re-evaluates the
 * policy and still denies open.spotify.com. Naming the embed origin makes the
 * feature available on the first load and on every later replace.
 */

export const SPOTIFY_EMBED_ALLOW_ORIGIN = "https://open.spotify.com"

/** Features the embed player needs. Spotify sets these, scoped only to `src`. */
export const EMBED_IFRAME_ALLOW_FEATURES = [
  "autoplay",
  "clipboard-write",
  "encrypted-media",
  "fullscreen",
  "picture-in-picture",
] as const

type AllowDirective = {
  feature: string
  tokens: string[]
}

function parseAllow(value: string): AllowDirective[] {
  const directives: AllowDirective[] = []
  const indexByFeature = new Map<string, number>()
  for (const part of value.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    const feature = tokens[0].toLowerCase()
    const rest = tokens.slice(1)
    const existing = indexByFeature.get(feature)
    if (existing == null) {
      indexByFeature.set(feature, directives.length)
      directives.push({ feature, tokens: rest })
    } else {
      directives[existing].tokens.push(...rest)
    }
  }
  return directives
}

function tokenGrantsOrigin(token: string, origin: string): boolean {
  const normalized = token.toLowerCase()
  return normalized === "*" || normalized === "'*'" || normalized === origin.toLowerCase()
}

/**
 * Merge `features` into an iframe `allow` value so each one is granted to
 * `origin`, while keeping every other directive and allowlist token.
 */
export function mergeIframeAllow(
  existing: string | null | undefined,
  features: readonly string[] = EMBED_IFRAME_ALLOW_FEATURES,
  origin: string = SPOTIFY_EMBED_ALLOW_ORIGIN
): string {
  const directives = parseAllow(existing ?? "")
  const indexByFeature = new Map(directives.map((directive, index) => [directive.feature, index]))
  for (const feature of features) {
    const key = feature.toLowerCase()
    let directive = indexByFeature.has(key) ? directives[indexByFeature.get(key)!] : undefined
    if (!directive) {
      directive = { feature: key, tokens: [] }
      indexByFeature.set(key, directives.length)
      directives.push(directive)
    }
    if (directive.tokens.some((token) => tokenGrantsOrigin(token, origin))) continue
    directive.tokens.push(origin)
  }
  return directives.map((directive) => [directive.feature, ...directive.tokens].join(" ")).join("; ")
}

type IframeAllowTarget = {
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  hasAttribute?(name: string): boolean
  removeAttribute?(name: string): void
}

/** Write the merged allow list when the current attribute would not grant it. */
export function applyMergedIframeAllow(iframe: IframeAllowTarget): void {
  const next = mergeIframeAllow(iframe.getAttribute("allow"))
  if (iframe.getAttribute("allow") !== next) iframe.setAttribute("allow", next)
}

const patchedIframes = new WeakSet<object>()

/**
 * Merge allow as Spotify sets it, and skip `allowfullscreen`.
 * Chrome warns that `allow` already takes precedence over that legacy attribute.
 */
export function patchEmbedIframeElement(iframe: HTMLIFrameElement): void {
  if (patchedIframes.has(iframe)) return
  patchedIframes.add(iframe)
  const nativeSetAttribute = iframe.setAttribute.bind(iframe)
  iframe.setAttribute = (name: string, value: string) => {
    const attr = name.toLowerCase()
    if (attr === "allowfullscreen") return
    if (attr === "allow") {
      const next = mergeIframeAllow(value)
      if (iframe.getAttribute("allow") !== next) nativeSetAttribute("allow", next)
      return
    }
    nativeSetAttribute(name, value)
  }
  iframe.removeAttribute("allowfullscreen")
  applyMergedIframeAllow(iframe)
}

/** Patch iframes created while `createController` builds the embed element. */
export function instrumentEmbedIframeCreation(): () => void {
  const original = document.createElement
  const wrapped = ((tagName: string, options?: ElementCreationOptions) => {
    const element = original.call(document, tagName, options)
    if (tagName.toLowerCase() === "iframe" && element instanceof HTMLIFrameElement) {
      patchEmbedIframeElement(element)
    }
    return element
  }) as typeof document.createElement
  document.createElement = wrapped
  return () => {
    if (document.createElement === wrapped) document.createElement = original
  }
}
