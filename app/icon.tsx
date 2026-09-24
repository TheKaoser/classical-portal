import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

export const runtime = "nodejs"
export const size = { width: 512, height: 512 }
export const contentType = "image/png"

export default async function Icon() {
  const logo = await readFile(join(process.cwd(), "public/logo-mark.png"), "base64")

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <img src={`data:image/png;base64,${logo}`} width={250} height={398} alt="" />
      </div>
    ),
    { ...size }
  )
}
