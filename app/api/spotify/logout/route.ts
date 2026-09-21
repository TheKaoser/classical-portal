import { NextResponse } from "next/server"
import { clearAuthCookies } from "@/lib/spotify-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const response = NextResponse.json({ connected: false })
  clearAuthCookies(response)
  return response
}
