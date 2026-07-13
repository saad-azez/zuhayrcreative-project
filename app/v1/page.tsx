"use client";

import UnicornScene from "unicornstudio-react";
import { HeroBanner } from "../components/HeroBanner";
import ImpactSection from "../components/ImpactSection";
import ServicesSection from "../components/ServicesSection";
import { VerticalGallery } from "../components/VerticalGallery";
import ServicesSectionV2 from "../components/ServicesSectionV2";
import ZuhayrSection from "../components/ZuhayrSection";

export default function V1Page() {
  return (
    <>
      {/* Unicorn animated background */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: -10,
          overflow: "hidden",
        }}
      >
        <UnicornScene
          projectId="MqhUgDX2lmbgy2sVhM1H"
          width="100%"
          height="100%"
          scale={1}
          dpi={1.5}
          sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.1.12/dist/unicornStudio.umd.js"
        />
      </div>
      <main className="relative w-full max-w-full min-h-screen overflow-x-hidden">
        <HeroBanner />
        <ServicesSection />
        <ServicesSectionV2 />
        <VerticalGallery />
        <ImpactSection />
        <ZuhayrSection />
      </main>
    </>
  );
}
