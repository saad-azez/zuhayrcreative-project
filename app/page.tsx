"use client";

import { HeroBannerUpdated } from "./components/HeroBannerUpdated";
import { VerticalGallery } from "./components/VerticalGallery";
import ServicesSection from "./components/ServicesSection";
import ImpactSection from "./components/ImpactSection";
import ContactFooter from "./components/ContactFooter";

export default function Home() {
  return (
    <main className="overflow-x-hidden w-full max-w-full min-h-screen">
      {/* <HeroBannerUpdated /> */}
       {/* <VerticalGallery /> */}
      <ServicesSection />
      {/* <ImpactSection /> */}
      {/* <ContactFooter />  */}
    </main>
  );
}
