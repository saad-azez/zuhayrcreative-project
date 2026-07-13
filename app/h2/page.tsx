"use client";


/**
 * Hero preview /h2 — sample hero background for client review.
 * No content — just navbar (from layout), full-screen webm bg, and footer.
 */
export default function HeroPreviewH2() {
  return (
    <main className="relative w-full">
      <section
        className="relative w-full h-svh overflow-hidden bg-black"
        aria-label="Hero preview H2"
      >
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/polaris_remix_scene.webm"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        />
      </section>

    </main>
  );
}
