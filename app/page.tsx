"use client";

import ServicesSection from "./components/ServicesSection";
import ContactFooter from "./components/ContactFooter";

export default function Home() {
  return (
    <main className="overflow-x-hidden w-full max-w-full bg-background min-h-screen">
      <ServicesSection />
      <ContactFooter />
    </main>
  );
}
