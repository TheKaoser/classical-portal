import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { Newsreader, Inter } from "next/font/google"
import "./globals.css"
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

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const oauthConfigured = isSpotifyOAuthConfigured()

  return (
    <html lang="en">
      <body className={`${inter.variable} ${newsreader.variable} font-sans antialiased`}>
        <SpotifyPlayerProvider oauthConfigured={oauthConfigured}>
          <SiteHeader />
          <main className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6">{children}</main>
          <footer className="relative mx-auto max-w-4xl px-4 pb-16 pt-4 text-sm text-muted-foreground sm:px-6">
            Catalog from{" "}
            <a
              className="text-primary underline-offset-2 hover:text-primary-hover hover:underline"
              href="https://openopus.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Opus
            </a>
            . Recordings via{" "}
            <a
              className="text-primary underline-offset-2 hover:text-primary-hover hover:underline"
              href="https://spotify.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Spotify
            </a>
            .
          </footer>
        </SpotifyPlayerProvider>
      </body>
    </html>
  )
}
