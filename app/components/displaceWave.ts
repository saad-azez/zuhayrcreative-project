"use client";

/**
 * A wave that BENDS THE PAGE'S OWN PIXELS — the machinery behind the navbar
 * toggle's screen-wide wave (navRipple) and the corner dock's pond ripple
 * (createPondRipple below), shared so they are one effect at two sizes.
 *
 * It is the ripple the expanded images carry (useSplashHover) and the click
 * ripple carries (clickDisplace): a train of concentric rings that displaces
 * whatever is behind it, no colour, no highlight. clickDisplace puts a
 * `filter` on one section; this takes the other route — a fixed,
 * pointer-transparent overlay carrying a `backdrop-filter`, so the bend is
 * applied to the composited page BEHIND it, whatever is there, at the
 * compositor's cost of one overlay-sized pass a frame. The overlay is either
 * the whole viewport (the nav wave has to cross the screen) or a small box
 * about the origin (the pond is a few dozen pixels of water in a corner, and
 * a viewport-sized pass every frame for that would be the wrong trade).
 *
 * THE MAP is baked once: R/G carry the push, 128 is no push, the envelope
 * reaches zero before the bitmap's rim so its edge never seams against the
 * neutral flood around it. Each wave supplies its own envelope — where along
 * the radius its energy sits — and its own radius and amplitude schedule.
 *
 * Gated to engines that render url() in backdrop-filter (Chromium); elsewhere
 * `create` returns null and callers fall back.
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
}

export interface DisplaceWave {
  /** Fire from a viewport point; false when the engine cannot run it. */
  fire(x: number, y: number): boolean;
  dispose(): void;
}

export function createDisplaceWave(cfg: DisplaceWaveConfig): DisplaceWave | null {
  if (typeof window === "undefined") return null;
  if (!/Chrom(e|ium)|Edg\//.test(navigator.userAgent)) return null;
  if (!CSS.supports("backdrop-filter", `url(#${cfg.id})`)) return null;

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
  filter.setAttribute("id", cfg.id);
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

  // ── The overlay: the backdrop behind it, bent ──
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
    // The map's coordinates are the overlay's own: a boxed overlay is moved
    // under the origin, and the origin becomes its centre.
    let ox = x;
    let oy = y;
    if (boxed) {
      const size = cfg.box as number;
      overlay.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
      ox = size / 2;
      oy = size / 2;
    }
    const [r0, r1] = cfg.radii(x, y);
    overlay.style.display = "block";
    overlay.style.backdropFilter = `url(#${cfg.id})`;
    (overlay.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = `url(#${cfg.id})`;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / cfg.duration);
      const rad = r0 + (r1 - r0) * cfg.swell(t);
      feImg.setAttribute("x", String(ox - rad));
      feImg.setAttribute("y", String(oy - rad));
      feImg.setAttribute("width", String(rad * 2));
      feImg.setAttribute("height", String(rad * 2));
      disp.setAttribute("scale", String(cfg.amplitude * cfg.fade(1 - t)));
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

/**
 * The corner dock's pond: the click ripple's geometry (useSplashHover /
 * clickDisplace — a tight cluster of about two rings hugging the origin,
 * settling in place rather than flying outward) at the size the dock's
 * drawn rings had, from the seed box's edge out to about 70px, and a fraction
 * of the click ripple's bend, for a few dozen pixels of water. The client:
 * the drawn rings looked like the old cursor ripple; this is the wave the
 * cursor has now, in the corner.
 */
export function createPondRipple(): DisplaceWave | null {
  const R0 = 16;
  const R1 = 74;
  return createDisplaceWave({
    id: "pond-ripple",
    rings: 2.2,
    // The click ripple's envelope: strongest at the origin, gone by the rim,
    // with a hard fade at the very edge so the map never seams.
    envelope: (n) => Math.exp(-n * 2.4) * Math.min(1, (1 - n) / 0.15),
    // A little more bend than the click ripple's share would give: the
    // corner sits over the page's softest background, and a refraction only
    // shows where there is detail to bend.
    amplitude: 11,
    duration: 2200,
    radii: () => [R0, R1],
    // Quick out of the box, then it settles — the train barely travels.
    swell: (t) => 1 - Math.pow(1 - t, 2.2),
    fade: (age) => Math.pow(age, 1.4),
    box: 2 * (R1 + 12),
    // Over the dock's stage (900) so the glass is bent with the page, under
    // the navbar's band.
    zIndex: 901,
  });
}
