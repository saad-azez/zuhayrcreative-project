import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Where a build is written. `.next` by default, as always.
   *
   * It is settable because `next dev` and `next build` both live in `.next`,
   * and a production build made while the dev server is running pulls the
   * ground out from under it: the dev server then throws ENOENT for
   * `.next/dev/...build-manifest.json`, cannot find
   * `[turbopack]_runtime.js`, and serves 500s until it is restarted and its
   * directory is cleared. That happened here, repeatedly, while building the
   * site for testing on a phone.
   *
   *   NEXT_DIST_DIR=.next-build pnpm build
   *   NEXT_DIST_DIR=.next-build pnpm exec next start -p 3101
   *
   * gives the phone build a directory of its own and leaves `.next` to the
   * dev server, so the two can run side by side.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Enable strict mode for better error handling
  reactStrictMode: true,

  // Optimize images
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // Compress responses
  compress: true,

  // Experimental features
  experimental: {
    optimizePackageImports: ["gsap", "@gsap/react"],
  },
};

export default nextConfig;
