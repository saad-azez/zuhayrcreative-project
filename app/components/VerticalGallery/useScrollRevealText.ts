"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven text fill reveal — backgroundSize animated 0% → 100%.
 * Each `.line` child inside the selector is revealed in staggered sequence.
 *
 * Uses GSAP context for scoped cleanup — does NOT kill unrelated ScrollTriggers.
 *
 * Required CSS on `.line`:
 *   color: rgba(…, 0.15)       — dimmed base
 *   background: linear-gradient(to right, #fff, #fff) no-repeat
 *   -webkit-background-clip: text / background-clip: text
 *   background-size: 0%
 */
export function useScrollRevealText(selector: string): void {
  const ctxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    ctxRef.current?.revert();

    const ctx = gsap.context(() => {
      const container = document.querySelector<HTMLElement>(selector);
      if (!container) return;

      const lines = container.querySelectorAll<HTMLElement>(".line");
      if (lines.length === 0) return;

      gsap.set(lines, { backgroundSize: "0%" });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: container,
            start: "top 85%",
            end: "bottom 20%",
            scrub: true,
          },
        })
        .to(lines, {
          backgroundSize: "100%",
          ease: "none",
          stagger: 0.35,
        });
    });

    ctxRef.current = ctx;

    // Debounced resize
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
  }, [selector]);
}
