"use client";

import { useEffect } from "react";

/**
 * Global water-ripple feedback layer. Every pointer press sends a wave out from
 * the cursor; an `app:splash` CustomEvent (detail {x, y}) fires a bigger brand
 * splash — used by the orbiting-gallery ("ferris wheel") expand. Mounted once
 * from the template. No-ops under reduced-motion.
 *
 * HOW: the hover effect on expanded images (useSplashHover) is a WebGL shader
 * that DISPLACES pixels — that displacement is what reads as water, and the
 * user asked for the same thing on click. A page-wide click can't run that
 * shader (there is no texture of the live DOM), but an SVG feDisplacementMap
 * filter applied to the SECTION under the cursor bends its real, live pixels —
 * text, images, canvases — with the same radial ring-train math the shader
 * uses. The displacement map is a ring pattern baked once into a canvas; the
 * ripple "travels" by scaling that map's placement outward each frame while
 * the displacement amplitude decays, exactly like the shader's age envelope.
 *
 * Scope: the filter goes on the nearest usefully-sized ancestor (roughly one
 * section), never the whole document — Lenis scrolls the real document, and
 * rasterising a 30k-px-tall element per frame would be catastrophic. Filtering
 * is gated to Chromium + fine pointers; everywhere else (and when no suitable
 * section exists under the click) it falls back to a backdrop-filter lens wave.
 */

/** Tunables, mirroring useSplashHover's SPLASH block. Units are px / ms. */
const CLICK_WAVE = {
  /** Peak pixel displacement at the moment of impact. */
  amplitude: 26,
  /** How far the wave front travels before it has fully died. */
  radius: 440,
  /** Lifetime of one click's wave. */
  duration: 820,
  /** Rings baked into the map (the shader's uFreq equivalent). */
  rings: 2.6,
  /** How tightly the ring train hugs its origin (the shader's uFalloff). */
  falloff: 3.2,
} as const;

const MAP_SIZE = 256;
const FILTER_ID = "click-ripple-displace";

export default function ClickRipple() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // ── Overlay layer: impact droplet + non-displacement fallback waves ──
    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, {
      position: "fixed",
      inset: "0",
      zIndex: "95", // under navbar (100) / cursor, over content
      pointerEvents: "none",
      overflow: "hidden",
    } as CSSStyleDeclaration);
    document.body.appendChild(layer);

    // ── Displacement map: a decaying radial ring train, baked once ──
    // R/G encode the direction each pixel is pushed (128 = no push), so
    // feDisplacementMap reproduces the shader's `normalize(d) * ring * decay`.
    // The envelope reaches zero well before the bitmap's edge so the map's
    // rim never leaves a visible seam against the neutral flood around it.
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
            const ring = Math.sin(n * Math.PI * 2 * CLICK_WAVE.rings);
            const fade =
              Math.exp(-n * CLICK_WAVE.falloff) *
              Math.min(1, (1 - n) / 0.2); // hard fade to neutral at the rim
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
    // the map's neutral 128 to ~0.22 before the displacement math, shifting
    // the ENTIRE element sideways. The flood is the same neutral so pixels
    // outside the (moving) feImage box are never displaced.
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    Object.assign(svg.style, { position: "absolute" } as CSSStyleDeclaration);
    const filter = document.createElementNS(NS, "filter");
    filter.setAttribute("id", FILTER_ID);
    filter.setAttribute("color-interpolation-filters", "sRGB");
    // Generous region so children that deliberately overhang their section
    // (the gallery's overlap layout) aren't clipped while the filter is live.
    filter.setAttribute("x", "-15%");
    filter.setAttribute("y", "-15%");
    filter.setAttribute("width", "130%");
    filter.setAttribute("height", "130%");
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

    // Section-level rasterisation per frame is a Chromium-tested cost, and an
    // unsupported url() filter can blank the element in other engines — so
    // gate hard and let everyone else have the lens-wave fallback.
    const canDisplace =
      /Chrom(e|ium)|Edg\//.test(navigator.userAgent) &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    /**
     * The element the wave runs in: the largest ancestor of the click target
     * that is still roughly one section. Too small (a button) and the wave
     * would live in a clipped box; unbounded and we'd be rasterising the whole
     * Lenis document. Ancestors only grow, so stop at the first over-cap one.
     */
    const pickTarget = (start: EventTarget | null): HTMLElement | null => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let el = start instanceof Element ? start : null;
      let best: HTMLElement | null = null;
      while (el && el !== document.body && el !== document.documentElement) {
        const r = el.getBoundingClientRect();
        if (r.height > vh * 1.6 || r.width > vw * 1.2) break;
        if (r.width >= 180 && r.height >= 180 && el instanceof HTMLElement)
          best = el;
        if (el.hasAttribute("data-scroll-container")) break;
        el = el.parentElement;
      }
      return best;
    };

    // One wave at a time: a new click hands the previous element its filter
    // back (scale is also zeroed, so even a shared frame shows no distortion).
    let active: { el: HTMLElement; prev: string; raf: number } | null = null;
    const stopActive = () => {
      if (!active) return;
      cancelAnimationFrame(active.raf);
      active.el.style.filter = active.prev;
      active = null;
      disp.setAttribute("scale", "0");
    };

    /**
     * Run one displacement wave inside `el`, origin at client (cx, cy).
     * Coordinates are element-local: primitiveUnits default to userSpaceOnUse,
     * which for a CSS-referenced filter is the element's own px space — so the
     * ripple sticks to the content even if Lenis is still gliding beneath it.
     */
    const displace = (
      el: HTMLElement,
      cx: number,
      cy: number,
      {
        amplitude = CLICK_WAVE.amplitude,
        radius = CLICK_WAVE.radius,
        duration = CLICK_WAVE.duration,
      } = {},
    ) => {
      stopActive();
      const r = el.getBoundingClientRect();
      const lx = cx - r.left;
      const ly = cy - r.top;
      const state = { el, prev: el.style.filter, raf: 0 };
      active = state;
      el.style.filter = `url(#${FILTER_ID})`;
      const t0 = performance.now();
      const frame = (now: number) => {
        if (active !== state) return;
        const t = Math.min(1, (now - t0) / duration);
        // Front eases outward; amplitude dies like the shader's byAge².
        const front = 40 + (radius - 40) * (1 - Math.pow(1 - t, 3));
        feImg.setAttribute("x", String(lx - front));
        feImg.setAttribute("y", String(ly - front));
        feImg.setAttribute("width", String(front * 2));
        feImg.setAttribute("height", String(front * 2));
        disp.setAttribute("scale", String(amplitude * Math.pow(1 - t, 1.7)));
        if (t < 1) state.raf = requestAnimationFrame(frame);
        else stopActive();
      };
      state.raf = requestAnimationFrame(frame);
    };

    // ── Fallback wave: refracting backdrop-filter annulus (non-Chromium /
    //    touch / no suitable section under the click) ──
    const wave = (
      x: number,
      y: number,
      { size = 90, scale = 6, dur = 750, blur = 3 } = {},
    ) => {
      const el = document.createElement("span");
      const mask =
        "radial-gradient(circle, transparent 52%, black 66%, black 82%, transparent 94%)";
      Object.assign(el.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${size}px`,
        height: `${size}px`,
        marginLeft: `${-size / 2}px`,
        marginTop: `${-size / 2}px`,
        borderRadius: "999px",
        background:
          "radial-gradient(circle, transparent 58%, rgba(255,255,255,0.16) 74%, transparent 90%)",
        maskImage: mask,
        WebkitMaskImage: mask,
        willChange: "transform, opacity, backdrop-filter",
      } as CSSStyleDeclaration);
      layer.appendChild(el);
      const refract = (b: number) => `blur(${b}px) brightness(1.07)`;
      el.animate(
        [
          { transform: "scale(0.12)", opacity: 1, backdropFilter: refract(blur) },
          { transform: `scale(${scale})`, opacity: 0, backdropFilter: refract(0) },
        ],
        { duration: dur, easing: "cubic-bezier(0.22,1,0.36,1)" },
      ).onfinish = () => el.remove();
    };

    // Impact droplet — tiny, fast; the one piece of feedback that shows even
    // on flat background, where displacement (like the shader) has nothing
    // visible to bend.
    const drop = (x: number, y: number, { size = 12, scale = 2.2, dur = 380 } = {}) => {
      const el = document.createElement("span");
      Object.assign(el.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${size}px`,
        height: `${size}px`,
        marginLeft: `${-size / 2}px`,
        marginTop: `${-size / 2}px`,
        borderRadius: "999px",
        background:
          "radial-gradient(circle, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 70%)",
        willChange: "transform, opacity",
      } as CSSStyleDeclaration);
      layer.appendChild(el);
      el.animate(
        [
          { transform: "scale(0.4)", opacity: 1 },
          { transform: `scale(${scale})`, opacity: 0 },
        ],
        { duration: dur, easing: "cubic-bezier(0.16,1,0.3,1)" },
      ).onfinish = () => el.remove();
    };

    const splash = (
      target: EventTarget | null,
      x: number,
      y: number,
      big: boolean,
    ) => {
      drop(x, y, big ? { size: 26, scale: 2.6, dur: 480 } : {});
      const el = canDisplace ? pickTarget(target) : null;
      if (el) {
        displace(
          el,
          x,
          y,
          big ? { amplitude: 34, radius: 560, duration: 1000 } : {},
        );
      } else {
        wave(x, y, big ? { size: 160, scale: 7, dur: 1000, blur: 4 } : {});
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      splash(e.target, e.clientX, e.clientY, false);
    };

    // Bigger brand splash on demand (orbiting-gallery expand, etc.).
    const onSplash = (e: Event) => {
      const d = (e as CustomEvent<{ x?: number; y?: number }>).detail;
      if (!d || d.x == null || d.y == null) return;
      splash(document.elementFromPoint(d.x, d.y), d.x, d.y, true);
    };

    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("app:splash", onSplash as EventListener);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("app:splash", onSplash as EventListener);
      stopActive();
      svg.remove();
      layer.remove();
    };
  }, []);

  return null;
}
