"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven image parallax — images shift vertically inside their
 * overflow:hidden container as the user scrolls.
 *
 * Uses GSAP context for scoped cleanup — does NOT kill unrelated
 * ScrollTriggers from other components.
 *
 * @param containerSelector Selector targeting the container. Image needs `data-parallax="img"`.
 * @param disabled When true, the effect is skipped entirely (use for mobile/touch devices).
 */
export function useScrollParallaxImage(
  containerSelector: string,
  disabled = false,
): void {
  const ctxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    if (disabled) return; // Skip on mobile/touch
    // Revert only our own context
    ctxRef.current?.revert();

    const ctx = gsap.context(() => {
      const containers =
        document.querySelectorAll<HTMLElement>(containerSelector);
      if (containers.length === 0) return;

      for (const container of containers) {
        const img = container.querySelector<HTMLElement>(
          '[data-parallax="img"]',
        );
        if (!img) continue;

        // 88% leaves exactly the headroom the drift below travels through.
        // The old scale(1.35) + ±20% drift clipped ~26% off top and bottom.
        gsap.set(img, {
          position: "absolute",
          top: 0,
          left: "50%",
          xPercent: -50,
          scale: 1,
          width: "auto",
          height: "88%",
          transformOrigin: "50% 50%",
          willChange: "transform",
        });

        gsap
          .timeline({
            scrollTrigger: {
              trigger: container,
              scrub: true,
              start: "top bottom",
              end: "bottom top",
            },
          })
          .fromTo(
            img,
            { yPercent: 0, ease: "none" },
            { yPercent: 13, ease: "none" },
          );
      }
    });

    ctxRef.current = ctx;

    // Debounced resize — only refresh, don't recreate
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 150);
    };

    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
      ctxRef.current?.revert();
    };
  }, [containerSelector, disabled]);
}
