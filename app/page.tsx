"use client";

import ContactFooter from "./components/ContactFooter";
import { HeroBanner } from "./components/HeroBanner";
import ImpactSection from "./components/ImpactSection";
import ServicesSection from "./components/ServicesSection";
import { VerticalGallery } from "./components/VerticalGallery";

export default function Home() {
  return (
    <>
      <main className="relative w-full max-w-full min-h-screen overflow-x-hidden">
        <HeroBanner />
        <ServicesSection />
        <VerticalGallery />
        <ImpactSection />
        <ContactFooter />
      </main>
    </>
  );
}
