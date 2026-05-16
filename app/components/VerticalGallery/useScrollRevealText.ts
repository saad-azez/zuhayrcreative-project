"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven text fill reveal — background-clip:text with
 * backgroundSize animated from 0% → 100% on scroll.
 *
 * Based on CodePen mdQaNbG by Juxtopposed.
 *
 * The selector targets the parent container. All `.line` children
 * are animated in a staggered sequence, scrubbed by one ScrollTrigger.
 *
 * Each `.line` must have these CSS properties:
 *   color: rgba(…, 0.15)       — dimmed base text
 *   background: linear-gradient(to right, …) no-repeat
 *   -webkit-background-clip: text
 *   background-clip: text
 *   background-size: 0%         — starts hidden
 */
export function useScrollRevealText(selector: string) {
  useEffect(() => {
    function setupReveal() {
      // Kill existing triggers on this selector
      ScrollTrigger.getAll().forEach((t) => {
        if (t.vars.trigger instanceof HTMLElement) {
          const el = t.vars.trigger;
          if (el.matches(selector)) t.kill();
        }
      });

      const container = document.querySelector<HTMLElement>(selector);
      if (!container) return;

      const lines = container.querySelectorAll<HTMLElement>(".line");
      if (!lines || lines.length === 0) return;

      // Ensure all lines start hidden
      gsap.set(lines, { backgroundSize: "0%" });

      // Single timeline — lines stagger one after another
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: "top 85%",
          end: "bottom 20%",
          scrub: true,
        },
      });

      tl.to(lines, {
        backgroundSize: "100%",
        ease: "none",
        stagger: 0.35,
      });
    }

    setupReveal();

    function onResize() {
      setupReveal();
    }

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      ScrollTrigger.getAll().forEach((t) => {
        if (t.vars.trigger instanceof HTMLElement) {
          const el = t.vars.trigger;
          if (el.matches(selector)) t.kill();
        }
      });
    };
  }, [selector]);
}
