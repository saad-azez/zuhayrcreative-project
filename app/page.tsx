"use client";

import ContactFooter from "./components/ContactFooter";
import { HeroBanner } from "./components/HeroBanner";
import ImpactSection from "./components/ImpactSection";
import ServicesSection from "./components/ServicesSection";
import { VerticalGallery } from "./components/VerticalGallery";

export default function Home() {
  return (
    <>
      <main className="overflow-x-hidden w-full max-w-full min-h-screen">
        <HeroBanner />
        <ServicesSection />
        <VerticalGallery />
        <ImpactSection />
        <ContactFooter />
      </main>
    </>
  );
}
