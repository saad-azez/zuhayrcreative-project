"use client";

import { useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(useGSAP, Flip);

interface LoadingScreenProps {
  onComplete: () => void;
}

/**
 * Loading screen: the Zuhayr Creative logo lockup on a frosted-glass backdrop
 * (same blur treatment as the open menu — the page-wide background shows
 * through, blurred). The hero's own content stays hidden until the loader
 * finishes (it only reveals on `app:reveal`, fired at onComplete). When loading
 * finishes, the logo flies (Flip-fit) into the hero section's logo position
 * while the frosted backdrop fades away, so it reads as one continuous element
 * travelling from the loader into the hero.
 */
export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const logo = logoRef.current;
      const bg = bgRef.current;
      if (!logo || !bg) return;

      const tl = gsap.timeline();

      // Phase 1 — logo settles in on the blank backdrop.
      tl.fromTo(
        logo,
        { opacity: 0, scale: 0.94 },
        { opacity: 1, scale: 1, duration: 0.7, ease: "power3.out", delay: 0.35 },
      );

      // Phase 2 — hold a beat.
      tl.to(logo, { duration: 0.5 });

      // Phase 3 — hand off to the hero: fly the logo onto the hero's logo and
      // fade the blank backdrop to reveal the page behind it.
      tl.add(() => {
        const heroLogo =
          document.querySelector<HTMLElement>("[data-hero-logo]");
        const heroTitle =
          document.querySelector<HTMLElement>("[data-hero-title]");

        // No hero on this route (or not mounted yet) — fade out gracefully.
        if (!heroLogo) {
          gsap.to(containerRef.current, {
            opacity: 0,
            duration: 0.6,
            ease: "power2.inOut",
            onComplete,
          });
          return;
        }

        // Neutralise the hero headline's initial offset so we fly to — and
        // leave it at — its RESTING position. Opacity stays 0 (hidden) until
        // the hand-off completes; the hero reveals itself at rest afterwards.
        if (heroTitle) gsap.set(heroTitle, { x: 0, y: 0 });
        (window as Window & { __fromLoader?: boolean }).__fromLoader = true;

        const flight = gsap.timeline({ onComplete });
        flight.to(
          bg,
          { opacity: 0, duration: 0.8, ease: "power2.inOut" },
          0,
        );
        flight.add(
          Flip.fit(logo, heroLogo, {
            duration: 0.95,
            ease: "power3.inOut",
            scale: true,
          }) as gsap.core.Tween,
          0,
        );
      });
    },
    { scope: containerRef },
  );

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-9999 overflow-hidden will-change-transform"
    >
      {/* Frosted-glass backdrop — same blur as the open menu. Blurs the
          page-wide background behind it; the hero's content stays hidden
          (opacity 0) until reveal, so only the blurred backdrop shows during
          load. Fades away during the hand-off. */}
      <div ref={bgRef} className="absolute inset-0 bg-black/30 backdrop-blur-2xl" />

      {/* Logo lockup, centred. The inner div is the Flip source (sized to the
          image) that flies into the hero. */}
      <div className="absolute inset-0 flex items-center justify-center select-none">
        {/* Rests at opacity-0 so React StrictMode's dev remount (which reverts
            GSAP's inline styles) can't flash the logo visible between mounts —
            the intro tween animates it from 0 → 1. */}
        <div ref={logoRef} className="inline-block w-[clamp(18rem,50vw,40rem)] opacity-0">
          <Image
            src="/ZEALTH-11-trimmed.png"
            alt="Zuhayr Creative"
            width={1318}
            height={342}
            priority
            className="block h-auto w-full"
          />
        </div>
      </div>
    </div>
  );
}
