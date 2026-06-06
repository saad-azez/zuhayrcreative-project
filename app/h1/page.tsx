"use client";

import ContactFooter from "../components/ContactFooter";

/**
 * Hero preview /h1 — sample hero background for client review.
 * No content — just navbar (from layout), full-screen webm bg, and footer.
 */
export default function HeroPreviewH1() {
  return (
    <main className="relative w-full">
      <section
        className="relative w-full h-svh overflow-hidden bg-black"
        aria-label="Hero preview H1"
      >
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/flow_gradient_remix_scene.webm"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        />
      </section>

      <ContactFooter />
    </main>
  );
}
