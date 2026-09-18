import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Caveat, Anton, Bricolage_Grotesque } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Script from "next/script";
import PageTransition from "./components/PageTransition";
// First client module in the layout chunk on purpose — it installs the WebGL
// context manager at import time, before any scene or library probes for one.
import WebglBudget from "./components/WebglBudget";
import MobileDebugPanel from "./components/debug/MobileDebugPanel";


// ── Preloading ──
// next/font preloads every family by default, so all ten files below were in
// the first-load critical path of every route — on a slow phone about a
// second of it. The four marked `preload: false` are wired to tokens
// (--font-caveat, --font-anton, --font-tomato) that no live component uses;
// they stay registered, and the browser fetches one only if a glyph ever
// asks for it. The faces the first screen renders with — Façade, Departure
// Mono, the Noto reveal subset — keep their preloads.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  preload: false,
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage-grotesque",
  subsets: ["latin"],
  weight: ["500", "800"], // 500: small labels/eyebrows, 800: massive display
  preload: false,
});

/**
 * Façade — self-hosted display face (Éléonore Fines / Velvetyne, OFL 1.1).
 * Files and licence live in app/fonts/facade; see the README there.
 *
 * Registered as ONE family from the "Sud" cut. The four cuts shipped with the
 * font are distinct designs rather than weights of a family, so bundling them
 * under a single `localFont` would invite the browser to substitute or
 * synthesise between them. The other three are in the repo and switching is a
 * one-line change to `src`.
 *
 * `display: "swap"` so text is never invisible while a display face loads, and
 * a plain sans fallback because Façade's metrics are far from any system font —
 * there is no sensible metric override to hand it.
 */
const facade = localFont({
  src: "./fonts/facade/Facade-Sud.woff",
  variable: "--font-facade",
  display: "swap",
  weight: "400",
  style: "normal",
  fallback: ["Impact", "Haettenschweiler", "sans-serif"],
});

/**
 * Departure Mono — the site's text face (Helena Zhang, OFL 1.1; files and
 * licence in app/fonts/departure-mono).
 *
 * Everything that is not a Façade display heading or an interaction hint runs
 * through this: body copy, labels, eyebrows, numbers, nav and footer. It is
 * wired at the TOKEN level (--font-sans and --font-mono in globals.css, plus the
 * body default) rather than component by component, so the switch is one place.
 *
 * It ships ONE weight. Everything that carried font-weight 600–800 would be
 * synthesised into a smeared faux bold, so weight synthesis is turned off for it
 * in globals.css — same treatment Façade already gets.
 */
const departureMono = localFont({
  // woff2 only. The .woff twin is still in the repo, but listing it here made
  // next/font PRELOAD both files on every route — 24KB the browser never used,
  // since every browser that runs this site reads woff2.
  src: [
    {
      path: "./fonts/departure-mono/DepartureMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-departure",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

/**
 * Noto Sans KR, subsetted — the font for the hero's language-lens reveals
 * (Adobe / Google, OFL 1.1; see app/fonts/noto-sans-kr/README.md).
 *
 * It exists so all four reveal languages share ONE typeface. No system font
 * covers Han + kana + Hangul: on Windows the reveals were landing on Yu Gothic
 * for Chinese and Japanese (a Japanese face drawing Traditional Chinese) and
 * Malgun Gothic for Korean, so the lens changed typeface depending on which
 * language it showed. Noto Sans KR covers all three scripts plus the Latin the
 * Spanish reveal needs.
 *
 * The files are cut down to exactly the 64 characters the reveal strings use,
 * which is what keeps a CJK face down to ~40KB per weight. EDITING THE I18N
 * TABLE IN HeroBanner.tsx THEREFORE MEANS REGENERATING THEM — the README has
 * the command. A new character would otherwise silently fall back to a system
 * font, which is the exact problem this font was added to solve.
 *
 * The old per-platform CJK stack is kept as `fallback`, so a failed font load
 * degrades to the previous behaviour rather than to tofu.
 */
const notoSansKR = localFont({
  src: [
    {
      path: "./fonts/noto-sans-kr/NotoSansKR-subset-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/noto-sans-kr/NotoSansKR-subset-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-reveal",
  display: "swap",
  fallback: [
    "Hiragino Sans",
    "Yu Gothic",
    "Meiryo",
    "Malgun Gothic",
    "Apple SD Gothic Neo",
    "Microsoft JhengHei",
    "Noto Sans CJK",
    "sans-serif",
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zuhayrcreative.org"),
  title: {
    default: "Zuhayr Creative | Global Digital Marketing & AI Solutions Agency",
    template: "%s | Zuhayr Creative",
  },
  description:
    "Elite digital marketing agency specializing in AI automation, web design, SEO optimization, and intelligent workflow systems. Transform your business with data-driven strategies and cutting-edge technology.",
  keywords: [
    "digital marketing agency",
    "AI automation",
    "web design",
    "SEO optimization",
    "AI consulting",
    "social media marketing",
    "web development",
    "marketing strategy",
    "business automation",
    "AI solutions",
  ],
  authors: [{ name: "Zuhayr Creative" }],
  creator: "Zuhayr Creative",
  publisher: "Zuhayr Creative",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://zuhayrcreative.org",
    siteName: "Zuhayr Creative",
    title: "Zuhayr Creative | Global Digital Marketing & AI Solutions Agency",
    description:
      "Elite digital marketing agency specializing in AI automation, web design, SEO optimization, and intelligent workflow systems. Transform your business with data-driven strategies.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Zuhayr Creative - Digital Marketing & AI Solutions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zuhayr Creative | Global Digital Marketing & AI Solutions Agency",
    description:
      "Elite digital marketing agency specializing in AI automation, web design, SEO optimization, and intelligent workflow systems.",
    images: ["/logo.png"],
    creator: "@zuhayrcreative",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
    yandex: "your-yandex-verification-code",
  },
  alternates: {
    canonical: "https://zuhayrcreative.org",
  },
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  // Extend the page edge-to-edge behind the status bar and home indicator on
  // mobile (notched devices). Without this, iOS confines the page to the safe
  // area and the fixed background only fills that — leaving the dark page
  // background showing as bars top and bottom. The `env(safe-area-inset-*)`
  // vars (see globals.css) only return real values once this is set, so fixed
  // chrome (the navbar) uses them to stay clear of the status bar / notch.
  viewportFit: "cover",
  // The site is dark — declaring it keeps UA chrome (form controls, scroll
  // areas, toolbar derivation) rendered for a dark page instead of a light
  // default.
  colorScheme: "dark",
  // Tint the browser UI (Safari toolbar on macOS/iOS, Chrome on Android, PWA
  // status bar) with the brand maroon. Explicit light AND dark entries:
  // some browsers ignore a single unqualified theme-color when the device
  // is in dark mode, which dropped the tint back to colourless.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#470015" },
    { media: "(prefers-color-scheme: dark)", color: "#470015" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Zuhayr Creative",
    url: "https://zuhayrcreative.org",
    logo: "https://zuhayrcreative.org/logo.png",
    description:
      "Elite digital marketing agency specializing in AI automation, web design, SEO optimization, and intelligent workflow systems.",
    address: {
      "@type": "PostalAddress",
      addressCountry: "US",
    },
    sameAs: [
      "https://twitter.com/zuhayrcreative",
      "https://linkedin.com/company/zuhayrcreative",
      "https://instagram.com/zuhayrcreative",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Service",
      availableLanguage: ["English"],
    },
    service: [
      {
        "@type": "Service",
        name: "Web Design",
        description:
          "Bespoke digital interfaces engineered for conversion and crafted for lasting impressions.",
      },
      {
        "@type": "Service",
        name: "AI Automation",
        description:
          "Intelligent workflow systems that eliminate friction and multiply operational capacity.",
      },
      {
        "@type": "Service",
        name: "SEO Optimization",
        description:
          "Technical and content-driven SEO strategies designed to increase visibility and sustainable traffic.",
      },
      {
        "@type": "Service",
        name: "AI Consulting",
        description:
          "Strategic AI advisory that maps intelligent solutions directly to your business objectives.",
      },
      {
        "@type": "Service",
        name: "Web Development",
        description:
          "Production-grade engineering with a focus on performance, scalability, and clean architecture.",
      },
      {
        "@type": "Service",
        name: "Social Media Marketing",
        description:
          "Strategic content ecosystems that build communities and drive authentic engagement.",
      },
      {
        "@type": "Service",
        name: "Marketing Strategy",
        description:
          "Data-informed campaigns that connect brand narratives with high-intent audiences.",
      },
    ],
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} ${anton.variable} ${bricolageGrotesque.variable} ${facade.variable} ${notoSansKR.variable} ${departureMono.variable} h-full antialiased`}
    >
      <head>
        {/* Disable the browser's scroll restoration so a reload always starts
            at the top (hero section) instead of the previous scroll position.
            Runs during parse, before the browser would restore. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if('scrollRestoration' in history){history.scrollRestoration='manual';}}catch(e){}",
          }}
        />
        {/* Phone debug log, part one: catches errors that happen before the
            app's JavaScript has loaded, for the debug panel to show later
            (see app/lib/mobileDebug.ts). Does nothing unless debugging is
            on — phones, or ?debug=1. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var m=/[?&]debug=([01])/.exec(location.search);if(m)localStorage.setItem('mdbg',m[1]);var f=localStorage.getItem('mdbg');var ua=navigator.userAgent;var ph=/Android|iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);if(f==='1'||(f!=='0'&&ph)){var E=window.__mdbgEarly=[];var P=function(k,msg,st){if(!window.__mdbgLive)E.push({t:performance.now(),k:k,m:String(msg),s:st})};addEventListener('error',function(e){var t=e.target;if(t&&t!==window&&t.tagName){P('resource failed',t.tagName+' '+(t.currentSrc||t.src||t.href||''))}else{P('error',e.message+' @'+e.filename+':'+e.lineno,e.error&&e.error.stack)}},true);addEventListener('unhandledrejection',function(e){var r=e.reason;P('unhandled rejection',r&&r.message||r,r&&r.stack)})}}catch(e){}",
          }}
        />
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) inject
          attributes like `cz-shortcut-listen` on <body> before hydration. */}
      <body
        className="min-h-full flex flex-col relative"
        suppressHydrationWarning
      >
        {/* Block-reveal page transition. It lives HERE rather than in
            app/template.tsx because the template re-mounts on every navigation
            — it would tear down the block grid mid-transition. The root layout
            persists across client-side navigations, so one grid covers the
            outgoing page and uncovers the incoming one, on every route. */}
        <WebglBudget />
        <PageTransition>{children}</PageTransition>
        {/* The on-screen debug panel for phones (renders nothing elsewhere). */}
        <MobileDebugPanel />
      </body>
    </html>
  );
}
