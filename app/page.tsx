"use client";

import Grainient from "./components/Grainient/Grainient";
import DarkVeil from "./components/DarkVeil";
import ContactFooter from "./components/ContactFooter";
import { HeroBanner } from "./components/HeroBanner";
import ImpactSection from "./components/ImpactSection";
import ServicesSection from "./components/ServicesSection";
import ServicesSectionV2 from "./components/ServicesSectionV2";
import { VerticalGallery } from "./components/VerticalGallery";
import FeaturedWorks from "./components/FeaturedWorks";

export default function Home() {
  return (
    <>
      {/* Grainient animated background (from v2) */}
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
        <Grainient
          color1="#e9436c"
          color2="#410011"
          color3="#350312"
          timeSpeed={0.95}
          colorBalance={-0.21}
          warpStrength={1.5}
          warpFrequency={8}
          warpSpeed={2.3}
          warpAmplitude={38}
          blendAngle={-4}
          blendSoftness={0.05}
          rotationAmount={500}
          noiseScale={0.55}
          grainAmount={0}
          grainScale={0.2}
          grainAnimated={false}
          contrast={1.3}
          gamma={0.7}
          saturation={0.9}
          centerX={0}
          centerY={0}
          zoom={0.9}
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
        <ServicesSection />
        <FeaturedWorks />
        <ServicesSectionV2 />
        <VerticalGallery />
        <ImpactSection />
        <ContactFooter />
      </main>
    </>
  );
}
