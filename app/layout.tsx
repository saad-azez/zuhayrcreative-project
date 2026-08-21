import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Caveat, Anton, Bricolage_Grotesque } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Script from "next/script";
import PageTransition from "./components/PageTransition";
import EdgeDebug from "./components/EdgeDebug";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage-grotesque",
  subsets: ["latin"],
  weight: ["500", "800"], // 500: small labels/eyebrows, 800: massive display
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
  src: [
    {
      path: "./fonts/departure-mono/DepartureMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/departure-mono/DepartureMono-Regular.woff",
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
  // NO viewport-fit=cover, deliberately.
  //
  // It reads like the setting that gives you an edge-to-edge page. Without it
  // the page lays out inside the safe area and Safari's own chrome stays
  // translucent over the scrolling content, which is what actually reads as
  // "the site runs under the clock". zuhayrcreative.org's shipped build does
  // exactly this — its viewport is a bare width=device-width, initial-scale=1
  // — and it is the behaviour the client is asking for.
  //
  // env(safe-area-inset-*) therefore returns 0, which is correct rather than a
  // loss: the layout viewport is already inset, so the fixed chrome positioned
  // with those vars (navbar, close buttons) still sits where it should.
  //
  // The site is dark — declaring it keeps UA chrome (form controls, scroll
  // areas, toolbar derivation) rendered for a dark page instead of a light
  // default.
  colorScheme: "dark",
  // iOS/iPadOS 26 IGNORES this. Safari 26 dropped support for the theme-color
  // meta tag outright and now tints the strips above and below the page from
  // the <body> background-color instead — so the rule that actually removes
  // those bars is `background-color: var(--page-edge)` on body in globals.css,
  // not this line.
  //
  // Kept for every engine that does still honour it: Safari 18 and earlier,
  // Chrome and Edge on Android, and installed web apps. Hold it EQUAL to
  // --page-edge, because a mismatch is precisely how you end up with a visible
  // bar on one OS version and a clean edge on the next.
  themeColor: "#1a070d",
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
        <PageTransition>{children}</PageTransition>
        {/* Inert unless the URL carries ?edges=1 — see EdgeDebug.tsx. Lives in
            the root layout so the flag works on every route. */}
        <EdgeDebug />
      </body>
    </html>
  );
}
