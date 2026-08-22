"use client";

import { useEffect, useRef } from "react";

/**
 * Edge sampler — feeds iOS 26 Safari the colour it paints its bars with.
 *
 * ── The proven mechanism (stripes test, on device, 2026-08-23 03:31) ──
 * With six labelled colour bands pinned to the page's edges, Safari's strips
 * above and below the layout viewport turned EXACTLY the colour of the
 * outermost 24px band — bright green — while theme-color and the body
 * background were both #1a070d, near-black. Verdict: Safari 26 ignores both
 * declarations and LIVE-SAMPLES the outermost rendered pixels of the page,
 * then floods its own chrome backdrop with that colour.
 *
 * That is also why the bars were black for weeks: the page's edge pixels are
 * the Unicorn WebGL canvas, whose context is created without
 * preserveDrawingBuffer — any readback of it (Safari's sampler included)
 * returns pure black. The reference site never hit this because its edges are
 * ordinary DOM paint, which samples fine.
 *
 * ── So paint something sampleable ──
 * Two thin fixed strips of plain DOM colour sit on the page's first and last
 * pixels. Safari samples THEM instead of the black-reading canvas, and its
 * bars become a continuation of the design. The colour is scroll-aware:
 * sections can declare `data-edge-color="#rrggbb"` and whichever section is
 * touching an edge wins (elementFromPoint skips pointer-events:none layers,
 * so the sampler never samples itself); everything untagged falls back to the
 * defaults below, chosen to sit inside the hero scene's pale range.
 *
 * TUNING: the two constants below are the knobs. Match TOP_DEFAULT /
 * BOTTOM_DEFAULT to the scene tones at the viewport edges; tag sections that
 * differ. The strips are 8px tall — enough to dominate Safari's shallow
 * sample window (the stripes test showed it reads ≲24px), thin enough to
 * read as part of the scene.
 */
const TOP_DEFAULT = "#9c9094";
const BOTTOM_DEFAULT = "#5c3c42";

const STRIP_H = 8;

export default function EdgeSampler() {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;

    const colorAt = (y: number, fallback: string) => {
      let el: Element | null = document.elementFromPoint(window.innerWidth / 2, y);
      while (el) {
        const c = (el as HTMLElement).dataset?.edgeColor;
        if (c) return c;
        el = el.parentElement;
      }
      return fallback;
    };

    const update = () => {
      raf = 0;
      if (topRef.current) {
        topRef.current.style.backgroundColor = colorAt(STRIP_H + 2, TOP_DEFAULT);
      }
      if (bottomRef.current) {
        bottomRef.current.style.backgroundColor = colorAt(
          window.innerHeight - STRIP_H - 3,
          BOTTOM_DEFAULT,
        );
      }
    };

    const request = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
    };
  }, []);

  const base: React.CSSProperties = {
    position: "fixed",
    left: 0,
    right: 0,
    height: STRIP_H,
    // Above all page content (nav pill starts at 16px, so no overlap) but
    // below the loader/idle overlays (z-9999+): while those cover the screen,
    // Safari samples THEIR edges, which is correct.
    zIndex: 9990,
    pointerEvents: "none",
    // Smooth the hand-off when a differently-tagged section reaches the edge,
    // so Safari's tint glides instead of snapping.
    transition: "background-color 600ms ease",
  };

  return (
    <>
      <div ref={topRef} aria-hidden style={{ ...base, top: 0, backgroundColor: TOP_DEFAULT }} />
      <div
        ref={bottomRef}
        aria-hidden
        style={{ ...base, bottom: 0, backgroundColor: BOTTOM_DEFAULT }}
      />
    </>
  );
}
