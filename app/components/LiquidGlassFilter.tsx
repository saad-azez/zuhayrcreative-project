"use client";

import { useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════════
   The liquid in the glass.

   A plain backdrop blur is a still pane: nothing behind it moves unless
   the page does. The client's note, verbatim: "the water isn't creating
   waves, it isn't reflecting anything in the back, it's just static".
   So every glass surface now frosts the page through THIS SVG filter
   instead of a blur — the page is bent through a slow field of noise
   before it is frosted (the waves), and two lights play over that field
   and glint on its crests (the reflections). One filter, in the document
   once, and one loop that sways the field and moves the lights, so the
   whole site's glass breathes together for the cost of a few attribute
   writes a frame.

   Chromium renders SVG filters in backdrop-filter; Safari does not (it
   drops the declaration), so the filter is opted in with a class on the
   root — html.lg-liquid — and the plain blur stays as the fallback (see
   .liquid-glass in globals.css). Reduced motion keeps the refraction
   and stills it.
   ═══════════════════════════════════════════════════════════════════ */

export const LIQUID_FILTER_ID = "lg-liquid";

/* The frost inside the filter: the site's blur(18px) is stdDeviation 9
   here, and the saturation is the same 1.5. */
const FROST = 9;
const SATURATE = 1.5;

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

    const turb = document.getElementById("lg-liquid-turb");
    const drift = document.getElementById("lg-liquid-drift");
    const lightA = document.getElementById("lg-liquid-light-a");
    const lightB = document.getElementById("lg-liquid-light-b");
    if (!turb || !drift || !lightA || !lightB) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* The field sways rather than travels — a bounded drift, so the noise
       never runs off the filter region and leaves a flat edge — and its
       grain breathes a little; the two lights circle slowly, one over the
       left of a pane and one over the right, so a small control gets
       one passing over it and a wide pane gets both. */
    const set = (t: number) => {
      drift.setAttribute("dx", (18 * Math.sin(t * 0.33)).toFixed(2));
      drift.setAttribute("dy", (12 * Math.sin(t * 0.21 + 1.3)).toFixed(2));
      turb.setAttribute(
        "baseFrequency",
        `${(0.009 + 0.0015 * Math.sin(t * 0.17)).toFixed(4)} ${(0.014 + 0.002 * Math.cos(t * 0.13)).toFixed(4)}`
      );
      lightA.setAttribute("x", (70 + 90 * Math.sin(t * 0.41)).toFixed(1));
      lightA.setAttribute("y", (24 + 26 * Math.cos(t * 0.29)).toFixed(1));
      lightB.setAttribute("x", (330 + 150 * Math.sin(t * 0.23 + 2.1)).toFixed(1));
      lightB.setAttribute("y", (40 + 40 * Math.cos(t * 0.19 + 0.7)).toFixed(1));
    };

    if (reduced) {
      set(2.4);
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
      <filter
        id={LIQUID_FILTER_ID}
        x="-15%"
        y="-15%"
        width="130%"
        height="130%"
        colorInterpolationFilters="sRGB"
      >
        {/* The water: a slow, large-grained field. */}
        <feTurbulence
          id="lg-liquid-turb"
          type="fractalNoise"
          baseFrequency="0.009 0.014"
          numOctaves="2"
          seed="7"
          stitchTiles="stitch"
          result="noise"
        />
        <feOffset id="lg-liquid-drift" in="noise" dx="0" dy="0" result="field" />
        {/* The page, bent through it, then frosted and made vivid — the
            site's one texture (globals.css), in filter terms. */}
        <feDisplacementMap
          in="SourceGraphic"
          in2="field"
          scale="14"
          xChannelSelector="R"
          yChannelSelector="G"
          result="bent"
        />
        <feGaussianBlur in="bent" stdDeviation={FROST} result="frost" />
        <feColorMatrix in="frost" type="saturate" values={String(SATURATE)} result="vivid" />
        {/* Light on the water: two lights glinting off the field's crests. */}
        <feSpecularLighting
          in="field"
          surfaceScale="5"
          specularConstant="0.55"
          specularExponent="34"
          lightingColor="#ffffff"
          result="specA"
        >
          <fePointLight id="lg-liquid-light-a" x="70" y="24" z="160" />
        </feSpecularLighting>
        <feSpecularLighting
          in="field"
          surfaceScale="5"
          specularConstant="0.45"
          specularExponent="34"
          lightingColor="#ffffff"
          result="specB"
        >
          <fePointLight id="lg-liquid-light-b" x="330" y="40" z="180" />
        </feSpecularLighting>
        <feComposite in="specA" in2="specB" operator="arithmetic" k2="1" k3="1" result="spec" />
        <feComposite in="spec" in2="vivid" operator="arithmetic" k2="0.65" k3="1" />
      </filter>
    </svg>
  );
}
