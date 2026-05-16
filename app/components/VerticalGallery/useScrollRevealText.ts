"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SplitType from "split-type";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven text reveal — exact replica of CodePen MWQJWqJ by PointC.
 * Each line gets a dark mask; as you scroll, scaleX animates 1→0 revealing
 * the line from left to right.
 */
export function useScrollRevealText(selector: string) {
  const splitRef = useRef<SplitType | null>(null);
  const masksRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;

    function makeItHappen() {
      // Kill old triggers & remove old masks
      ScrollTrigger.getAll().forEach((t) => t.kill());
      masksRef.current.forEach((m) => m.remove());
      masksRef.current = [];

      // Split text into lines (re-split on resize)
      if (splitRef.current) {
        splitRef.current.split({ types: "lines" });
      } else {
        splitRef.current = new SplitType(el!, { types: "lines" });
      }

      const lines = splitRef.current.lines;
      if (!lines) return;

      lines.forEach((line) => {
        const mask = document.createElement("span");
        mask.className = "mask";
        line.appendChild(mask);
        masksRef.current.push(mask);

        gsap.to(mask, {
          scaleX: 0,
          transformOrigin: "right center",
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
      // Exact same pattern as CodePen: kill all, remove masks, re-split, rebuild
      ScrollTrigger.getAll().forEach((t, i) => {
        t.kill();
        masksRef.current[i]?.remove();
      });
      masksRef.current = [];
      splitRef.current?.split({ types: "lines" });
      makeItHappen();
    }

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      ScrollTrigger.getAll().forEach((t) => t.kill());
      masksRef.current.forEach((m) => m.remove());
      splitRef.current?.revert();
    };
  }, [selector]);
}

