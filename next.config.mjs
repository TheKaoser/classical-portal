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
      { source: "/genres/keyboard", destination: "/genres/piano", permanent: true },
    ]
  },
}

export default nextConfig
