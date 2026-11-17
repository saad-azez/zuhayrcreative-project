import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Vercel preview deployments inject the Vercel Toolbar (comments, feedback)
// from vercel.live; production never does, so it is only allowed there.
const isPreview = process.env.VERCEL_ENV === "preview";
const vercelLive = isPreview ? " https://vercel.live" : "";

/**
 * Content-Security-Policy: the list of places this site may load code and
 * media from. Anything else — an injected <script src="evil">, a hijacked
 * <base>, a hostile <form action>, the site framed inside another site to
 * trick clicks — is refused by the browser.
 *
 * Every origin below is one the site really uses (recorded from a full crawl
 * of a production build, 17 Nov 2026). Adding a new third-party script, font,
 * image host or API means adding its origin here, or the browser will block
 * it — the console says "Refused to load … Content Security Policy".
 *
 * 'unsafe-inline' for scripts and styles is what keeps pages statically
 * generated and served from Vercel's cache: Next's inline bootstrap scripts
 * would otherwise need a per-request nonce, which forces every page to render
 * on demand (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
 * The site has no logins, cookies or user-generated content to steal, so the
 * remaining directives carry the weight.
 */
const CSP = [
  "default-src 'self'",
  // jsdelivr: the Unicorn Studio SDK (app/lib/unicorn.ts).
  // blob:: the atelier/shop scenes' workers importScripts code from blob: URLs,
  // which only script already running on the page can create.
  // 'unsafe-eval': those workers run the Basis/KTX2 texture transcoder
  // (public/{atelier,shop}/basis/basis_transcoder.js), a WebAssembly build
  // whose Emscripten glue calls new Function() — without it the desktop 3D
  // scenes lose their textures. It adds little risk on top of 'unsafe-inline'
  // (anything that could inject script could already run it). Drop both once
  // the transcoder is rebuilt with -sDYNAMIC_EXECUTION=0.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net${vercelLive}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com https://picsum.photos https://fastly.picsum.photos https://*.giphy.com https://assets.unicorn.studio" + vercelLive + (isPreview ? " https://vercel.com" : ""),
  "font-src 'self' data: https://cdn.jsdelivr.net https://assets.unicorn.studio" + vercelLive,
  // jsdelivr: troika text's unicode font fallback; githack: drei HDRI presets.
  // blob:/data:: GLTFLoader fetches a model's embedded textures from them.
  "connect-src 'self' blob: data: https://cdn.jsdelivr.net https://assets.unicorn.studio https://raw.githack.com" + vercelLive + (isPreview ? " wss://ws-us3.pusher.com" : ""),
  "media-src 'self' blob: data: https://assets.unicorn.studio",
  // Three.js / troika / Unicorn spin up workers from blob: URLs.
  "worker-src 'self' blob:",
  "child-src 'self' blob:" + vercelLive,
  "frame-src 'self'" + vercelLive,
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // HTTPS only, for two years, subdomains included, eligible for browsers'
  // built-in preload list.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy twin of frame-ancestors 'none' for old browsers: never framed.
  { key: "X-Frame-Options", value: "DENY" },
  // The old XSS auditor is gone from browsers and could itself be abused;
  // "0" is the current recommendation (CSP does this job now).
  { key: "X-XSS-Protection", value: "0" },
  // Other sites see only "zuhayrcreative.org", never the page path.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Browser features the site never uses are switched off for it and for
  // anything embedded in it. Motion sensors stay available to the site
  // itself for the touch/tilt 3D scenes.
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "serial=()",
      "hid=()",
      "bluetooth=()",
      "midi=()",
      "magnetometer=()",
      "display-capture=()",
      "browsing-topics=()",
      "accelerometer=(self)",
      "gyroscope=(self)",
      "fullscreen=(self)",
    ].join(", "),
  },
  // A page this site opens in a new tab can't reach back into it
  // (window.opener), and vice versa.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

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
    // Only the exact remote photos the site renders through next/image
    // (Testimonials, BrandArchitecture). A whole-host pattern would let anyone
    // use this site's optimizer to resize any Unsplash photo, spending the
    // Vercel plan's image-optimization allowance until the site's own images
    // fail. Adding a remote photo to an <Image> means adding its path here.
    // (Picsum images are plain <img> tags and never pass through the optimizer.)
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-1494790108377-be9c29b29330" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-1500648767791-00dcc994a43e" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-1503342217505-b0a15ec3261c" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-1506794778202-cad84cf45f1d" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-1517841905240-472988babdf9" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-1535713875002-d1d0cf377fde" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-1542751371-adc38448a05e" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-1544005313-94ddf0286df2" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-1614728263952-84ea256f9679" },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Security headers — see SECURITY_HEADERS above.
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  // Don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,

  // Compress responses
  compress: true,

  // Experimental features
  experimental: {
    optimizePackageImports: ["gsap", "@gsap/react"],
  },
};

export default nextConfig;
