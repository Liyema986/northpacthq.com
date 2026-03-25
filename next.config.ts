import type { NextConfig } from "next";

/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * NEXT.JS CONFIGURATION â€” Production
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // Image optimization
  images: {
    unoptimized: false,
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "**.convex.cloud" },
    ],
  },
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: ["@clerk/nextjs", "convex", "@radix-ui/react-icons"],
  },
  
  transpilePackages: ["convex"],
  
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
  
  // Redirects
  async redirects() {
    return [
      { source: "/old-path", destination: "/new-path", permanent: true },
    ];
  },
};

export default nextConfig;
