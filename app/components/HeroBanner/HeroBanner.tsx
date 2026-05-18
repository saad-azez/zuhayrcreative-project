"use client";

import React, { useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import FloatingLogos from "./FloatingLogos";
import GlassPanel from "./GlassPanel";
import "./hero-banner.css";

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
    <section ref={containerRef} className="hero-banner">
      {/* Background: floating logos */}
      <FloatingLogos />

      {/* Glass panel overlay */}
      <GlassPanel />

      {/* Content: title, subtitle, CTA */}
      <div className="hero-banner__content">
        <h1 ref={titleRef} className="hero-banner__title">
          {title}{" "}
          <span className="hero-banner__title-accent">{titleAccent}</span>
        </h1>
        <p ref={subtitleRef} className="hero-banner__subtitle">
          {subtitle}
        </p>
        <a ref={ctaRef} href={ctaHref} className="hero-banner__cta">
          {ctaText}
          <span className="hero-banner__cta-arrow" aria-hidden="true">
            →
          </span>
        </a>
      </div>
    </section>
  );
}
