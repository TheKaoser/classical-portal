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
    ]
  },
}

export default nextConfig
