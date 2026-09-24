import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

export const runtime = "nodejs"
export const alt = "Classical Portal. Explore classical music your way."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/logo-mark.png"), "base64")

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            width: "420px",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#e8f0fe",
          }}
        >
          <img src={`data:image/png;base64,${logo}`} width={210} height={334} alt="" />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 72px",
            width: "780px",
          }}
        >
          <div
            style={{
              fontSize: 68,
              fontWeight: 600,
              color: "#202124",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Classical Portal
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 32,
              lineHeight: 1.35,
              color: "#5f6368",
            }}
          >
            Explore classical music your way.
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
