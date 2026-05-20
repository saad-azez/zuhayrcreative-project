"use client";

import React, { useEffect, useState, useCallback } from "react";
import FlutedGlassPanel from "./FlutedGlassPanel";
import {
  drawBackgroundGradient,
  type BackgroundSource,
} from "@/app/shaders/fluted-glass-renderer";

interface HeroBannerUpdatedProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
}

function makeGradientBackground(colors: string[]): BackgroundSource {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) drawBackgroundGradient(ctx, w, h, colors);
  return { type: "canvas", canvas: c };
}

/**
 * HeroBannerUpdated — independently manages the background behind the fluted glass.
 *
 * The background is built separately (gradient, image, video, WebGL scene — anything)
 * and passed to FlutedGlassPanel which applies refractive glass distortion over it.
 */
export default function HeroBannerUpdated({
  title = "We Build",
  subtitle = "Digital experiences that drive growth and captivate audiences.",
  ctaText = "Get Started",
  ctaHref = "#contact",
}: HeroBannerUpdatedProps) {
  const [bg, setBg] = useState<BackgroundSource>(() =>
    makeGradientBackground(["#0a0a0a", "#14141a", "#1a0a0a"]),
  );

  const rebuild = useCallback(
    () => setBg(makeGradientBackground(["#0a0a0a", "#14141a", "#1a0a0a"])),
    [],
  );

  useEffect(() => {
    window.addEventListener("resize", rebuild);
    return () => window.removeEventListener("resize", rebuild);
  }, [rebuild]);

  return (
    <FlutedGlassPanel
      heading={title}
      description={subtitle}
      ctaText={ctaText}
      ctaHref={ctaHref}
      background={bg}
    />
  );
}
