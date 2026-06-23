"use client";

import Grainient from "./components/Grainient/Grainient";
import ContactFooter from "./components/ContactFooter";
import { HeroBanner } from "./components/HeroBanner";
import ImpactSection from "./components/ImpactSection";
// import ServicesSection from "./components/ServicesSection"; // (legacy v1 — disabled)
// import ServicesSectionV2 from "./components/ServicesSectionV2"; // (legacy v2 — disabled)
import ServicesSectionV3 from "./components/ServicesSectionV3";
import { VerticalGallery } from "./components/VerticalGallery";
import FeaturedWorks from "./components/FeaturedWorks";
import BrandArchitecture from "./components/BrandArchitecture";
import Testimonials from "./components/Testimonials";
import ZuhayrSection from "./components/ZuhayrSection";

export default function Home() {
  return (
    <>
      {/* Landing-page background — animated Grainient shader */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: -10,
          overflow: "hidden",
          background: "#0a0a0a",
        }}
      >
        <Grainient color1="#470015" color2="#800020" color3="#DC143C" />
      </div>
      <main className="relative w-full max-w-full min-h-screen overflow-x-hidden">
        <HeroBanner />
        {/* V3 is the final services section — placed right after hero. */}
        <ServicesSectionV3 />
        {/* <ServicesSection /> */}
        <FeaturedWorks />
        {/* <ServicesSectionV2 /> */}
        <VerticalGallery />
        <ImpactSection />
        <BrandArchitecture />
        <Testimonials />
        <ContactFooter />
        <ZuhayrSection />
      </main>
    </>
  );
}
