"use client";

import DarkVeil from "./components/DarkVeil";
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
      {/* Landing-page background — flow-gradient webm video (h1 design) */}
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
        <video
          src="/flow_gradient_remix_scene.webm"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>
      {/* Water ripple overlay — intact */}
      <DarkVeil
        overlay
        rippleStrength={0.03}
        rippleViscosity={0.97}
        rippleSize={10}
        nnColorFront="#00000000"
        nnColorMid="#00000000"
        nnColorBack="#00000000"
      />
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
