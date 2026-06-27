"use client";

import ContactFooter from "../components/ContactFooter";
import StackedPanels from "../components/StackedPanels";
import UnicornBackground from "../components/UnicornBackground";

export default function CareerPage() {
  return (
    <>
      <UnicornBackground />

      <main className="relative w-full max-w-full min-h-screen overflow-x-hidden">
        <div className="w-full h-screen">
          <StackedPanels />
        </div>
        <ContactFooter />
      </main>
    </>
  );
}
