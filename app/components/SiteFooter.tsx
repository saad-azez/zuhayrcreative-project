"use client";

import ContactFooter from "./ContactFooter";

/**
 * Site-wide footer. Rendered once from the template so every page shares the
 * exact same footer — edit ContactFooter and it updates everywhere. (The Navbar
 * is likewise a single template-level component.)
 *
 * The full-height Unicorn Studio scene that used to sit BELOW the footer, and
 * the seam blender that existed only to hide the join between the two, are both
 * gone — the page now ends at the footer. This does NOT touch the Unicorn
 * background behind the footer itself, which is the page-wide UnicornBackground
 * each route mounts and is still there.
 */
export default function SiteFooter() {
  return <ContactFooter />;
}
