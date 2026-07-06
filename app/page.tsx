"use client";

import UnicornBackground from "./components/UnicornBackground";
import ContactFooter from "./components/ContactFooter";
import FooterScene from "./components/FooterScene";
import { HeroBanner } from "./components/HeroBanner";
import ImpactSection from "./components/ImpactSection";
// import ServicesSection from "./components/ServicesSection"; // (legacy v1 — disabled)
// import ServicesSectionV2 from "./components/ServicesSectionV2"; // (legacy v2 — disabled)
import ServicesSectionV3 from "./components/ServicesSectionV3";
import { VerticalGallery } from "./components/VerticalGallery";
import OrbitingGallery from "./components/OrbitingGallery";
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
        {/* <ServicesSection /> */}
        {/* <ServicesSectionV2 /> */}
        <VerticalGallery />
        {/* Orbiting gallery — replaces the old FeaturedWorks + BrandArchitecture
            card sections (carries the #work anchor). */}
        <OrbitingGallery />
        <ImpactSection />
        {/* <Testimonials /> — reviews section hidden */}
        <ContactFooter />
        {/* Seam blender — frosted black strip straddling the footer /
            below-footer boundary. The backdrop-blur smears both scenes' edge
            pixels together while the black core covers the seam itself (and
            any hairline gap that would expose the maroon page background),
            with the mask tapering the blur in/out so the strip has no hard
            edges of its own. */}
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
        {/* <ZuhayrSection /> — section below the footer hidden */}
      </main>
    </>
  );
}
