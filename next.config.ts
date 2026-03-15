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
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.fbcdn.net', // Facebook CDN
      },
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com', // Instagram CDN
      },
      {
        protocol: 'https',
        hostname: 'scontent*.xx.fbcdn.net', // Facebook content
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com', // Product images
      },
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com https://vercel.live; img-src 'self' data: blob: https://*.supabase.co https://*.fbcdn.net https://*.cdninstagram.com https://images.unsplash.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://graph.facebook.com https://*.facebook.com https://*.sentry.io https://vercel.live; frame-src https://vercel.live;",
        },
      ],
    },
  ],
};

export default analyze(nextConfig);
