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
 * HeroBannerUpdated — fluted glass hero with a dark default background.
 * Pass `background` to FlutedGlassPanel to change what's behind the glass.
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
    />
  );
}
