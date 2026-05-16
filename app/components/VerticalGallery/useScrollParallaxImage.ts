"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven image parallax — images shift vertically inside their
 * overflow:hidden container as the user scrolls, creating a subtle
 * reveal effect.
 *
 * Based on CodePen MWZKyom by Denis Gusev.
 *
 * The image must be inside a container with `overflow: hidden` and
 * `data-parallax="container"`. The image itself needs `data-parallax="img"`.
 */
export function useScrollParallaxImage(containerSelector: string) {
  useEffect(() => {
    function setupParallax() {
      // Kill existing triggers before recreating
      ScrollTrigger.getAll().forEach((t) => {
        if (t.vars.trigger instanceof HTMLElement) {
          const el = t.vars.trigger;
          if (el.matches(containerSelector)) t.kill();
        }
      });

      const containers =
        document.querySelectorAll<HTMLElement>(containerSelector);
      if (!containers || containers.length === 0) return;

      containers.forEach((container) => {
        const img = container.querySelector<HTMLElement>(
          '[data-parallax="img"]',
        );
        if (!img) return;

        // Performance hint
        img.style.willChange = "transform";

        // Ensure the image is positioned for transform
        gsap.set(img, {
          position: "absolute",
          top: 0,
          left: "50%",
          xPercent: -50,
          scale: 1.35,
          width: "auto",
          height: "100%",
          transformOrigin: "50% 50%",
        });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: container,
            scrub: true,
            pin: false,
            start: "top bottom",
            end: "bottom top",
          },
        });

        tl.fromTo(
          img,
          {
            yPercent: -20,
            ease: "none",
          },
          {
            yPercent: 20,
            ease: "none",
          },
        );
      });
    }

    setupParallax();

    function onResize() {
      setupParallax();
    }

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      ScrollTrigger.getAll().forEach((t) => {
        if (t.vars.trigger instanceof HTMLElement) {
          const el = t.vars.trigger;
          if (el.matches(containerSelector)) t.kill();
        }
      });
    };
  }, [containerSelector]);
}
