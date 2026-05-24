"use client";

import React, { useRef } from "react";
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
 * animated tagline, title, subtitle, and CTA button.
 *
 * Based on the Zuhayr Creative Hero Section v9 design.
 */
export default function HeroBanner({
  title = "We Design What Drives Your Success.",
  subtitle = "We create digital experiences that inspire, engage, and deliver real results for your brand.",
  ctaText = "Explore Our Work",
  ctaHref = "#contact",
}: HeroBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLSpanElement>(null);

  // Entrance animation for content
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      tl.to(taglineRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.6,
      })
        .to(
          titleRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
          },
          "-=0.3",
        )
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
        {/* Tagline — alternating pink / white words */}
        <p
          ref={taglineRef}
          className="mb-6 font-sans text-[clamp(0.7rem,0.95vw,0.85rem)] font-bold tracking-[0.28em] uppercase pointer-events-auto opacity-0 translate-y-5"
        >
          <span className="text-maroon-accent">CREATIVE</span>{" "}
          <span className="text-white/50">·</span>{" "}
          <span className="text-white">INNOVATIVE</span>{" "}
          <span className="text-white/50">·</span>{" "}
          <span className="text-maroon-accent">EFFECTIVE</span>
        </p>

        {/* Title — white-to-pink gradient text */}
        <h1
          ref={titleRef}
          className="font-sans text-[clamp(2.5rem,5.5vw,5rem)] font-bold leading-[1.1] max-w-200 pointer-events-auto opacity-0 translate-y-10 whitespace-pre-line text-white"
        >
          {title}
        </h1>

        {/* Subtitle */}
        <p
          ref={subtitleRef}
          className="mt-6 font-sans text-[clamp(1rem,1.4vw,1.25rem)] leading-relaxed text-white/60 max-w-150 pointer-events-auto opacity-0 translate-y-6"
        >
          {subtitle}
        </p>

        {/* CTA Button — pill with hover border slide + status badge */}
        <span
          ref={ctaRef}
          className="mt-12 pointer-events-auto flex flex-col items-start gap-3 opacity-0 translate-y-7.5"
        >
          {/* Main CTA pill */}
          <a
            href={ctaHref}
            className="cta-pill group relative overflow-hidden inline-flex items-center justify-center py-3.5 px-10 rounded-full font-sans text-sm font-semibold no-underline bg-white"
          >
            {/* Default text — slides up & out */}
            <span className="cta-text-default relative z-10">{ctaText}</span>
            {/* Hover text — slides up from below */}
            <span className="cta-text-hover relative z-10">{ctaText}</span>
          </a>
        </span>
      </div>
    </section>
  );
}
