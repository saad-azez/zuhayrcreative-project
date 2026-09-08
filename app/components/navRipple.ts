"use client";

import { SPLASH } from "./useSplashHover";

/**
 * The wave that runs across the screen when the navbar toggle is clicked.
 *
 * It is the ripple the expanded images carry (useSplashHover) and the click
 * ripple carries (clickDisplace) — a train of concentric rings that BENDS THE
 * PAGE'S OWN PIXELS, no colour, no highlight — let loose across the whole
 * viewport: born at the toggle, the train swells from the button to past the
 * far corner of the screen in about a second, its bend fading as it goes, so
 * everything on screen, the menu opening over it included, is passed through
 * by the wave.
 *
 * HOW. clickDisplace puts a `filter` on one section, never the document,
 * because rasterising the whole Lenis document per frame is catastrophic.
 * The screen wave needs the whole screen, so it takes the other route: a
 * fixed, full-viewport, pointer-transparent overlay carrying a
 * `backdrop-filter` — the displacement is applied to the composited page
 * BEHIND the overlay, whatever is there (the page, the menu veil, the menu),
 * at the compositor's cost of one viewport-sized pass a frame, which the menu
 * veil's own blur already pays. The overlay sits between the veil and the
 * navbar, so the toggle itself is not bent.
 *
 * THE MAP is baked the same way as clickDisplace's: R/G carry the push, 128 is
 * no push, the envelope reaches zero before the bitmap's rim. It differs in
 * where its energy sits. The image ripple's envelope hugs the origin, which
 * is right for a splash under the cursor and wrong for a wave that has to
 * cross the screen — by mid-screen that train is a few pixels deep. Here the
 * envelope rides the FRONT: six rings, strongest in the outer third of the
 * radius with a soft tail behind, so what travels is a crest with wake, and
 * the bend eases off slowly enough to still be a wave when it leaves.
 *
 * Gated to engines that render url() in backdrop-filter (Chromium); elsewhere
 * `fire` returns false and nothing happens.
 */

const MAP_SIZE = 256;
const FILTER_ID = "nav-ripple";
/** Rings inside the map's radius. */
const RINGS = 6;
/** Where the crest sits on the map's 0..1 radius, and how wide it is. */
const FRONT = 0.72;
const FRONT_WIDTH = 0.22;
/** Peak bend, px — 1.5x the image ripple's, for the size of the thing. */
const AMPLITUDE = SPLASH.amplitude * 420 * 1.5;
/** How long the wave lives, ms. */
const DURATION = 1250;
/** The train's radius at birth and at death, as fractions of the screen's
    half-diagonal — from just outside the toggle to past the far corner. */
const R0 = 0.16;
const R1 = 1.25;

export interface NavRipple {
  /** Fire from a viewport point; false when the engine cannot run it. */
  fire(x: number, y: number): boolean;
  dispose(): void;
}

export function createNavRipple(): NavRipple | null {
  if (typeof window === "undefined") return null;
  if (!/Chrom(e|ium)|Edg\//.test(navigator.userAgent)) return null;
  if (!CSS.supports("backdrop-filter", `url(#${FILTER_ID})`)) return null;

  const buildMap = (): string => {
    const c = document.createElement("canvas");
    c.width = c.height = MAP_SIZE;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(MAP_SIZE, MAP_SIZE);
    const half = MAP_SIZE / 2;
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const dx = x - half + 0.5;
        const dy = y - half + 0.5;
        const d = Math.hypot(dx, dy);
        const n = d / half;
        let ux = 0;
        let uy = 0;
        if (d > 0.5 && n < 1) {
          const ring = Math.sin(n * Math.PI * 2 * RINGS);
          // The crest: a bell about FRONT, with a longer tail behind it than
          // ahead, and a hard fade to nothing at the rim.
          const u = (n - FRONT) / (n < FRONT ? FRONT_WIDTH * 1.8 : FRONT_WIDTH);
          const fade = Math.exp(-u * u) * Math.min(1, (1 - n) / 0.1);
          const w = ring * fade;
          ux = (dx / d) * w;
          uy = (dy / d) * w;
        }
        const i = (y * MAP_SIZE + x) * 4;
        img.data[i] = Math.round(128 + 127 * ux);
        img.data[i + 1] = Math.round(128 + 127 * uy);
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  };

  // ── The filter: neutral flood, the map placed per frame, the bend ──
  // sRGB interpolation is load-bearing (see clickDisplace): in linearRGB the
  // map's neutral 128 would read as a push and shift the whole screen.
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  const filter = document.createElementNS(NS, "filter");
  filter.setAttribute("id", FILTER_ID);
  filter.setAttribute("color-interpolation-filters", "sRGB");
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");
  const flood = document.createElementNS(NS, "feFlood");
  flood.setAttribute("flood-color", "#808080");
  flood.setAttribute("result", "neutral");
  const feImg = document.createElementNS(NS, "feImage");
  feImg.setAttribute("href", buildMap());
  feImg.setAttribute("preserveAspectRatio", "none");
  feImg.setAttribute("result", "ring");
  const comp = document.createElementNS(NS, "feComposite");
  comp.setAttribute("in", "ring");
  comp.setAttribute("in2", "neutral");
  comp.setAttribute("operator", "over");
  comp.setAttribute("result", "map");
  const disp = document.createElementNS(NS, "feDisplacementMap");
  disp.setAttribute("in", "SourceGraphic");
  disp.setAttribute("in2", "map");
  disp.setAttribute("scale", "0");
  disp.setAttribute("xChannelSelector", "R");
  disp.setAttribute("yChannelSelector", "G");
  filter.append(flood, feImg, comp, disp);
  svg.appendChild(filter);
  document.body.appendChild(svg);

  // ── The overlay: the screen's backdrop, bent ──
  const overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "95", // over the menu veil (90), under the navbar (100)
    pointerEvents: "none",
    display: "none",
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(overlay);

  let raf = 0;
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    disp.setAttribute("scale", "0");
    overlay.style.backdropFilter = "";
    (overlay.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = "";
    overlay.style.display = "none";
  };

  const fire = (x: number, y: number): boolean => {
    stop();
    const half = Math.hypot(window.innerWidth, window.innerHeight) / 2;
    overlay.style.display = "block";
    overlay.style.backdropFilter = `url(#${FILTER_ID})`;
    (overlay.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = `url(#${FILTER_ID})`;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION);
      // The train swells at a wave's near-steady pace, easing only at the
      // end, and its bend eases off slowly — still most of itself at
      // mid-screen, gone as it leaves.
      const e = 1 - Math.pow(1 - t, 1.6);
      const rad = half * (R0 + (R1 - R0) * e);
      feImg.setAttribute("x", String(x - rad));
      feImg.setAttribute("y", String(y - rad));
      feImg.setAttribute("width", String(rad * 2));
      feImg.setAttribute("height", String(rad * 2));
      const age = 1 - t;
      disp.setAttribute("scale", String(AMPLITUDE * Math.pow(age, 0.7)));
      if (t < 1) raf = requestAnimationFrame(frame);
      else stop();
    };
    raf = requestAnimationFrame(frame);
    return true;
  };

  return {
    fire,
    dispose() {
      stop();
      svg.remove();
      overlay.remove();
    },
  };
}
