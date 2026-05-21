"use client";

import React, { useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import FloatingLogos from "./FloatingLogos";
import GlassPanel from "./GlassPanel";
import "@/app/styles/hero-banner.css";

gsap.registerPlugin(useGSAP);

interface HeroBannerProps {
  title?: string;
  titleAccent?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
}

/**
 * Hero banner with floating logos background, glass panel overlay,
 * animated title, subtitle, and CTA button.
 *
 * Based on the Zuhayr Creative Hero Section v9 design.
 */
export default function HeroBanner({
  title = "We help you achieve your goals ",
  subtitle = "We help you achieve your goals",
  ctaText = "Start Your Project",
  ctaHref = "#contact",
}: HeroBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  // Entrance animation for content
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      tl.to(titleRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.9,
      })
        .to(
          subtitleRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
          },
          "-=0.4",
        )
        .to(
          ctaRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
          },
          "-=0.3",
        );
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-transparent"
    >
      {/* Background: floating logos */}
      <FloatingLogos />

      {/* Glass panel overlay */}
      <GlassPanel />

      <div className="absolute inset-0 z-10 flex flex-col items-start justify-center px-[clamp(2rem,8vw,8rem)] pointer-events-none">
        {/* Title */}
        <h1
          ref={titleRef}
          className="font-sans text-[clamp(2.5rem,5.5vw,5rem)] font-bold leading-[1.1] text-white max-w-200 pointer-events-auto opacity-0 translate-y-10 whitespace-pre-line"
        >
          {title}
        </h1>

        {/* Subtitle */}
        <p
          ref={subtitleRef}
          className="mt-6 font-sans text-[clamp(1rem,1.4vw,1.25rem)] leading-relaxed text-white/80 max-w-135 pointer-events-auto opacity-0 translate-y-6"
        >
          {subtitle}
        </p>

        {/* CTA Button — pill shape with arrow */}
        <a
          ref={ctaRef}
          href={ctaHref}
          className="group mt-10 pointer-events-auto inline-flex items-center gap-3 py-4 px-10 rounded-full font-sans text-base font-semibold text-white bg-white/10 backdrop-blur-md border border-white/25 no-underline transition-all duration-300 opacity-0 translate-y-7.5 will-change-transform hover:bg-white/20 hover:border-white/40 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(255,255,255,0.12)]"
        >
          {ctaText}
          <span
            className="inline-block transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden="true"
          >
            →
          </span>
        </a>
      </div>
    </section>
  );
}
