import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Newsreader, Inter } from "next/font/google"
import "./globals.css"
import { SiteHeader } from "@/components/site-header"

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

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${newsreader.variable} font-sans antialiased`}>
        <div
          aria-hidden
          className="pointer-events-none fixed inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-navy/20 via-blue-mid/10 to-transparent sm:w-36 lg:w-48"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-blue-bright/15 via-blue-mid/10 to-transparent sm:w-36 lg:w-48"
        />
        <SiteHeader />
        <main className="relative mx-auto max-w-4xl px-4 py-8">{children}</main>
        <footer className="relative mx-auto max-w-4xl px-4 pb-10 text-xs text-muted-foreground">
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
      </body>
    </html>
  )
}
