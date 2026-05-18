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
  title = "Digital Marketing",
  titleAccent = "Reimagined",
  subtitle = "Elite AI-powered strategies that transform your brand into a market-dominating force.",
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

      {/* Content: title, subtitle, CTA */}
      <div className="absolute inset-0 z-10 flex flex-col items-start justify-center pl-[clamp(2rem,8vw,8rem)] pointer-events-none">
        <h1
          ref={titleRef}
          className="font-[var(--font-sans)] text-[clamp(3rem,6vw,7rem)] font-bold leading-[1.05] text-foreground max-w-[700px] pointer-events-auto opacity-0 translate-y-10"
        >
          {title} <span className="text-maroon-accent">{titleAccent}</span>
        </h1>
        <p
          ref={subtitleRef}
          className="font-[var(--font-sans)] text-[clamp(1rem,1.5vw,1.3rem)] text-foreground-muted mt-6 max-w-[520px] leading-[1.6] pointer-events-auto opacity-0 translate-y-[30px]"
        >
          {subtitle}
        </p>
        <a
          ref={ctaRef}
          href={ctaHref}
          className="group mt-10 pointer-events-auto inline-flex items-center gap-3 py-4 px-9 rounded-full font-[var(--font-sans)] text-base font-semibold text-white bg-maroon-accent no-underline transition-all duration-300 opacity-0 translate-y-[30px] will-change-transform hover:bg-[#be1030] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(220,20,60,0.35)]"
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
