"use client";

/**
 * A wave that BENDS THE PAGE'S OWN PIXELS — the machinery behind the navbar
 * toggle's screen-wide wave (navRipple). It also carried the corner dock's
 * pond ripple for a while (a small box about the dock's seed), until the
 * client asked for the corner to ripple as the water layer does on a click;
 * the dock now fires FluidCursor's splash instead, and this is the nav
 * wave's alone. The config keeps its two sizes of overlay all the same.
 *
 * It is the ripple the expanded images carry (useSplashHover) and the click
 * ripple carries (clickDisplace): a train of concentric rings that displaces
 * whatever is behind it, no colour, no highlight.
 *
 * TWO ROUTES, one wave:
 *
 *   backdrop  a fixed, pointer-transparent overlay carrying a
 *             `backdrop-filter`, so the bend is applied to the composited page
 *             BEHIND it, whatever is there. Chromium only: WebKit parses
 *             url() in backdrop-filter and renders nothing (measured in a
 *             clean room — a displacement filter changed 0.00 of the page's
 *             pixels through backdrop-filter and -webkit-backdrop-filter in
 *             WebKit, 26.59 through an element filter), which is every
 *             browser on an iPhone, Chrome included.
 *
 *   element   where the backdrop route cannot run, the same filter as a plain
 *             `filter` on a TARGET element the caller names, which WebKit
 *             renders. It bends that element's own pixels, not the whole
 *             composite, so the caller picks the layer that carries the
 *             detail. Two identical filters alternate every frame: iOS
 *             Safari does not repaint an element whose filter still names the
 *             same filter when only its primitives changed (see the menu melt
 *             in Navbar), and a changed filter string is a style change it
 *             cannot serve from cache.
 *
 * THE MAP is baked once: R/G carry the push, 128 is no push, the envelope
 * reaches zero before the bitmap's rim so its edge never seams against the
 * neutral flood around it. Each wave supplies its own envelope — where along
 * the radius its energy sits — and its own radius and amplitude schedule.
 */

const MAP_SIZE = 256;

export interface DisplaceWaveConfig {
  /** Filter id — unique per wave, they share the document. */
  id: string;
  /** Rings across the map's 0..1 radius. */
  rings: number;
  /** Envelope over the map's 0..1 radius: how strong the rings are there. */
  envelope: (n: number) => number;
  /** Peak bend, px. */
  amplitude: number;
  /** How long one wave lives, ms. */
  duration: number;
  /** The train's radius at birth and at death, px, for a given origin. */
  radii: (x: number, y: number) => [number, number];
  /** Radius easing over 0..1 life, and bend easing over remaining life. */
  swell: (t: number) => number;
  fade: (age: number) => number;
  /** The overlay: the viewport, or a square of this many px about the origin. */
  box: "viewport" | number;
  zIndex: number;
  /**
   * The element route's target, read at fire time. Without one, an engine
   * that cannot run the backdrop route gets no wave at all.
   */
  target?: () => HTMLElement | null;
}

export interface DisplaceWave {
  /** Fire from a viewport point; false when the engine cannot run it. */
  fire(x: number, y: number): boolean;
  dispose(): void;
}

export function createDisplaceWave(cfg: DisplaceWaveConfig): DisplaceWave | null {
  if (typeof window === "undefined") return null;
  const backdropRoute =
    /Chrom(e|ium)|Edg\//.test(navigator.userAgent) &&
    CSS.supports("backdrop-filter", `url(#${cfg.id})`);
  const elementRoute =
    !backdropRoute && !!cfg.target && CSS.supports("filter", `url(#${cfg.id})`);
  if (!backdropRoute && !elementRoute) return null;

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
          const ring = Math.sin(n * Math.PI * 2 * cfg.rings);
          const w = ring * cfg.envelope(n);
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
  const mapUrl = buildMap();

  // ── The filter: neutral flood, the map placed per frame, the bend ──
  // sRGB interpolation is load-bearing (see clickDisplace): in linearRGB the
  // map's neutral 128 would read as a push and shift the whole screen.
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";

  const makeFilter = (id: string) => {
    const filter = document.createElementNS(NS, "filter");
    filter.setAttribute("id", id);
    filter.setAttribute("color-interpolation-filters", "sRGB");
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", "100%");
    filter.setAttribute("height", "100%");
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
  // The element route alternates two identical filters (see the header).
  const ids = elementRoute ? [cfg.id, `${cfg.id}-b`] : [cfg.id];
  const nodes = ids.map(makeFilter);
  document.body.appendChild(svg);

  // ── The overlay (backdrop route): the backdrop behind it, bent ──
  const overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  const boxed = cfg.box !== "viewport";
  Object.assign(overlay.style, {
    position: "fixed",
    ...(boxed
      ? { left: "0", top: "0", width: `${cfg.box}px`, height: `${cfg.box}px` }
      : { inset: "0" }),
    zIndex: String(cfg.zIndex),
    pointerEvents: "none",
    display: "none",
  } as Partial<CSSStyleDeclaration>);
  if (backdropRoute) document.body.appendChild(overlay);

  type WebkitStyle = CSSStyleDeclaration & { webkitBackdropFilter?: string };
  let raf = 0;
  // The element route's target, and the filter it had before the wave.
  let active: { el: HTMLElement; prevFilter: string; prevWillChange: string } | null = null;

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    for (const n of nodes) n.disp.setAttribute("scale", "0");
    if (backdropRoute) {
      overlay.style.backdropFilter = "";
      (overlay.style as WebkitStyle).webkitBackdropFilter = "";
      overlay.style.display = "none";
    }
    if (active) {
      active.el.style.filter = active.prevFilter;
      active.el.style.willChange = active.prevWillChange;
      active = null;
    }
  };

  const fire = (x: number, y: number): boolean => {
    stop();
    // The map's coordinates are the filtered box's own: a boxed overlay is
    // moved under the origin and the origin becomes its centre; an element's
    // box starts at its own top-left.
    let ox = x;
    let oy = y;
    if (backdropRoute) {
      if (boxed) {
        const size = cfg.box as number;
        overlay.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
        ox = size / 2;
        oy = size / 2;
      }
      overlay.style.display = "block";
      overlay.style.backdropFilter = `url(#${cfg.id})`;
      (overlay.style as WebkitStyle).webkitBackdropFilter = `url(#${cfg.id})`;
    } else {
      const el = cfg.target?.();
      if (!el) return false;
      active = { el, prevFilter: el.style.filter, prevWillChange: el.style.willChange };
      el.style.willChange = "filter";
    }
    const [r0, r1] = cfg.radii(x, y);
    const t0 = performance.now();
    let flip = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / cfg.duration);
      const rad = r0 + (r1 - r0) * cfg.swell(t);
      const scale = String(cfg.amplitude * cfg.fade(1 - t));
      let fx = ox;
      let fy = oy;
      if (active) {
        // Read each frame: the menu the wave runs through is still laying
        // itself out as it opens.
        const r = active.el.getBoundingClientRect();
        fx = x - r.left;
        fy = y - r.top;
      }
      for (const n of nodes) {
        n.feImg.setAttribute("x", String(fx - rad));
        n.feImg.setAttribute("y", String(fy - rad));
        n.feImg.setAttribute("width", String(rad * 2));
        n.feImg.setAttribute("height", String(rad * 2));
        n.disp.setAttribute("scale", scale);
      }
      if (active) {
        flip ^= 1;
        active.el.style.filter = `url(#${ids[flip]})`;
      }
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
