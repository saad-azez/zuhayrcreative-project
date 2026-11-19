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

/* Says what the visible site says: a design-led agency in Hong Kong with five
   practices (app/lib/company.ts). It used to call the company a "digital
   marketing agency" doing SEO and social, which the site itself never
   claims, and answer engines that read both could not tell which it was. */
export const DEFAULT_TITLE = "Zuhayr Creative | Design-led Creative & AI Agency, Hong Kong";
export const DEFAULT_DESCRIPTION =
  "Zuhayr Creative is a design-led creative agency in Hong Kong: brand design, experience design and web development, communication design, content production and AI integration.";

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
