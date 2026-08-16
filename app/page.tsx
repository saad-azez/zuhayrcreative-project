"use client";

import UnicornBackground from "./components/UnicornBackground";
import { HeroBanner } from "./components/HeroBanner";
import ImpactSection from "./components/ImpactSection";
// import ServicesSection from "./components/ServicesSection"; // (legacy v1 — disabled)
// import ServicesSectionV2 from "./components/ServicesSectionV2"; // (legacy v2 — disabled)
import ServicesSectionV3 from "./components/ServicesSectionV3";
import { VerticalGallery } from "./components/VerticalGallery";
// import OrbitingGallery from "./components/OrbitingGallery"; // (ferris wheel — replaced by WorksRail)
import WorksRail from "./components/WorksRail";
import SeasonsGlobe from "./components/SeasonsGlobe";
import TriangleWipe from "./components/TriangleWipe";
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
        <VerticalGallery />
        {/* Breathing room between the dense sections so they aren't cramped. */}
        <div aria-hidden className="w-full h-[8vh] md:h-[12vh]" />
        {/* Selected work (carries the #work anchor). The orbiting ferris wheel
            that used to sit here is kept in the tree for A/B — it failed for a
            geometric reason rather than a tunable one; see the note at the top
            of WorksRail.tsx. */}
        <WorksRail />
        {/* Scroll transition between the work rail and the impact section. It
            owns its own stretch of scroll rather than overlaying either
            neighbour, so the rail scrolls away in full first and the impact
            section's own entrance animations play in plain sight afterwards.
            No breathing-room spacer before it: the wipe IS the separation, and
            a gap here only pushed the two sections further apart for nothing —
            it also put the rail's bottom above the block's top, so the wipe's
            own geometry had to be conservative about when the rail had gone. */}
        <TriangleWipe />
        <ImpactSection />
        {/* Extra room above the globe so it gets space to breathe. */}
        <div aria-hidden className="w-full h-[10vh] md:h-[16vh]" />
        {/* Seasons — the club globe, moved here as the last section before the
            footer (nav "Seasons" → #seasons). Sits over the shared background
            and supplies its own interaction; the page keeps the footer below. */}
        <SeasonsGlobe />
        {/* <Testimonials /> — reviews section hidden */}
        {/* Footer is shared — rendered once by the template (SiteFooter). */}
      </main>
    </>
  );
}
