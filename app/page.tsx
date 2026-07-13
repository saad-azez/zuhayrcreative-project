"use client";

import UnicornBackground from "./components/UnicornBackground";
import { HeroBanner } from "./components/HeroBanner";
import ImpactSection from "./components/ImpactSection";
// import ServicesSection from "./components/ServicesSection"; // (legacy v1 — disabled)
// import ServicesSectionV2 from "./components/ServicesSectionV2"; // (legacy v2 — disabled)
import ServicesSectionV3 from "./components/ServicesSectionV3";
import { VerticalGallery } from "./components/VerticalGallery";
import OrbitingGallery from "./components/OrbitingGallery";
import SeasonsGlobe from "./components/SeasonsGlobe";
// Hidden for now — reviews section + the section below the footer.
// import Testimonials from "./components/Testimonials";
// import ZuhayrSection from "./components/ZuhayrSection";

export default function Home() {
  return (
    <>
      {/* Landing-page background — shared Unicorn Studio WebGL scene. */}
      <UnicornBackground />
      <main className="relative w-full max-w-full min-h-screen overflow-x-hidden">
        <HeroBanner />
        {/* V3 is the final services section — placed right after hero. */}
        <ServicesSectionV3 />
        {/* Section-break blur — same frosted treatment as the footer seam,
            straddling the services → gallery boundary so the section dissolves
            softly into the next one. Pure backdrop-blur (no dark core): both
            sides sit over the same shared background here, so only the blur is
            wanted; the mask tapers it in/out so the strip has no hard edges. */}
        <div aria-hidden className="relative z-20 h-0 pointer-events-none">
          <div
            className="absolute left-0 right-0 -top-20 h-40 backdrop-blur-xl"
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
        {/* Orbiting gallery — replaces the old FeaturedWorks + BrandArchitecture
            card sections (carries the #work anchor). */}
        <OrbitingGallery />
        <ImpactSection />
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
