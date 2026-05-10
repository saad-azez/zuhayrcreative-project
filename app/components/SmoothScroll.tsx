"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;

    let ls: { destroy: () => void } | null = null;
    let destroyed = false;

    gsap.ticker.lagSmoothing(0);

    // Only locomotive-scroll needs dynamic import (accesses DOM, SSR-unsafe)
    import("locomotive-scroll").then(({ default: LocomotiveScroll }) => {
      if (destroyed) return;
      ls = new LocomotiveScroll({
        lenisOptions: { lerp: 0.1, smoothWheel: true, smoothTouch: false },
        initCustomTicker: (render) => gsap.ticker.add(render),
        destroyCustomTicker: (render) => gsap.ticker.remove(render),
        scrollCallback: () => ScrollTrigger.update(),
      });
    });

    return () => {
      destroyed = true;
      ls?.destroy();
    };
  }, []);

  return <>{children}</>;
}
