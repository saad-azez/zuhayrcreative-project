import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Caveat, Anton, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import Script from "next/script";

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
  weight: ["800"], // Extra bold for massive display typography
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
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
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
      className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} ${anton.variable} ${bricolageGrotesque.variable} h-full antialiased`}
    >
      <head>
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col relative">{children}</body>
    </html>
  );
}
