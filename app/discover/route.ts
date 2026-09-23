import { NextResponse } from "next/server"
import { discoveryWorkHref } from "@/lib/discovery"

export const dynamic = "force-dynamic"

/** Same work for every visitor on a given UTC day. */
export function GET(request: Request) {
  const href = discoveryWorkHref(new Date()) ?? "/"
  return NextResponse.redirect(new URL(href, request.url))
}
