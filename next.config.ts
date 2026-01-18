import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

const analyze = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

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

export default analyze(nextConfig);
