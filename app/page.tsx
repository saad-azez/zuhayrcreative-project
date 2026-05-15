"use client";

import ServicesSection from "./components/ServicesSection";
import ImpactSection from "./components/ImpactSection";
import ContactFooter from "./components/ContactFooter";
import { VerticalGallery } from "./components/VerticalGallery";

export default function Home() {
  return (
    <main className="overflow-x-hidden w-full max-w-full min-h-screen">
      <VerticalGallery />
      <ServicesSection />
      <ImpactSection />
      <ContactFooter />
    </main>
  );
}
