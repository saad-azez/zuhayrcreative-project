"use client";

import React, { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";

gsap.registerPlugin(useGSAP, ScrollTrigger);

interface HeroBlindsProps {
  /** Selector for the section that drives the scroll progress */
  triggerSelector?: string;
  /**
   * Ascending bar heights as % of hero height (top → bottom).
   * Defaults to a small-to-big progression like the reference video.
   */
  heights?: number[];
  /**
   * Vertical gap between bars as % of hero height.
   */
  gap?: number;
  /**
   * Scroll progress (0–1 of the hero section) at which the first bar appears.
   * Subsequent bars appear evenly across `startAt` … `endAt`.
   */
  startAt?: number;
  endAt?: number;
}

/**
 * Horizontal "venetian-blind" overlay for the hero section.
 *
 * Bars are stacked from the bottom of the hero with ascending heights
 * (small → big). They pop into place (no left-to-right wipe) as the user
 * scrolls past their individual thresholds. Inspired by the Altrum hero.
 */
const HeroBlinds = React.memo(function HeroBlinds({
  triggerSelector = "#hero-banner",
  heights = [3, 5, 7, 10, 13, 17],
  gap = 2,
  startAt = 0.35,
  endAt = 0.85,
}: HeroBlindsProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { prefersReducedMotion } = useDeviceDetect();

  useGSAP(
    () => {
      if (prefersReducedMotion) return;
      const bars = wrapRef.current?.querySelectorAll<HTMLDivElement>(
        ".hero-blind-bar",
      );
      if (!bars || !bars.length) return;

      gsap.set(bars, {
        scaleY: 0,
        transformOrigin: "bottom center",
      });

      const trigger = document.querySelector(triggerSelector) as HTMLElement;
      if (!trigger) return;

      const n = bars.length;
      const span = Math.max(0.0001, endAt - startAt);
      // Each bar gets its own scroll window. Windows overlap slightly so
      // multiple bars can grow at once but still finish in sequence.
      const perBar = span / n;
      const windowSize = perBar * 1.6; // overlap factor
      const starts = Array.from({ length: n }, (_, i) => startAt + perBar * i);

      const st = ScrollTrigger.create({
        trigger,
        start: "top top",
        end: "bottom top",
        scrub: 0.3,
        onUpdate: (self) => {
          bars.forEach((bar, i) => {
            const p = gsap.utils.clamp(
              0,
              1,
              (self.progress - starts[i]) / windowSize,
            );
            // Width stays 100% — only the vertical scale grows.
            gsap.set(bar, { scaleY: p });
          });
        },
      });

      return () => {
        st.kill();
      };
    },
    {
      dependencies: [
        triggerSelector,
        heights.join(","),
        gap,
        startAt,
        endAt,
        prefersReducedMotion,
      ],
    },
  );

  // Stack bars from the BOTTOM of the hero so the biggest one sits lowest.
  // Compute each bar's `bottom` offset = sum of (height + gap) of bars below it.
  const positions = heights.map((_, i) => {
    let offset = 0;
    for (let j = 0; j < i; j++) offset += heights[j] + gap;
    return offset;
  });

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="absolute inset-0 z-20 pointer-events-none overflow-hidden"
    >
      {heights.map((h, i) => (
        <div
          key={i}
          className="hero-blind-bar absolute left-0 right-0 bg-black"
          style={{
            bottom: `${positions[i]}%`,
            height: `${h}%`,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
});

export default HeroBlinds;
