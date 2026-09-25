import { NextResponse, type NextRequest } from "next/server"
import { canonicalRedirectTarget } from "@/lib/canonical-host"

export function middleware(request: NextRequest) {
  const target = canonicalRedirectTarget(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    request.nextUrl.pathname,
    request.nextUrl.search
  )
  if (!target) return NextResponse.next()
  return NextResponse.redirect(target, 308)
}

export const config = {
  // API routes stay on the host that received them.
  matcher: ["/((?!api/|_next/static|_next/image).*)"],
}
