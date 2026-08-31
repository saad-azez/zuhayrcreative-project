"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Tunnel reveal for the process rows.
 *
 * Each row arrives out of the depth rather than sliding up from below: its
 * label and icon start pushed far back along z, so perspective draws them
 * small and collapsed toward the row's own centre, and scrolling pulls them
 * forward until they are full size in their normal places. Reading it as
 * motion, the pair separates from the middle of the screen and expands
 * outward — the depth illusion of travelling down a tunnel.
 *
 * The perspective is set on the ROW, not on the rows container. A container-
 * level perspective puts one vanishing point at the middle of a very tall
 * element, so rows far from that point would fly in from off to one side; a
 * per-row origin gives every row its own centre to grow out of.
 *
 * `z` alone drives it — no `scale`. Scale grows an element in place, which
 * reads as flat zoom; a real z translation under perspective also shifts each
 * element's screen position away from the vanishing point, which is what makes
 * the label and icon spread apart as they approach.
 */
export function useTunnelReveal(
  rowSelector: string,
  { disabled = false, depth = 2700, perspective = 900 } = {},
): void {
  const ctxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    if (disabled) return;
    // The whole effect IS the motion — there is no reduced version worth
    // showing, so these users get the rows plainly laid out.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    ctxRef.current?.revert();

    const ctx = gsap.context(() => {
      const rows = document.querySelectorAll<HTMLElement>(rowSelector);
      if (rows.length === 0) return;

      rows.forEach((row) => {
        const label = row.querySelector<HTMLElement>("[data-row-label]");
        const image = row.querySelector<HTMLElement>(
          '[data-gallery="image-wrapper"]',
        );
        const targets = [label, image].filter(Boolean) as HTMLElement[];
        if (targets.length === 0) return;

        gsap.set(row, { perspective, transformStyle: "preserve-3d" });
        gsap.set(targets, { willChange: "transform, opacity" });

        gsap.fromTo(
          targets,
          { z: -depth, opacity: 0 },
          {
            z: 0,
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: row,
              // Begins as the row clears the fold and finishes well before it
              // leaves, so each icon is settled and legible by the time it is
              // the one being read.
              start: "top bottom",
              end: "top 45%",
              scrub: 0.8,
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
  }, [rowSelector, disabled, depth, perspective]);
}
