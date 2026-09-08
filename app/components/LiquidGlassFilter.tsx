"use client";

import { useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════════
   The liquid in the glass.

   The reference is the client's film of 27 Aug (Screen Recording
   2026-08-27 054029). Looked at properly — the window standing still,
   its interior changing by 14 grey levels a frame while the wallpaper
   beside it changed by none — its glass is not a blur: the page behind
   it is broken into a mosaic of smooth, irregular cells, each bending
   what is behind it like a lens, and the whole field drifts and morphs
   on its own. Bent hard (a trunk behind it sways by ~30px), frosted
   only lightly (its cells have crisp edges), and flowing at ~40px/s.

   So every glass surface frosts the page through THIS filter: two
   fields of fractal noise, each swaying on its own slow path, summed —
   two swaying layers morph forever without either running off the
   filter region — bend the page by 68px, then a light frost and the
   site's saturation. No lighting: every attempt to derive a highlight
   from an 8-bit noise field inside a filter rang with contour lines,
   and the film's bright edges are the bent page itself compressing at
   the cells' boundaries, which the displacement produces on its own.
   Tuned side by side against the film's frames over its own wallpaper
   in a clean-room page.

   One filter, in the document once, and one loop that sways the two
   fields, so the whole site's glass moves together. Chromium renders
   SVG filters in backdrop-filter; Safari and Firefox do not (they drop
   the declaration), so the filter is opted in with html.lg-liquid and
   the plain blur stays as their fallback (see .liquid-glass in
   globals.css). Reduced motion keeps the refraction and stills it.
   ═══════════════════════════════════════════════════════════════════ */

export const LIQUID_FILTER_ID = "lg-liquid";

function chromiumLike(): boolean {
  const ua = navigator.userAgent;
  // Chrome, Edge, Brave, Opera, Arc all carry "Chrome/"; Safari proper
  // never does. Firefox is excluded too: it does not render url() in
  // backdrop-filter either.
  return /Chrome\//.test(ua) && !/Firefox\//.test(ua);
}

export default function LiquidGlassFilter() {
  useEffect(() => {
    if (!chromiumLike() || !CSS.supports("backdrop-filter", `url(#${LIQUID_FILTER_ID})`)) {
      return;
    }
    const root = document.documentElement;
    root.classList.add("lg-liquid");

    const a = document.getElementById("lg-liquid-a");
    const b = document.getElementById("lg-liquid-b");
    if (!a || !b) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Each field sways within ±46px on incommensurate periods, so their
       sum never repeats and never settles; the peak speed of a sway is
       about the film's 40px/s. */
    const set = (t: number) => {
      a.setAttribute("dx", (40 * Math.sin(t * 0.55)).toFixed(1));
      a.setAttribute("dy", (46 * Math.sin(t * 0.7 + 1.0)).toFixed(1));
      b.setAttribute("dx", (36 * Math.sin(t * 0.43 + 2.0)).toFixed(1));
      b.setAttribute("dy", (44 * Math.cos(t * 0.61)).toFixed(1));
    };

    if (reduced) {
      set(3.1);
      return () => root.classList.remove("lg-liquid");
    }

    /* 30 frames a second is plenty for water this slow, and halves what
       every pane on the page re-filters. */
    const STEP = 1000 / 30;
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < STEP) return;
      last = now;
      set((now - t0) / 1000);
    };
    const start = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      root.classList.remove("lg-liquid");
    };
  }, []);

  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }} focusable="false">
      {/* The region reaches a full element's width beyond it on every side,
          so the fields can sway ±46px under a 52px button and still cover
          it — a field that runs out leaves a flat, shifted band. */}
      <filter
        id={LIQUID_FILTER_ID}
        x="-100%"
        y="-100%"
        width="300%"
        height="300%"
        colorInterpolationFilters="sRGB"
      >
        {/* Two fields of water, each swaying on its own path. Finer across
            than down, as the film's cells are: streaks, not spots. */}
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.006 0.018"
          numOctaves="3"
          seed="3"
          stitchTiles="stitch"
          result="na"
        />
        <feOffset id="lg-liquid-a" in="na" dx="0" dy="0" result="fa" />
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.008 0.014"
          numOctaves="3"
          seed="8"
          stitchTiles="stitch"
          result="nb"
        />
        <feOffset id="lg-liquid-b" in="nb" dx="0" dy="0" result="fb" />
        <feComposite in="fa" in2="fb" operator="arithmetic" k2="0.5" k3="0.5" result="field" />
        {/* The page, bent through the water; then the light frost and the
            site's saturation (globals.css). */}
        <feDisplacementMap
          in="SourceGraphic"
          in2="field"
          scale="68"
          xChannelSelector="R"
          yChannelSelector="G"
          result="bent"
        />
        <feGaussianBlur in="bent" stdDeviation="3.2" result="frost" />
        <feColorMatrix in="frost" type="saturate" values="1.5" />
      </filter>
    </svg>
  );
}
