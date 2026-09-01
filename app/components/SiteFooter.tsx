"use client";

import ContactFooter from "./ContactFooter";
import FooterScene from "./FooterScene";

/**
 * Site-wide footer. Rendered once from the template so every page shares the
 * exact same footer — edit ContactFooter / FooterScene and it updates
 * everywhere. (The Navbar is likewise a single template-level component.)
 *
 * The full-height Unicorn Studio scene BELOW the footer, and the seam blender
 * that exists only to hide the join between the two, are controlled by the
 * flag below. Turning it off ends the page at the contact footer and skips
 * creating the scene's WebGL context entirely — hiding them with
 * `display: none` instead would keep mounting a full-screen scene nobody can
 * see, which is what this flag exists to avoid.
 *
 * This does NOT touch the Unicorn background behind the footer itself, which is
 * the page-wide UnicornBackground each route mounts.
 */
const SHOW_BELOW_FOOTER_SCENE = true;

export default function SiteFooter() {
  return (
    <>
      <ContactFooter />
      {SHOW_BELOW_FOOTER_SCENE && (
        <>
          {/* Seam blender — frosted black strip straddling the footer /
              below-footer boundary. The backdrop-blur smears both scenes' edge
              pixels together while the black core covers the seam itself (and
              any hairline gap that would expose the maroon page background). */}
          <div aria-hidden className="relative z-20 h-0 pointer-events-none">
            <div
              className="absolute left-0 right-0 -top-8 h-40 backdrop-blur-xl"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.95) 16%, rgba(0,0,0,0.95) 34%, rgba(0,0,0,0) 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, #000 18%, #000 60%, transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, #000 18%, #000 60%, transparent 100%)",
              }}
            />
          </div>
          <FooterScene />
        </>
      )}
    </>
  );
}
