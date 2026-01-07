import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow images from any source (Supabase, etc.)
      },
    ],
  },
  // CSP headers removed temporarily to debug connection issues
};

export default nextConfig;
