"use client";

import DarkVeil from "./components/DarkVeil";
import { VerticalGallery } from "./components/VerticalGallery";
import ServicesSection from "./components/ServicesSection";
import ImpactSection from "./components/ImpactSection";
import ContactFooter from "./components/ContactFooter";
import { HeroBanner } from "./components/HeroBanner";

export default function Home() {
  return (
    <>
      <main className="overflow-x-hidden w-full max-w-full min-h-screen">
        <HeroBanner />

        <VerticalGallery />
        <ServicesSection />
        <ImpactSection />
        <ContactFooter />
      </main>
    </>
  );
}
