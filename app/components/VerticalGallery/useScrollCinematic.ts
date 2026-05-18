"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Cinematic parallax on oversized background text.
 * The text shifts horizontally with scrub for a smooth depth effect.
 */
export function useBackgroundParallax(selector: string): void {
  const ctxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    ctxRef.current?.revert();

    const ctx = gsap.context(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return;

      gsap.fromTo(
        el,
        { xPercent: -8 },
        {
          xPercent: 8,
          ease: "none",
          scrollTrigger: {
            trigger: el.parentElement,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
          },
        },
      );
    });

    ctxRef.current = ctx;

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

/**
 * Cinematic row reveal — images softly translate + fade in on scroll.
 * Each row gets a staggered entrance based on its index.
 */
export function useRowReveal(selector: string): void {
  const ctxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    ctxRef.current?.revert();

    const ctx = gsap.context(() => {
      const rows = document.querySelectorAll<HTMLElement>(selector);
      if (rows.length === 0) return;

      gsap.set(rows, { willChange: "transform" });

      rows.forEach((row, i) => {
        // Alternate slide direction: even rows from left, odd from right
        const fromX = i % 2 === 0 ? -60 : 60;

        const imageWrapper = row.querySelector<HTMLElement>(
          '[data-gallery="image-wrapper"]',
        );
        const label = row.querySelector<HTMLElement>("[data-row-label]");

        const targets = [imageWrapper, label].filter(Boolean) as HTMLElement[];

        gsap.fromTo(
          targets,
          {
            xPercent: fromX,
            opacity: 0,
          },
          {
            xPercent: 0,
            opacity: 1,
            duration: 1.2,
            ease: "power3.out",
            stagger: 0.08,
            scrollTrigger: {
              trigger: row,
              start: "top 82%",
              end: "top 35%",
              toggleActions: "play none none reverse",
            },
          },
        );
      });
    });

    ctxRef.current = ctx;

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
