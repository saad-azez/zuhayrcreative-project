import type { Metadata } from "next";

/**
 * Search metadata shared by every page.
 *
 * SITE_URL is the address the site is actually served at. The bare domain
 * (zuhayrcreative.org) 308-redirects to www on Vercel, so every canonical,
 * sitemap entry and structured-data URL must name www. Pointing them at the
 * bare domain sent Google round in a circle (canonical → redirect → canonical)
 * and the site was not indexed (19 Nov 2026).
 */
export const SITE_URL = "https://www.zuhayrcreative.org";
export const SITE_NAME = "Zuhayr Creative";

export const DEFAULT_TITLE = "Zuhayr Creative | Global Digital Marketing & AI Solutions Agency";
export const DEFAULT_DESCRIPTION =
  "Elite digital marketing agency specializing in AI automation, web design, SEO optimization, and intelligent workflow systems. Transform your business with data-driven strategies and cutting-edge technology.";

/* The share image. The logo is square, so it is described as square; a
   1200×630 banner made for link previews would show better on social. */
const SHARE_IMAGE = {
  url: "/logo.png",
  width: 2084,
  height: 2084,
  alt: "Zuhayr Creative",
};

export const baseOpenGraph = {
  type: "website",
  locale: "en_US",
  siteName: SITE_NAME,
  images: [SHARE_IMAGE],
} satisfies Metadata["openGraph"];

/**
 * Metadata for one page: its own title, description, canonical and share
 * tags.
 *
 * Next merges page metadata into the layout's SHALLOWLY: a page that sets
 * `openGraph` or `alternates` replaces the layout's whole object, and a page
 * that sets neither inherits the layout's. So without this every page
 * inherited the homepage canonical and told Google it was a copy of the
 * homepage.
 */
export function pageMetadata({
  path,
  title,
  description,
  ...rest
}: { path: string; title: string; description: string } & Metadata): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...baseOpenGraph, url: path, title: `${title} | ${SITE_NAME}`, description },
    twitter: { card: "summary", title: `${title} | ${SITE_NAME}`, description },
    ...rest,
  };
}
