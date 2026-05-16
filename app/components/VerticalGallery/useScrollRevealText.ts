"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SplitType from "split-type";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven text reveal — clip-path based (no mask overlay).
 * Each line wipes in from left to right as the user scrolls.
 * Works on ANY background (solid, gradient, image) — no blending issues.
 *
 * Based on CodePen MWQJWqJ by PointC, adapted for gradient backgrounds.
 */
export function useScrollRevealText(selector: string) {
  const splitRef = useRef<SplitType | null>(null);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;

    function makeItHappen() {
      ScrollTrigger.getAll().forEach((t) => t.kill());

      if (splitRef.current) {
        splitRef.current.split({ types: "lines" });
      } else {
        splitRef.current = new SplitType(el!, { types: "lines" });
      }

      const lines = splitRef.current.lines;
      if (!lines) return;

      lines.forEach((line) => {
        // Start fully hidden (clip from right)
        gsap.set(line, {
          clipPath: "inset(0 100% 0 0)",
        });

        // Reveal left-to-right on scroll
        gsap.to(line, {
          clipPath: "inset(0 0% 0 0)",
          ease: "none",
          scrollTrigger: {
            trigger: line,
            scrub: true,
            start: "top center",
            end: "bottom center",
          },
        });
      });
    }

    makeItHappen();

    function onResize() {
      ScrollTrigger.getAll().forEach((t) => t.kill());
      splitRef.current?.split({ types: "lines" });
      makeItHappen();
    }

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      ScrollTrigger.getAll().forEach((t) => t.kill());
      splitRef.current?.revert();
    };
  }, [selector]);
}
