import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Caveat, Anton, Bricolage_Grotesque } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Script from "next/script";
import PageTransition from "./components/PageTransition";
import EdgeDebug from "./components/EdgeDebug";
import EdgeTint from "./components/EdgeTint";


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
  // Deliberately IDENTICAL in shape to zuhayrcreative.org's viewport meta:
  //
  //     <meta name="viewport" content="width=device-width, initial-scale=1">
  //
  // That site renders exactly the way the client wants on their iPhone —
  // content painting behind the status bar and behind the floating URL pill,
  // no reserved strips — and it does nothing clever to earn it. Its whole
  // configuration is the two properties below. Ours carried three extras that
  // it does not have, and ours is the one Safari boxes in:
  //
  //   viewport-fit=cover          removed. It reads like the setting that
  //                               grants an edge-to-edge page; on this device
  //                               it measured 699 of 844px with all four
  //                               safe-area insets at 0, i.e. not applied.
  //                               The reference never sets it.
  //   maximum-scale / user-scalable
  //                               removed. Both were restating the browser
  //                               default (zoom allowed), so dropping them
  //                               loses no accessibility.
  //   color-scheme: dark          removed for the same reason: the reference
  //                               does not declare it. Deliberately NOT
  //                               re-added as the CSS `color-scheme` property
  //                               either — that is the same signal by another
  //                               route, and would defeat the comparison. Add
  //                               it back in globals.css once the cause is
  //                               known, if dark UA form controls are wanted.
  //
  // If this restores the look, the cause was one of those three and they stay
  // out. If it does not, the difference is elsewhere and this is still the
  // honest baseline to debug from — matching the known-good reference.
  width: "device-width",
  initialScale: 1,
  // REQUIRED for the page to paint behind Safari's chrome, and this time on a
  // clean reading of the evidence.
  //
  // Without it the page is laid out INSIDE the safe area by definition, and
  // Safari fills the status-bar strip and the toolbar strip itself with one
  // flat opaque colour. No page can make that translucent. That is the state
  // PR #40 shipped, and the client confirmed the bars survived it — including
  // the tell that settles what those strips are: Safari's pull-to-refresh
  // spinner animates INSIDE the top bar, so the bar is browser chrome, not
  // page.
  //
  // #40 removed cover to match zuhayrcreative.org. The negative result is
  // informative: the reference does not paint behind the chrome either. Its
  // strips are simply the same flat maroon as its page, so they are invisible.
  // That illusion is unavailable here, because the page behind them is an
  // animated scene that is frequently pale.
  //
  // Every earlier "cover does not work" measurement is void: they were taken
  // while EdgeDebug rewrote the viewport meta at runtime for EVERY visitor
  // (ungated until 17266e6), and a runtime rewrite does not re-apply
  // viewport-fit — Safari resolves it at parse time. Cover has therefore never
  // actually been observed on this site in a clean state.
  //
  // THE COST: env(safe-area-inset-*) goes non-zero, so anything anchored to a
  // screen edge must clear the insets. The --safe-* tokens in globals.css
  // exist for exactly this, and the navbar, hero CTA and footer already use
  // them.
  viewportFit: "cover",
  // Tints the browser UI on engines that still honour it (Safari 18 and
  // earlier, Chrome/Edge on Android, installed web apps). The reference sets
  // this too. Hold it EQUAL to --page-edge in globals.css.
  // Brand maroon, matching zuhayrcreative.org's theme-color exactly.
  //
  // Safari tints the strip above the page by sampling the page's topmost
  // pixels, and falls back to this when it cannot read them. Ours are the
  // Unicorn WebGL canvas, built without preserveDrawingBuffer, so every
  // readback of it — Safari's sampler included — returns pure BLACK. That is
  // why the strip is black regardless of layout, and why it never blends the
  // way the reference site's does: the reference's topmost pixels are a solid
  // #38000E header bar, so its strip is maroon-on-maroon and reads as gone.
  //
  // This does not make the strip disappear. It changes it from near-black to
  // the brand maroon the reference uses, which sits far closer to the scene
  // than #1a070d did. A real cure needs the page's top pixels to be readable
  // DOM rather than canvas.
  themeColor: "#470015",
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
        {/* ── iOS edge strips: make the page's outermost pixels READABLE ──
            iOS Safari paints opaque strips above and below the page and tints
            them by LIVE-SAMPLING the page's outermost rendered pixels. That
            was settled on the device by the stripes test (25e9072): with
            colour bands on the page edges Safari painted its strips the exact
            green of the outermost band, while theme-color and body background
            were both #1a070d and neither was consulted.

            Our outermost pixels are the Unicorn WebGL canvas, and the SDK
            creates its context with preserveDrawingBuffer:false (hard-coded,
            v2.2.6). With that off the drawing buffer is undefined once the
            frame has been composited, so every readback — Safari's sampler
            included — returns pure BLACK. Hence strips that stay black-ish at
            every scroll position and never blend, while zuhayrcreative.org,
            whose edges are plain DOM maroon, samples fine.

            This forces preserveDrawingBuffer ON for every WebGL context on the
            page, so the sampler reads the scene's ACTUAL colours and the
            strips track it live. It patches getContext during parse, which is
            the only workable moment: the SDK builds its canvas about a second
            later, from a CDN script, and the flag can only be set at context
            creation — it cannot be changed afterwards.

            Costs a little memory/bandwidth (the buffer is kept after
            compositing) — acceptable for a background scene, and the only way
            to make these pixels readable at all without dropping WebGL.

            Escape hatches for on-device A/B, both harmless to real visitors:
              ?nopdb=1  skip this patch (canvas unreadable again)
              ?nobg=1   hide every Unicorn scene site-wide (globals.css), to
                        confirm whether the canvases are involved at all */}
        <script
          dangerouslySetInnerHTML={{
            __html: [
              "try{",
              "var q=location.search;",
              // A data ATTRIBUTE, not a class: <html>'s className is a prop
              // React owns, so a class added here is wiped at hydration.
              "if(q.indexOf('nobg')>-1){document.documentElement.setAttribute('data-nobg','1');}",
              "if(q.indexOf('nopdb')<0){",
              "var g=HTMLCanvasElement.prototype.getContext;",
              "HTMLCanvasElement.prototype.getContext=function(t,a){",
              "if(t==='webgl'||t==='webgl2'||t==='experimental-webgl'){",
              "a=Object.assign({},a||{},{preserveDrawingBuffer:true});}",
              "return g.call(this,t,a);};",
              "}",
              "}catch(e){}",
            ].join(""),
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
        {/* Keeps Safari's status-bar and toolbar bands the colour of the scene
            behind them, sampled live — see EdgeTint.tsx. Without it those
            bands take --page-edge (#1a070d, near-black) while the scene over
            it is far lighter, which is the framing bars the client reported. */}
        <EdgeTint />
        {/* Inert unless the URL carries ?edges=1 — see EdgeDebug.tsx. Lives in
            the root layout so the flag works on every route. */}
        <EdgeDebug />
      </body>
    </html>
  );
}
