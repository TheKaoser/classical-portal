import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { Newsreader, Inter } from "next/font/google"
import "./globals.css"
import { AppNavigationMarker } from "@/components/app-navigation-marker"
import { SiteHeader } from "@/components/site-header"
import { SpotifyPlayerProvider } from "@/components/spotify-player-provider"
import { isSpotifyOAuthConfigured } from "@/lib/spotify"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Classical Portal",
    template: "%s · Classical Portal",
  },
  description: "Browse classical composers and works, then play matching recordings on Spotify.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

const footerLinkClassName =
  "text-primary underline-offset-2 hover:text-primary-hover hover:underline"

function donateUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_DONATE_URL?.trim()
  return url || undefined
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const oauthConfigured = isSpotifyOAuthConfigured()
  const donateHref = donateUrl()

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${newsreader.variable} flex min-h-dvh flex-col font-sans antialiased`}
      >
        <SpotifyPlayerProvider oauthConfigured={oauthConfigured}>
          <AppNavigationMarker />
          <SiteHeader />
          <main className="relative mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
            {children}
          </main>
          <footer className="relative mx-auto mt-auto flex w-full max-w-4xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 pb-8 pt-4 text-sm text-muted-foreground sm:px-6">
            <p>
              Catalog from{" "}
              <a
                className={footerLinkClassName}
                href="https://openopus.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Opus
              </a>
              . Recordings via{" "}
              <a
                className={footerLinkClassName}
                href="https://spotify.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Spotify
              </a>
              .
            </p>
            {donateHref ? (
              <a
                className={`${footerLinkClassName} ml-auto shrink-0`}
                href={donateHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                Donate
              </a>
            ) : null}
          </footer>
        </SpotifyPlayerProvider>
      </body>
    </html>
  )
}
