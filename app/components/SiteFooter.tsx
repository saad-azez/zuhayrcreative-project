"use client";

import ContactFooter from "./ContactFooter";
import HorizonDomeLazy from "./HorizonDomeLazy";

/**
 * Site-wide footer. Rendered once from the template so every page shares the
 * exact same footer — edit ContactFooter / HorizonDomeLazy and it updates
 * everywhere. (The Navbar is likewise a single template-level component.)
 *
 * The full-height end-credits scene BELOW the footer — the "Sitting above
 * the horizon" dome (HorizonDome), in the slot the Unicorn Studio footer
 * scene used to fill — is controlled by the flag below. Turning it off ends the page at the contact footer and skips
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
          {/* The end credits: full-screen, transparent over the page's own
              background, the dome revealing itself as the reader arrives.
              It mounts on approach and only runs while on screen (see
              HorizonDome). The footer's scene fades out into the page
              background above it, so there is no seam to hide. */}
          {/* On a BLACK ground, per the client's reference
              (ssstwitter.com_1789240803893): measured, its frame is #000–#0B
              everywhere but one lit band. The dome's light is ADDED, and over
              the page's maroon it had nothing to stand against — "no black
              background, the gradient looks nothing close, no shadow or
              glow". The ground fades in over its top so the footer's scene
              hands over softly, and runs solid to the page's end; the dome's
              own mask keeps its light off the edges. */}
          <div
            style={{
              background: "#000",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 14%)",
              maskImage: "linear-gradient(to bottom, transparent 0%, #000 14%)",
            }}
          >
            <HorizonDomeLazy className="h-svh" />
          </div>
        </>
      )}
    </>
  );
}
