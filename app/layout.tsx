import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { Newsreader } from "next/font/google"
import "./globals.css"
import { AppNavigationMarker } from "@/components/app-navigation-marker"
import { SiteHeader } from "@/components/site-header"
import { SpotifyPlayerProvider } from "@/components/spotify-player-provider"
import { isSpotifyOAuthConfigured } from "@/lib/spotify"
import { SHARE_IMAGE } from "@/lib/seo"
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "@/lib/site"

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
})

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim()

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
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
        className={`${newsreader.variable} flex min-h-dvh flex-col font-sans antialiased`}
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
                href="https://openopus.org/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Opus
              </a>
              . Recordings via{" "}
              <a
                className={footerLinkClassName}
                href="https://spotify.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Spotify
              </a>
              . Made with love by Rodrigo Alonso.
            </p>
            <div className="ml-auto flex shrink-0 items-baseline gap-x-6">
              <a
                className={footerLinkClassName}
                href="mailto:rodrigoalonso@rocketmail.com"
              >
                Contact
              </a>
              {donateHref ? (
                <a
                  className={footerLinkClassName}
                  href={donateHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Donate
                </a>
              ) : null}
            </div>
          </footer>
        </SpotifyPlayerProvider>
      </body>
    </html>
  )
}
