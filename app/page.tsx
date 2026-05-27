"use client";

import DarkVeil from "./components/DarkVeil";
import ContactFooter from "./components/ContactFooter";
import { HeroBanner } from "./components/HeroBanner";
import ImpactSection from "./components/ImpactSection";
import ServicesSection from "./components/ServicesSection";
import ServicesSectionV2 from "./components/ServicesSectionV2";
import { VerticalGallery } from "./components/VerticalGallery";

export default function Home() {
  return (
    <>
      {/* Original aurora + ripple background */}
      <DarkVeil
        variant="aurora"
        auroraColorStops={["#a01b3c", "#ed3aae", "#ca1441"]}
        auroraBlend={0.87}
        auroraAmplitude={1}
        speed={1.4}
        nnColorFront="#00000000"
        nnColorMid="#00000000"
        nnColorBack="#00000000"
      />
      <main className="relative w-full max-w-full min-h-screen overflow-x-hidden">
        <HeroBanner />
        <ServicesSection />
        <ServicesSectionV2 />
        <VerticalGallery />
        <ImpactSection />
        <ContactFooter />
      </main>
    </>
  );
}
