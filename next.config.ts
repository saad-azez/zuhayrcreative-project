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

  /**
   * Let a phone on the local network use the DEV server.
   *
   * Next blocks cross-origin requests to dev-only resources by default, and a
   * phone opening http://192.168.1.7:3000 is a different origin from the
   * `localhost` the server started on. The page's HTML still arrives, so it
   * LOOKS like it loads — but its scripts are refused and the hot-reload
   * socket's handshake fails, so the page never hydrates (no animations, no
   * interaction) and no edit ever reaches the phone. Dev-only: production
   * builds ignore this.
   */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],

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
