"use client";

import { useState, useEffect } from "react";

interface DeviceInfo {
  /** True if the device has a touch screen (mobile/tablet) */
  isTouch: boolean;
  /** True if the device is a mobile phone (narrow screen) */
  isMobile: boolean;
  /** True if the device is a tablet (medium screen) */
  isTablet: boolean;
  /** True if the device is a desktop/laptop */
  isDesktop: boolean;
  /** True if user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Current breakpoint label */
  breakpoint: "mobile" | "tablet" | "desktop";
}

/**
 * Detects device type, touch capability, and motion preferences.
 * Returns stable values — does not re-render on resize for touch.
 */
export function useDeviceDetect(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(() => getDeviceInfo());

  useEffect(() => {
    // Recompute on resize (viewport-based fields only)
    const onResize = () => {
      const next = getDeviceInfo();
      setInfo((prev) => {
        // Only update if breakpoint-relevant fields changed
        if (
          prev.isMobile !== next.isMobile ||
          prev.isTablet !== next.isTablet ||
          prev.isDesktop !== next.isDesktop ||
          prev.breakpoint !== next.breakpoint
        ) {
          return next;
        }
        return prev;
      });
    };

    // Listen to reduced-motion changes
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      setInfo((prev) => ({
        ...prev,
        prefersReducedMotion: mq.matches,
      }));
    };

    window.addEventListener("resize", onResize);
    mq.addEventListener("change", onMotionChange);
    return () => {
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onMotionChange);
    };
  }, []);

  return info;
}

function getDeviceInfo(): DeviceInfo {
  const w = typeof window !== "undefined" ? window.innerWidth : 1024;
  const hasTouch =
    typeof window !== "undefined" &&
    ("ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-expect-error msMaxTouchPoints is IE-specific
      navigator.msMaxTouchPoints > 0);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isMobile = w < 768;
  const isTablet = w >= 768 && w < 1024;
  const isDesktop = w >= 1024;
  const breakpoint = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";

  return { isTouch: hasTouch, isMobile, isTablet, isDesktop, prefersReducedMotion, breakpoint };
}

/**
 * Static one-shot check (no React). Use outside components.
 */
export function checkDevice(): DeviceInfo {
  return getDeviceInfo();
}
