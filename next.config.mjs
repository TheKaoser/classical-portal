/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: "/admin", destination: "/", permanent: false },
      { source: "/blog", destination: "/", permanent: false },
      { source: "/piece/:id", destination: "/", permanent: false },
      { source: "/genres/baroque-keyboard", destination: "/genres/keyboard", permanent: true },
      // Retired instrument genres. A request that already has ?filter= falls
      // through to the page, which keeps a Keyboard form chip and drops an
      // instrument chip.
      ...[
        "piano",
        "pianos",
        "pianoforte",
        "pianofortes",
        "fortepiano",
        "fortepianos",
        "harpsichord",
        "harpsichords",
        "cembalo",
        "cembalos",
        "cembali",
        "clavecin",
        "clavecins",
        "organ",
        "organs",
        "orgue",
        "orgues",
      ].map((slug) => ({
        source: `/genres/${slug}`,
        destination: "/genres/keyboard",
        permanent: true,
        missing: [{ type: "query", key: "filter" }],
      })),
    ]
  },
}

export default nextConfig
