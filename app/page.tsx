"use client";

import UnicornBackground from "./components/UnicornBackground";
import { HeroBanner } from "./components/HeroBanner";
import ImpactSection from "./components/ImpactSection";
// import ServicesSection from "./components/ServicesSection"; // (legacy v1 — disabled)
// import ServicesSectionV2 from "./components/ServicesSectionV2"; // (legacy v2 — disabled)
import ServicesSectionV3 from "./components/ServicesSectionV3";
import { VerticalGallery } from "./components/VerticalGallery";
// import OrbitingGallery from "./components/OrbitingGallery"; // (ferris wheel — replaced by WorksRail)
// import WorksRail from "./components/WorksRail"; // (whip rail — replaced by WorksStrip)
// import CaseStrip from "./components/CaseStrip"; // (Patch case study — hidden for now)
import WorksStrip from "./components/WorksStrip";
import SeasonsGlobe from "./components/SeasonsGlobe";
// import TriangleWipe from "./components/TriangleWipe"; // (superseded by PixelWipe — kept for A/B like the other alternates)
import PixelWipe from "./components/PixelWipe";
// Hidden for now — reviews section + the section below the footer.
// import Testimonials from "./components/Testimonials";
// import ZuhayrSection from "./components/ZuhayrSection";

export default function Home() {
  return (
    <>
      {/* Landing-page background — shared Unicorn Studio WebGL scene. */}
      <UnicornBackground />
      {/* overflow-x-clip (not -hidden): clips horizontal overflow the same way
          but does NOT create a scroll container, which would break the services
          section's position:sticky pinned horizontal-scroll. */}
      <main className="relative w-full max-w-full min-h-screen overflow-x-clip">
        <HeroBanner />
        {/* V3 is the final services section — placed right after hero. */}
        <ServicesSectionV3 />
        {/* Section-break blur — a soft dissolve just below the services →
            gallery seam. Sits on the gallery side only; straddling the seam put
            the strongest blur over the services' own bottom-left copy. */}
        <div aria-hidden className="relative z-20 h-0 pointer-events-none">
          <div
            className="absolute left-0 right-0 top-0 h-40 backdrop-blur-xl"
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, #000 32%, #000 68%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, #000 32%, #000 68%, transparent 100%)",
            }}
          />
        </div>
        {/* <ServicesSection /> */}
        {/* <ServicesSectionV2 /> */}
        {/* Pixel wipe: services → gallery. Every section seam gets one
            except hero → services (the page opening stays clean) and the
            approach to the footer. */}
        <PixelWipe />
        <VerticalGallery />
        {/* The breathing-room spacer that sat here is gone: the gallery's own
            bottom padding is separation enough, and the work section's seam
            blur + overlay fade-in now own the transition — the extra 8–12vh
            just pushed the two apart. */}
        {/* Selected work (carries the #work anchor). The orbiting ferris wheel
            that used to sit here is kept in the tree for A/B — it failed for a
            geometric reason rather than a tunable one; see the note at the top
            of WorksRail.tsx. */}
        {/* <CaseStrip /> — Patch case study, hidden for now */}
        {/* Pixel wipe: gallery → work. */}
        <PixelWipe />
        {/* Seam blur INTO the work section — same construction as the
            services → gallery dissolve above: a masked backdrop-blur band. It
            sits wholly ABOVE the seam (bottom-anchored in a zero-height
            wrapper) because the section's head text starts a couple of rem in,
            and a band straddling the seam would blur the "Selected Work" line
            itself. The section's own dark overlay fades out over the same
            zone (see .wstrip::before), so the two dissolves stack. */}
        <div aria-hidden className="relative z-20 h-0 pointer-events-none">
          <div
            className="absolute left-0 right-0 bottom-0 h-40 backdrop-blur-xl"
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, #000 32%, #000 68%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, #000 32%, #000 68%, transparent 100%)",
            }}
          />
        </div>
        {/* Work section — the case strip's layout and motion carrying the
            rail's content: the Selected Work head, a caption per plate, and
            the click-to-open enlarged view. Carries the #work anchor the
            navbar's "Work" link points at. The rail itself (WorksRail) stays
            in the tree, unmounted, like the ferris wheel before it. */}
        <WorksStrip />
        {/* Seam blur OUT of the work section, mirroring the one above it —
            this band sits wholly BELOW the seam, at the top of the impact
            section's head, which starts a comfortable way in. */}
        <div aria-hidden className="relative z-20 h-0 pointer-events-none">
          <div
            className="absolute left-0 right-0 top-0 h-40 backdrop-blur-xl"
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, #000 32%, #000 68%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, #000 32%, #000 68%, transparent 100%)",
            }}
          />
        </div>
        {/* Pixel-wipe transition between the work section and the impact
            section. It renders a sub-screen spacer (the sections' breathing
            room) plus a fixed curtain layer, and plays across that seam's
            travel through the viewport: the cells scale in over the work
            section's tail to full cover over the gap, hold, then scale back
            out to uncover the impact section rising beneath. */}
        <PixelWipe />
        <ImpactSection />
        {/* Pixel wipe: impact → seasons. Its built-in gap replaces the
            breathing-room spacer that used to sit above the globe. */}
        <PixelWipe />
        {/* Seasons — the club globe, moved here as the last section before the
            footer (nav "Seasons" → #seasons). Sits over the shared background
            and supplies its own interaction; the page keeps the footer below.
            NO wipe after it: the footer (and its credits) arrive plain. */}
        <SeasonsGlobe />
        {/* <Testimonials /> — reviews section hidden */}
        {/* Footer is shared — rendered once by the template (SiteFooter). */}
      </main>
    </>
  );
}
