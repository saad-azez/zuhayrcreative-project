"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const VerticalGallery = dynamic(
  () => import("./components/VerticalGallery").then((m) => ({ default: m.VerticalGallery })),
  { ssr: false },
);

const HeroBanner = dynamic(
  () => import("./components/HeroBanner").then((m) => ({ default: m.HeroBanner })),
  { ssr: false },
);

// import ServicesSection from "./components/ServicesSection";
// import ImpactSection from "./components/ImpactSection";
// import ContactFooter from "./components/ContactFooter";

export default function Home() {
  return (
    <main className="overflow-x-hidden w-full max-w-full min-h-screen">
      {/* <HeroBanner
        logo="/logo.png"
        title="Digital Experiences Engineered for Impact"
        ctaText="Start Your Project"
        ctaHref="#services"
        glass={{
          colorBack: "#00000000",
          colorShadow: "#000000",
          colorHighlight: "#ffffff",
          size: 0.87,
          shadows: 0.25,
          highlights: 0.1,
          shape: "lines",
          angle: 0,
          distortionShape: "prism",
          distortion: 0.5,
          shift: 0,
          stretch: 0,
          blur: 0.99,
          edges: 0.86,
          margin: 0,
          grainMixer: 0,
          grainOverlay: 0,
        }}
      /> */}
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <br />
      <Suspense fallback={<div className="h-screen" />}>
        <VerticalGallery />
      </Suspense>
      {/* <ServicesSection /> */}
      {/* <ImpactSection /> */}
      {/* <ContactFooter /> */}
    </main>
  );
}
