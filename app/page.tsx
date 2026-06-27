"use client";

import UnicornBackground from "./components/UnicornBackground";
import ContactFooter from "./components/ContactFooter";
import { HeroBanner } from "./components/HeroBanner";
import ImpactSection from "./components/ImpactSection";
// import ServicesSection from "./components/ServicesSection"; // (legacy v1 — disabled)
// import ServicesSectionV2 from "./components/ServicesSectionV2"; // (legacy v2 — disabled)
import ServicesSectionV3 from "./components/ServicesSectionV3";
import { VerticalGallery } from "./components/VerticalGallery";
import OrbitingGallery from "./components/OrbitingGallery";
import Testimonials from "./components/Testimonials";
import ZuhayrSection from "./components/ZuhayrSection";

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
        <ImpactSection />
        {/* Orbiting gallery — replaces the old FeaturedWorks + BrandArchitecture
            card sections (carries the #work anchor). */}
        <OrbitingGallery />
        <Testimonials />
        <ContactFooter />
        <ZuhayrSection />
      </main>
    </>
  );
}
