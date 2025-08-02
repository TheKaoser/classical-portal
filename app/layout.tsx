import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Structured Classical Music",
  description: "Explore classical music through structured periods, composers, and masterpieces",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 min-h-screen">
          <div className="container mx-auto px-4 py-8">
            {children}
          </div>
        </div>
        <Toaster />
      </body>
    </html>
  )
}
