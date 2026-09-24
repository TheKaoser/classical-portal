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
  async redirects() {
    return [
      { source: "/admin", destination: "/", permanent: false },
      { source: "/blog", destination: "/", permanent: false },
      { source: "/piece/:id", destination: "/", permanent: false },
      { source: "/genres/baroque-keyboard", destination: "/genres/keyboard", permanent: true },
      // Retired instrument genres, including names the classifier already treats
      // as that instrument. A request that already has ?filter= falls through
      // to the page, which keeps a Keyboard chip or selects the instrument.
      ...[
        ["piano", "piano"],
        ["pianos", "piano"],
        ["pianoforte", "piano"],
        ["pianofortes", "piano"],
        ["fortepiano", "piano"],
        ["fortepianos", "piano"],
        ["harpsichord", "harpsichord"],
        ["harpsichords", "harpsichord"],
        ["cembalo", "harpsichord"],
        ["cembalos", "harpsichord"],
        ["cembali", "harpsichord"],
        ["clavecin", "harpsichord"],
        ["clavecins", "harpsichord"],
        ["organ", "organ"],
        ["organs", "organ"],
        ["orgue", "organ"],
        ["orgues", "organ"],
      ].flatMap(([slug, filter]) => [
        {
          source: `/genres/${slug}`,
          destination: `/genres/keyboard?filter=${filter}`,
          permanent: true,
          missing: [{ type: "query", key: "filter" }],
        },
      ]),
    ]
  },
}

export default nextConfig
