"use client";

import ContactFooter from "../components/ContactFooter";
import UnicornBackground from "../components/UnicornBackground";

export default function ClubPage() {
  return (
    <>
      <UnicornBackground />

      <main className="relative w-full max-w-full min-h-screen overflow-x-hidden">
        <div className="min-h-screen flex items-center justify-center">
          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-foreground"
            aria-label="Club"
          >
            Club
          </h1>
        </div>
        <ContactFooter />
      </main>
    </>
  );
}
