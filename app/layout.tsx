import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Caveat, Anton, Bricolage_Grotesque, Doto } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import PageTransition from "./components/PageTransition";
// First client module in the layout chunk on purpose — it installs the WebGL
// context manager at import time, before any scene or library probes for one.
import WebglBudget from "./components/WebglBudget";
import PullToRefreshGuard from "./components/PullToRefreshGuard";
import { GPU_PROBE } from "@/app/lib/gpuProbe";
import { SITE_URL, SITE_NAME, DEFAULT_TITLE, DEFAULT_DESCRIPTION, baseOpenGraph, SHARE_IMAGE } from "@/app/lib/seo";
import { COMPANY, SERVICES } from "@/app/lib/company";


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
  // Not the display face while Doto is on trial (below): still registered, so
  // going back is the one line in globals.css, but no longer in every route's
  // critical path for a face nothing draws with. Take this out when it is.
  preload: false,
});

/**
 * Doto — on trial as the display face in Façade's place (client, 12 Oct:
 * readers found the headings "a little hard to read at times"; "apply it,
 * let's see if it's more legible"). Óliver Lalan's dot-matrix face, OFL 1.1,
 * from Google Fonts: next/font downloads it at build time and serves it from
 * this site, as it does Geist — nothing is requested from Google by a reader.
 *
 * Wired where Façade was, at the token (--font-display in globals.css), so
 * every heading follows and the switch back is that one line. Departure
 * Mono, the pixel text face, is untouched.
 *
 * It is a variable font, 100–900. Façade had one weight, so headings that
 * still say font-weight 700–800 (written for Bricolage / Anton before it)
 * were drawn at 400 with synthesis off; under Doto they get a real bold.
 * Its second axis, ROND (square dots to round), is left at the default and
 * not downloaded.
 */
const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
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
/**
 * Fusion Pixel 12px (TakWolf, OFL 1.1; licence in app/fonts/fusion-pixel) —
 * the hero lens's Chinese, Japanese and Korean, in a pixel face like the
 * English it stands in for (Departure Mono on line 2, Doto on line 3). One
 * file per language, each that language's own glyph forms (Hong Kong for
 * Chinese), each cut to exactly the characters HeroBanner's I18N uses (~1.5 KB).
 * A character added there must be added here too, or it falls back to Noto.
 * The command is in app/fonts/fusion-pixel/README.md.
 */
const pixelZh = localFont({ src: "./fonts/fusion-pixel/FusionPixel12-zh-subset.woff2", variable: "--font-pixel-zh", display: "swap", fallback: ["Hiragino Sans", "Apple SD Gothic Neo", "sans-serif"] });
const pixelJa = localFont({ src: "./fonts/fusion-pixel/FusionPixel12-ja-subset.woff2", variable: "--font-pixel-ja", display: "swap", fallback: ["Hiragino Sans", "Apple SD Gothic Neo", "sans-serif"] });
const pixelKo = localFont({ src: "./fonts/fusion-pixel/FusionPixel12-ko-subset.woff2", variable: "--font-pixel-ko", display: "swap", fallback: ["Hiragino Sans", "Apple SD Gothic Neo", "sans-serif"] });

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | Zuhayr Creative",
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "creative agency Hong Kong",
    "design agency Hong Kong",
    "brand design",
    "experience design",
    "web design and development",
    "communication design",
    "content production",
    "AI integration",
    "generative engine optimization",
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
    ...baseOpenGraph,
    url: "/",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [SHARE_IMAGE],
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
  // Search Console ownership is verified by a DNS TXT record on the domain,
  // so no verification <meta> is needed here.
  // The homepage's canonical. Pages with their own (app/lib/seo.ts
  // pageMetadata) replace it; see the note there.
  alternates: {
    canonical: "/",
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
  // Structured data for search engines and AI answer engines, built from
  // app/lib/company.ts so it says exactly what the About page and llms.txt
  // say. Add `sameAs` (the business's real social profile URLs) once they
  // are confirmed: guessed links do more harm than none.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        legalName: COMPANY.legalName,
        url: SITE_URL,
        logo: `${SITE_URL}/logo-mark.png`,
        email: COMPANY.email,
        description: COMPANY.summary,
        address: {
          "@type": "PostalAddress",
          streetAddress: COMPANY.address.street,
          addressLocality: COMPANY.city,
          addressRegion: COMPANY.address.region,
          addressCountry: COMPANY.countryCode,
        },
        areaServed: "Worldwide",
        parentOrganization: {
          "@type": "Organization",
          name: COMPANY.parent.name,
          url: COMPANY.parent.url,
        },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          email: COMPANY.email,
          url: `${SITE_URL}/contact`,
          availableLanguage: ["English"],
        },
        knowsAbout: SERVICES.flatMap((s) => [s.name, ...s.items]),
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Services",
          itemListElement: SERVICES.map((s) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: s.name,
              description: `${s.blurb} Includes ${s.items.join(", ")}.`,
            },
          })),
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} ${anton.variable} ${bricolageGrotesque.variable} ${facade.variable} ${doto.variable} ${notoSansKR.variable} ${pixelZh.variable} ${pixelJa.variable} ${pixelKo.variable} ${departureMono.variable} h-full antialiased`}
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
        {/* Is there a GPU to draw the scenes with, and — only if there is —
            the hints for what they will need. See lib/gpuProbe.ts: asking in
            the head is what keeps a browser that cannot run the scenes from
            fetching a megabyte for them, without costing the machines that
            can the head start they need. */}
        <script dangerouslySetInnerHTML={{ __html: GPU_PROBE }} />
        {/* Safari on iPhone and iPad draws the page under a see-through
            toolbar, so its visible screen runs past 100lvh; full-screen
            sections add --toolbar-tail there (globals.css). Every other
            browser (Chrome, Firefox, Edge on iOS; everything on Android) has a
            solid toolbar, and 100lvh is its full screen. Set before paint, as
            an attribute React does not own, so hydration leaves it alone. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var u=navigator.userAgent;if((/iP(hone|od|ad)/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1))&&/Safari\\//.test(u)&&!/CriOS|FxiOS|EdgiOS|OPiOS|OPT\\/|GSA\\/|YaBrowser|DuckDuckGo/.test(u))document.documentElement.setAttribute('data-ios-safari','')}catch(e){}",
          }}
        />
        {/* The signature the loading curtain draws (SignatureLogo.tsx).
            It gates the whole intro — the greetings and the curtain both wait
            for the pen to stop — and it is not requested until lottie-web's
            own chunk has landed, so without this hint the draw does not even
            begin until two round trips have gone by. Unlike the scenes above
            it is wanted on every device, GPU or not. */}
        <link
          rel="preload"
          as="fetch"
          href="/zuhayr-logo.json"
          type="application/json"
          // Without this the preload is fetched in no-cors mode with
          // credentials, `fetch()` asks in cors mode with same-origin
          // credentials, the two do not match and the browser throws the
          // preload away and asks again.
          crossOrigin="anonymous"
        />
        {/* A plain <script>, not next/script: next/script put this only in
            the hydration payload, so crawlers that do not run JavaScript
            (most AI answer bots) never saw it. `<` is escaped, as the Next
            JSON-LD guide advises. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
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
        {/* Phones: no browser pull-to-refresh from the top of the page. */}
        <PullToRefreshGuard />
      </body>
    </html>
  );
}
