"use client";

import React, { useRef, useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import FloatingLogos from "./FloatingLogos";
import GlassPanel from "./GlassPanel";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import "@/app/styles/hero-banner.css";

gsap.registerPlugin(useGSAP);

interface HeroBannerProps {
  title?: string;
  titleAccent?: string;
  subtitle?: string;
  ctaText?: string;
  ctaTextHover?: string;
  ctaHref?: string;
}

const ROLLING_SENTENCES = [
  "We architect AI automation systems.",
  "We design premium web interfaces.",
  "We optimize organic search rankings.",
  "We build high-converting platforms."
];

/**
 * Hero banner with floating logos background, glass panel overlay,
 * animated tagline, title, subtitle, and CTA button.
 *
 * Fully responsive: mobile-first with adjusted sizing and reduced animations.
 */
export default function HeroBanner({
  title = "Zuhayr Creative",
  subtitle = "We create digital experiences that inspire, engage, and deliver real results for your brand.",
  ctaText = "Explore Our Work",
  ctaTextHover = "Let's Talk",
  ctaHref = "#contact",
}: HeroBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const rollingRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLSpanElement>(null);
  const { isTouch, isMobile, prefersReducedMotion } = useDeviceDetect();
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);

  const displaySentences = [...ROLLING_SENTENCES, ROLLING_SENTENCES[0]];

  // Rotation timer for the rolling sentences
  useEffect(() => {
    const timer = setInterval(() => {
      setIsTransitioning(true);
      setSentenceIndex((prev) => prev + 1);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const handleTransitionEnd = () => {
    if (sentenceIndex >= ROLLING_SENTENCES.length) {
      setIsTransitioning(false);
      setSentenceIndex(0);
    }
  };

  // Entrance animation — lighter on mobile / reduced motion
  useGSAP(
    () => {
      const dur = prefersReducedMotion ? 0.01 : isTouch ? 0.4 : 0.7;

      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      tl.to(taglineRef.current, {
        opacity: 1,
        y: 0,
        duration: dur,
      })
        .to(
          titleRef.current,
          {
            opacity: 1,
            y: 0,
            duration: dur * 1.2,
          },
          "-=0.2",
        )
        .to(
          subtitleRef.current,
          {
            opacity: 1,
            y: 0,
            duration: dur,
          },
          "-=0.3",
        )
        .to(
          rollingRef.current,
          {
            opacity: 1,
            y: 0,
            duration: dur,
          },
          "-=0.25",
        )
        .to(
          ctaRef.current,
          {
            opacity: 1,
            y: 0,
            duration: dur,
          },
          "-=0.2",
        );
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      id="hero-banner"
      className="relative w-full min-h-svh overflow-hidden bg-transparent"
    >
      {/* Background: floating logos */}
      <FloatingLogos />

      {/* Glass panel overlay — hidden on mobile */}
      {!isMobile && <GlassPanel />}

      <div className="absolute inset-0 z-10 flex flex-col items-start justify-center px-[clamp(1.25rem,5vw,8rem)] pointer-events-none pt-[clamp(5rem,10vh,8rem)] pb-8">
        {/* Tagline — alternating maroon / white words */}
        <p
          ref={taglineRef}
          className="mb-4 sm:mb-6 font-sans text-[clamp(0.6rem,1.5vw,0.85rem)] font-bold tracking-[0.2em] sm:tracking-[0.28em] uppercase pointer-events-auto opacity-0 translate-y-5 text-center sm:text-left w-full"
        >
          <span className="text-maroon-accent">CREATIVE</span>{" "}
          <span className="text-white/50">·</span>{" "}
          <span className="text-white">INNOVATIVE</span>{" "}
          <span className="text-white/50">·</span>{" "}
          <span className="text-maroon-accent">EFFECTIVE</span>
        </p>

        {/* Title */}
        <h1
          ref={titleRef}
          className="font-anton text-[clamp(2.75rem,10vw,7rem)] font-bold leading-[1.08] max-w-full sm:max-w-200 pointer-events-auto opacity-0 translate-y-8 sm:translate-y-10 whitespace-pre-line text-center sm:text-left w-full"
        >
          {title}
        </h1>

        {/* Subtitle */}
        <p
          ref={subtitleRef}
          className="mt-4 sm:mt-6 font-sans text-[clamp(0.95rem,1.8vw,1.25rem)] leading-relaxed text-white/60 max-w-full sm:max-w-150 pointer-events-auto opacity-0 translate-y-6 text-center sm:text-left w-full"
        >
          {subtitle}
        </p>

        {/* Rolling Sentences Row */}
        <div
          ref={rollingRef}
          className="mt-4 overflow-hidden h-[1.8em] relative w-full text-center sm:text-left pointer-events-auto opacity-0 translate-y-6 max-w-full sm:max-w-150"
        >
          <div
            className="flex flex-col"
            style={{
              transform: `translateY(-${(sentenceIndex * 100) / displaySentences.length}%)`,
              transition: isTransitioning
                ? "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)"
                : "none",
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {displaySentences.map((text, idx) => (
              <div
                key={idx}
                className="h-[1.8em] flex items-center justify-center sm:justify-start font-mono text-[clamp(0.7rem,1.3vw,0.95rem)] text-white uppercase font-bold tracking-wider whitespace-nowrap"
                style={{ color: "#ffffff" }}
              >
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <span
          ref={ctaRef}
          className="mt-8 sm:mt-12 pointer-events-auto flex flex-col items-center sm:items-start gap-3 opacity-0 translate-y-7.5 w-full sm:w-auto"
        >
          <a
            href={ctaHref}
            className="cta-pill group relative overflow-hidden inline-flex items-center justify-center py-3 px-8 sm:py-3.5 sm:px-10 rounded-full font-sans text-sm font-semibold no-underline bg-white touch-target"
          >
            <span className="cta-text-default relative z-10">{ctaText}</span>
            <span className="cta-text-hover relative z-10">{ctaTextHover}</span>
          </a>
        </span>
      </div>
    </section>
  );
}
