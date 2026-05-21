"use client";

<<<<<<< HEAD
<<<<<<< HEAD
import dynamic from "next/dynamic";
import { Suspense } from "react";
import UnicornScene from "unicornstudio-react/next";

const VerticalGallery = dynamic(
  () =>
    import("./components/VerticalGallery").then((m) => ({
      default: m.VerticalGallery,
    })),
  { ssr: false },
);

const HeroBanner = dynamic(
  () =>
    import("./components/HeroBanner").then((m) => ({ default: m.HeroBanner })),
  { ssr: false },
);

=======
import { HeroBanner } from "./components/HeroBanner";
=======
import DarkVeil from "./components/DarkVeil";
>>>>>>> 100adb727b6bed43afd28ae2537cbdda2e27a4b2
import { VerticalGallery } from "./components/VerticalGallery";
>>>>>>> b8fc881fd56568082c7b89799df451a108128980
import ServicesSection from "./components/ServicesSection";
import ImpactSection from "./components/ImpactSection";
import ContactFooter from "./components/ContactFooter";
import { HeroBanner } from "./components/HeroBanner";

export default function Home() {
  return (
<<<<<<< HEAD
    <main className="overflow-x-hidden w-full max-w-full min-h-screen">
<<<<<<< HEAD
      {<HeroBanner
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
      />}
      <section className="w-full">
        <UnicornScene
          projectId="iz4JdOR43fDF4kKAJDnx"
          sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.1.12/dist/unicornStudio.umd.js"
          width="100%"
          height="400px"
        />
      </section>
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
      {<Suspense fallback={<div className="h-screen" />}>
        <VerticalGallery />
      </Suspense>}
      {<ServicesSection />}
      <ImpactSection />
      {<ContactFooter />}
=======
      <HeroBanner />
      <VerticalGallery />
      <ServicesSection />
      <ImpactSection />
      <ContactFooter />
>>>>>>> b8fc881fd56568082c7b89799df451a108128980
    </main>
=======
    <>
      <DarkVeil variant="neuro-noise" />
      <main className="overflow-x-hidden w-full max-w-full min-h-screen">
        <HeroBanner />

        <VerticalGallery />
        <ServicesSection />
        <ImpactSection />
        <ContactFooter />
      </main>
    </>
>>>>>>> 100adb727b6bed43afd28ae2537cbdda2e27a4b2
  );
}
