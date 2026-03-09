import type { NextConfig } from "next";

const SITE_URL = "https://steadystake.org";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async redirects() {
    return [
      // Prefer non-www: redirect www.steadystake.org → steadystake.org (fixes GSC "Alternative page with proper canonical tag")
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.steadystake.org" }],
        destination: `${SITE_URL}/:path*`,
        permanent: true,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
