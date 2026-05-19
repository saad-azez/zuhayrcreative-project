"use client";

import React from "react";
import FlutedGlassPanel from "./FlutedGlassPanel";

interface HeroBannerUpdatedProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
}

/**
 * HeroBannerUpdated — uses the FlutedGlassPanel with WebGL fluted glass shader.
 * Glass card positioned on the left with heading, description, and CTA.
 */
export default function HeroBannerUpdated({
  title = "We Build",
  subtitle = "Digital experiences that drive growth and captivate audiences.",
  ctaText = "Get Started",
  ctaHref = "#contact",
}: HeroBannerUpdatedProps) {
  return (
    <FlutedGlassPanel
      heading={title}
      description={subtitle}
      ctaText={ctaText}
      ctaHref={ctaHref}
      bgColors={["#0a0a0a", "#14141a", "#1a0a0a"]}
    />
  );
}
