"use client";

import React, { useRef, useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import HeroBlinds from "./HeroBlinds";
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
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const rollingRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLSpanElement>(null);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();
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

      tl.to(titleRef.current, {
        opacity: 1,
        y: 0,
        duration: dur * 1.2,
      })
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
      <div className="absolute inset-0 z-10 flex flex-col items-start justify-center px-[clamp(1.25rem,5vw,8rem)] pointer-events-none pt-[clamp(5rem,10vh,8rem)] pb-8">
        {/* Title — uppercase brand wordmark */}
        <h1
          ref={titleRef}
          className="font-anton uppercase text-[clamp(3.5rem,14vw,11rem)] font-bold leading-[1] max-w-full sm:max-w-[18ch] pointer-events-auto opacity-0 translate-y-8 sm:translate-y-10 whitespace-pre-line text-center sm:text-left w-full"
        >
          {title}
        </h1>

        {/* CTA Button */}
        <span
          ref={ctaRef}
          className="mt-8 sm:mt-12 pointer-events-auto flex flex-col items-center sm:items-start gap-3 opacity-0 translate-y-7.5 w-full sm:w-auto"
        >
          <a
            href={ctaHref}
            className="cta-pill cta-pill--bubble group relative overflow-visible inline-flex items-center justify-center py-3 px-8 sm:py-3.5 sm:px-10 rounded-full font-sans text-sm font-semibold no-underline bg-white touch-target"
          >
            {/* Hover bubble pop layers — non-blocking, behind text */}
            <span className="cta-bubble cta-bubble--1" aria-hidden />
            <span className="cta-bubble cta-bubble--2" aria-hidden />
            <span className="cta-bubble cta-bubble--3" aria-hidden />
            <span className="cta-text-default relative z-10">{ctaText}</span>
            <span className="cta-text-hover relative z-10">{ctaTextHover}</span>
          </a>
        </span>
      </div>

      {/* Bottom-left stack — subtitle above, rolling sentences below */}
      <div className="absolute left-[clamp(1.25rem,5vw,8rem)] bottom-[clamp(1.5rem,4vh,3rem)] z-10 flex flex-col gap-3 sm:gap-4 max-w-[80vw] sm:max-w-150 pointer-events-auto">
        {/* Subtitle */}
        <p
          ref={subtitleRef}
          className="font-sans text-[clamp(0.9rem,1.5vw,1.1rem)] leading-relaxed text-white/70 opacity-0 translate-y-6"
        >
          {subtitle}
        </p>

        {/* Rolling sentences */}
        <div
          ref={rollingRef}
          className="overflow-hidden h-[1.8em] opacity-0 translate-y-6"
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
                className="h-[1.8em] flex items-center font-mono text-[clamp(0.7rem,1.3vw,0.95rem)] text-white uppercase font-bold tracking-wider whitespace-nowrap"
                style={{ color: "#ffffff" }}
              >
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll-driven horizontal blinds overlay (Altrum-style) */}
      <HeroBlinds />
    </section>
  );
}
