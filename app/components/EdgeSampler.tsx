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
 * differ.
 *
 * The strips are 24px tall, and that number is EVIDENCE, not taste: the
 * stripes test used 24px bands and Safari's bars took their colour PURE,
 * while an 8px version of this sampler left the bars dark — the sampler
 * reads a window at least that deep, and anything thinner lets the
 * black-reading canvas back into the average. Do not shrink it below what a
 * new stripes test proves sufficient.
 */
const TOP_DEFAULT = "#9c9094";
const BOTTOM_DEFAULT = "#5c3c42";

const STRIP_H = 24;

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
    // Above EVERYTHING except the custom cursor (z-99999) — including the
    // loader, idle screen and transition grid (z-9999..10000). Deliberate:
    // Safari's edge sampler must find these strips at every moment, first
    // paint included; if an overlay could cover them, the bars would sample
    // the overlay's edge (the canvas again, or black) and go dark until the
    // next re-sample. The cost is a 24px band over full-screen overlays'
    // extreme edges, which none of them puts content in.
    zIndex: 20000,
    pointerEvents: "none",
    // Smooth the hand-off when a differently-tagged section reaches the edge,
    // so Safari's tint glides instead of snapping.
    transition: "background-color 600ms ease",
  };

  // The inner two-thirds are solid (the sampler's food); the last third
  // feathers to transparent via a STATIC mask, so the strip meets the scene
  // softly and the navbar pill (which starts at 16px) emerges from a fade
  // instead of being clipped by a hard band. Masks don't interfere with the
  // background-color transition.
  const topMask = `linear-gradient(to bottom, #000 0px, #000 ${STRIP_H - 8}px, transparent ${STRIP_H}px)`;
  const bottomMask = `linear-gradient(to top, #000 0px, #000 ${STRIP_H - 8}px, transparent ${STRIP_H}px)`;

  return (
    <>
      <div
        ref={topRef}
        aria-hidden
        style={{
          ...base,
          top: 0,
          backgroundColor: TOP_DEFAULT,
          WebkitMaskImage: topMask,
          maskImage: topMask,
        }}
      />
      <div
        ref={bottomRef}
        aria-hidden
        style={{
          ...base,
          bottom: 0,
          backgroundColor: BOTTOM_DEFAULT,
          WebkitMaskImage: bottomMask,
          maskImage: bottomMask,
        }}
      />
    </>
  );
}
