"use client";

import { SPLASH } from "./useSplashHover";

/**
 * Click ripple that BENDS THE PAGE'S OWN PIXELS, matched to the ripple the
 * expanded images already carry (useSplashHover).
 *
 * WHY THIS EXISTS SEPARATELY FROM THE WATER LAYER
 * The water cursor paints a lit surface ON TOP of the page. That is right for
 * a trail following the pointer, but it can never look like the expanded-image
 * ripple, because that effect's whole character is REFRACTION: it displaces
 * the picture's own pixels, silhouette included, with no colour and no
 * highlight at all. A full-viewport WebGL overlay has no texture of the live
 * DOM to refract, so it cannot reproduce that however it is shaded.
 *
 * An SVG feDisplacementMap can. Applied to the section under the cursor it
 * bends that section's real, live pixels — text, images, canvases — through a
 * displacement map baked from the same ring-train maths the image shader runs.
 *
 * MATCHING THE REFERENCE, precisely. useSplashHover's shader is
 *
 *     ring       = sin(dist * 26 - age * 7.5)
 *     byDistance = exp(-dist * 5.2)
 *     byAge      = 1 - age / 1.1
 *     disp      += normalize(d) * ring * byDistance * byAge^2 * 0.045
 *
 * with `dist` in the element's UV. On the ~420px-wide expanded image that puts
 * one wavelength at about 100px and drops the envelope to 7% by about 210px —
 * a TIGHT cluster of roughly two rings hugging the cursor, not a wide circle.
 * The phase term advances only ~1.3 wavelengths across the ripple's whole
 * life, so the train barely travels: it settles in place rather than flying
 * outward.
 *
 * That last point is the one that mattered. The previous click threw a single
 * ring outward across most of the screen, which is why it read as one perfect
 * round drop that was "the same, just bigger" — the reference is neither one
 * ring nor expanding. RINGS, FALLOFF and the modest RADIUS_GROWTH below are
 * that geometry carried over.
 *
 * SCOPE. The filter goes on the nearest usefully-sized ancestor (roughly one
 * section), never the document — Lenis scrolls the real document and
 * rasterising a 30k-px-tall element per frame would be catastrophic. Callers
 * get `false` back when it cannot run and can fall back.
 *
 * EVERY ENGINE, EVERY POINTER. This used to be gated to Chromium + fine
 * pointers, on the worry that a url() filter blanks elements elsewhere — so a
 * tap on a phone brought the water and never the bend. WebKit renders this
 * very filter on an element (measured in a clean room: 26.59 mean channel
 * change, the page intact), so the gate is now only whether the engine takes
 * url() in `filter` at all. What WebKit needs besides is a repaint it will not
 * skip: iOS Safari does not redraw an element whose filter still names the
 * SAME filter when only its primitives changed, so two identical filters
 * alternate every frame and the filter string itself changes.
 */

/** Reference width the shader's UV-space constants were tuned against, px. */
const REF_ELEMENT_PX = 420;
/** UV per pixel on that element — converts the shader's constants to px. */
const UV_PER_PX = 1 / REF_ELEMENT_PX;

/** Radius the baked map covers, px. Past this the envelope is under 1%. */
const MAP_RADIUS = 260;
/** Rings inside that radius: MAP_RADIUS / wavelength, wavelength = 2pi/freq. */
const RINGS = (MAP_RADIUS * SPLASH.frequency * UV_PER_PX) / (Math.PI * 2);
/** The shader's exp(-dist * 5.2), re-expressed over the map's 0..1 radius. */
const FALLOFF = SPLASH.falloff * MAP_RADIUS * UV_PER_PX;
/** Peak displacement, px — the shader's 0.045 UV on the reference element. */
const AMPLITUDE = SPLASH.amplitude * REF_ELEMENT_PX;
/** Lifetime, ms — the shader's `life`. */
const DURATION = SPLASH.life * 1000;
/**
 * How far the train travels, as a fraction of the map radius. The shader's
 * phase advances speed*life = 8.25 rad over a ripple's life, i.e. 1.31
 * wavelengths — so the rings move outward by that much and no further.
 */
const RADIUS_GROWTH =
  ((SPLASH.speed * SPLASH.life) / (Math.PI * 2) / RINGS) * 1;

const MAP_SIZE = 256;
const FILTER_ID = "click-displace-ripple";

export interface ClickDisplace {
  /** Returns false when it could not run — the caller should fall back. */
  fire(x: number, y: number, scale?: number): boolean;
  dispose(): void;
}

export function createClickDisplace(): ClickDisplace | null {
  if (typeof window === "undefined") return null;
  if (!CSS.supports("filter", `url(#${FILTER_ID})`)) return null;

  // ── The map: a decaying radial ring train, baked once ──
  // R/G encode the direction each pixel is pushed (128 = no push), so
  // feDisplacementMap reproduces `normalize(d) * ring * byDistance`. The
  // envelope reaches zero before the bitmap's edge so the map's rim never
  // leaves a seam against the neutral flood around it.
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
        const n = d / half; // 0 at origin, 1 at the bitmap edge
        let ux = 0;
        let uy = 0;
        if (d > 0.5 && n < 1) {
          const ring = Math.sin(n * Math.PI * 2 * RINGS);
          const fade =
            Math.exp(-n * FALLOFF) * Math.min(1, (1 - n) / 0.15);
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

  // ── SVG filter plumbing ──
  // sRGB interpolation is load-bearing: the default linearRGB would convert
  // the map's neutral 128 to ~0.22 before the displacement maths, shifting the
  // ENTIRE element sideways. The flood is that same neutral, so pixels outside
  // the (moving) feImage box are never displaced.
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  const mapUrl = buildMap();
  const makeFilter = (id: string) => {
    const filter = document.createElementNS(NS, "filter");
    filter.setAttribute("id", id);
    filter.setAttribute("color-interpolation-filters", "sRGB");
    // Generous region so children that deliberately overhang their section
    // aren't clipped while the filter is live.
    filter.setAttribute("x", "-15%");
    filter.setAttribute("y", "-15%");
    filter.setAttribute("width", "130%");
    filter.setAttribute("height", "130%");
    const flood = document.createElementNS(NS, "feFlood");
    flood.setAttribute("flood-color", "#808080");
    flood.setAttribute("result", "neutral");
    const feImg = document.createElementNS(NS, "feImage");
    feImg.setAttribute("href", mapUrl);
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
    return { feImg, disp };
  };
  // Two identical filters, alternated every frame (see the header).
  const ids = [FILTER_ID, `${FILTER_ID}-b`];
  const nodes = ids.map(makeFilter);
  document.body.appendChild(svg);

  /**
   * The element the ripple runs in: the largest ancestor of the click target
   * that is still roughly one section. Too small (a button) and the ripple
   * would live in a clipped box; unbounded and we would be rasterising the
   * whole Lenis document. Ancestors only grow, so stop at the first over-cap.
   */
  const pickTarget = (start: EventTarget | null): HTMLElement | null => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let el = start instanceof Element ? start : null;
    let best: HTMLElement | null = null;
    while (el && el !== document.body && el !== document.documentElement) {
      const r = el.getBoundingClientRect();
      if (r.height > vh * 1.6 || r.width > vw * 1.2) break;
      if (r.width >= 180 && r.height >= 180 && el instanceof HTMLElement && !holdsFixed(el)) {
        best = el;
      }
      if (el.hasAttribute("data-scroll-container")) break;
      el = el.parentElement;
    }
    return best;
  };

  /**
   * Never an element with a pinned or fixed descendant. A `filter` makes its
   * element the containing block for `position: fixed` descendants (a
   * browser rule, like `transform`), so for the length of the ripple those
   * are positioned from the element's corner instead of the viewport's. That
   * is what threw the gallery's pinned headline to the top of the screen on
   * a click: the click landed on ScrollTrigger's pin spacer, which is a
   * screen tall and so was the ripple's pick, and the headline pinned inside
   * it jumped by the spacer's scroll offset until the ripple ended.
   * ScrollTrigger writes the pin inline, so it can be seen from here.
   */
  const holdsFixed = (el: Element): boolean =>
    el.classList.contains("pin-spacer") ||
    !!el.querySelector('.pin-spacer, [style*="position: fixed"], [style*="position:fixed"]');

  // One ripple at a time: a new click hands the previous element its filter
  // back (scale is zeroed too, so even a shared frame shows no distortion).
  let active: { el: HTMLElement; prev: string; raf: number } | null = null;
  const stop = () => {
    if (!active) return;
    cancelAnimationFrame(active.raf);
    active.el.style.filter = active.prev;
    active = null;
    for (const n of nodes) n.disp.setAttribute("scale", "0");
  };

  const fire = (x: number, y: number, scale = 1): boolean => {
    const el = pickTarget(document.elementFromPoint(x, y));
    if (!el) return false;
    stop();
    const r = el.getBoundingClientRect();
    // Element-local: primitiveUnits default to userSpaceOnUse, which for a
    // CSS-referenced filter is the element's own px space — so the ripple
    // sticks to the content even while Lenis is still gliding beneath it.
    const lx = x - r.left;
    const ly = y - r.top;
    const state = { el, prev: el.style.filter, raf: 0 };
    active = state;
    el.style.filter = `url(#${FILTER_ID})`;
    const t0 = performance.now();
    const radius = MAP_RADIUS * scale;
    let flip = 0;
    const frame = (now: number) => {
      if (active !== state) return;
      const t = Math.min(1, (now - t0) / DURATION);
      // The train advances by RADIUS_GROWTH of its own radius and stops —
      // it settles rather than flying outward. This is the difference
      // between a ripple and an expanding circle.
      const rad = radius * (1 + RADIUS_GROWTH * t);
      // byAge², straight from the shader.
      const age = 1 - t;
      const s = String(AMPLITUDE * scale * age * age);
      for (const n of nodes) {
        n.feImg.setAttribute("x", String(lx - rad));
        n.feImg.setAttribute("y", String(ly - rad));
        n.feImg.setAttribute("width", String(rad * 2));
        n.feImg.setAttribute("height", String(rad * 2));
        n.disp.setAttribute("scale", s);
      }
      // A new filter string every frame, so iOS repaints (see the header).
      flip ^= 1;
      el.style.filter = `url(#${ids[flip]})`;
      if (t < 1) state.raf = requestAnimationFrame(frame);
      else stop();
    };
    state.raf = requestAnimationFrame(frame);
    return true;
  };

  return {
    fire,
    dispose() {
      stop();
      svg.remove();
    },
  };
}
