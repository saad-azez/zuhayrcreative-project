"use client";

import ContactFooter from "./ContactFooter";
import FooterScene from "./FooterScene";

/**
 * Site-wide footer — the contact footer, the seam blender, and the below-footer
 * scene bundled as ONE component. Rendered once from the template so every page
 * shares the exact same footer: edit ContactFooter / FooterScene and it updates
 * everywhere. (The Navbar is likewise a single template-level component.)
 */
export default function SiteFooter() {
  return (
    <>
      <ContactFooter />
      {/* Seam blender — frosted black strip straddling the footer /
          below-footer boundary. The backdrop-blur smears both scenes' edge
          pixels together while the black core covers the seam itself (and any
          hairline gap that would expose the maroon page background). */}
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
  );
}
