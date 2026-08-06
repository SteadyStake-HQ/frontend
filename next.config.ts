import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NETWORK_TYPE picks the mainnet or testnet network list, and the list is built in the browser, so
  // the value has to reach the client bundle. Copying it here means .env can set the short name
  // (NETWORK_TYPE=mainnet) rather than the NEXT_PUBLIC_ form; an explicitly set
  // NEXT_PUBLIC_NETWORK_TYPE still wins.
  env: {
    NEXT_PUBLIC_NETWORK_TYPE:
      process.env.NEXT_PUBLIC_NETWORK_TYPE ?? process.env.NETWORK_TYPE ?? "",
  },
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
};

export default nextConfig;
