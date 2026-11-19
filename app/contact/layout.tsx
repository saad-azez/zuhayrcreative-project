import type { Metadata } from "next";
import { pageMetadata } from "../lib/seo";

/**
 * Only here for the metadata: page.tsx is a client component, and client
 * components cannot export `metadata`. Without this /contact repeated the
 * homepage's title, description and canonical.
 */
export const metadata: Metadata = pageMetadata({
  path: "/contact",
  title: "Contact",
  description:
    "Talk to Zuhayr Creative about a website, AI automation, SEO or a marketing project. Tell us what you need and we'll get back to you.",
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
