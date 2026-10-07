// One-off: renders PWA icons from public/logo-mark.png on a white square,
// matching app/icon.tsx (logo ~78% of canvas height). Run: node scripts/generate-pwa-icons.mjs
import sharp from "sharp"

const LOGO = "public/logo-mark.png"
const OUT = "public/icons"

async function render(size, heightRatio, name) {
  const h = Math.round(size * heightRatio)
  const logo = await sharp(LOGO).resize({ height: h }).toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 3, background: "#ffffff" },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(`${OUT}/${name}`)
}

await render(192, 398 / 512, "icon-192.png")
await render(512, 398 / 512, "icon-512.png")
// Maskable: logo within the central safe zone (~62% of the canvas height).
await render(512, 0.62, "icon-maskable-512.png")
