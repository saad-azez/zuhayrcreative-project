"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";

gsap.registerPlugin(ScrollTrigger);

/**
 * Pixel wipe — the scroll transition BETWEEN two landing-page sections.
 *
 * The drawing is Codrops' Pixel Transition (the `code (13)` reference): a grid
 * of solid cells that scale in on a staggered order until the screen is
 * covered, then scale back out to uncover what arrived beneath. All six of the
 * reference's demos are ported below as `VARIANTS`; each one's rows, columns,
 * transform origins, durations, eases and stagger are the demo's own numbers.
 *
 * WHAT CHANGED IN THE PORT. The reference is click-driven and time-based:
 * `overlay.show().then(() => overlay.hide())`, one full-screen cover per click.
 * Here the same cover has to ride a SEAM as the page scrolls, so the show and
 * hide tweens are laid onto a single paused timeline of unit length and the
 * timeline is scrubbed. GSAP still owns the stagger — the timeline holds the
 * reference's real `fromTo` calls — so `from: 'edges'`, the row cascade and
 * every ease behave exactly as they do in the demos.
 *
 * WHAT WAS KEPT FROM THE TRIANGLE WIPE IT REPLACES. Everything about how a
 * wipe is DRIVEN on this page, because that part was never about triangles:
 * the seam spacer, the ScrollTrigger range, the chase driver that stops the
 * wipe being stranded half-drawn when scrolling stops, the auto-scroll out of
 * the seam, and the z-60 curtain layer. See the driver comment below.
 *
 * Mounted once per seam in `app/page.tsx`, with no props — one instance IS one
 * transition, and it supplies its own inter-section gap.
 */

export type PixelWipeVariant = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Height of the seam spacer, in vh — the breathing room between the two
 * sections and the scroll the wipe rides. Bare page on purpose: it is what
 * sits under the curtain at full cover, so the uncover reveals the incoming
 * section rising over it rather than the outgoing section's tail. Unchanged
 * from the triangle wipe, whose phase geometry below is tuned against it.
 */
const GAP_VH = 75;

/**
 * Split of the wipe's scroll range — the spacer's top entering the fold to its
 * bottom reaching the viewport top — between the phases, as fractions of it.
 * They must sum to 1.
 *
 * At GAP_VH 75 the outgoing section has fully left the viewport at p ≈ 0.57
 * and the incoming one enters the fold at p ≈ 0.43, so: COVER completes at
 * 0.40, before the outgoing section finishes leaving; HOLD carries the screen
 * through that exit; UNCOVER runs 0.60 → 0.94, uncovering the incoming section
 * as it rises. LEAD and TAIL are dead margin at either end — the cells are at
 * zero scale there, so the curtain never flashes on the instant the seam
 * touches the fold, nor lingers once the incoming section owns the screen.
 */
const LEAD_SHARE = 0.06;
const COVER_SHARE = 0.34;
const HOLD_SHARE = 0.2;
const UNCOVER_SHARE = 0.34;
const TAIL_SHARE = 0.06;

const COVER_AT = LEAD_SHARE + COVER_SHARE;
const HOLD_AT = COVER_AT + HOLD_SHARE;
const UNCOVER_AT = HOLD_AT + UNCOVER_SHARE;

/**
 * The curtain's colours: the brand ramp the services and work sections run
 * on, drawn the way THEY draw it.
 *
 * The services text tunnel (WebGLTextTunnel) and the work strip's flare
 * (railTunnel) disperse through one six-stop ramp — ember, hot red, scarlet,
 * the brand red, crimson, deep maroon — kept identical stop for stop, and
 * they draw it as a CONTINUOUS gradient: a fan of samples each tinted with a
 * point along the ramp, so what shows is a smooth run from ember to maroon.
 * Handing each cell a flat pick from the six stops did not look like that;
 * the client said so. So the curtain is now the same gradient, in blocks:
 * every cell is sampled from the tunnels' own interpolation (brandChroma,
 * below — the shader's piecewise mix, in JS) at its position along the
 * wipe's travel, ember at the leading edge cooling to deep maroon at the far
 * one, with a little per-cell jitter so it still reads as pixels and not as
 * eight painted stripes. The stops are the tunnels' hex values; change one
 * there and change it here.
 *
 * The jitter is a hash of the cell's index, not a draw: the grid is rebuilt
 * on every resize, and a cell must keep its colour across that or the
 * curtain would re-tile itself whenever a phone's toolbar came and went.
 */
const BRAND_RAMP: ReadonlyArray<readonly [number, number, number]> = [
  [255, 105, 30], // c0  #FF691E  ember
  [255, 35, 15], // c1  #FF230F  hot red
  [240, 5, 18], // c2  #F00512  scarlet
  [196, 1, 13], // c3  #C4010D  brand red
  [154, 0, 31], // c4  #9A001F  crimson
  [96, 0, 38], // c5  #600026  deep maroon
];

/** The tunnels' `brandChroma(t)`: t 0..1 from ember to deep maroon. */
function brandChroma(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (BRAND_RAMP.length - 1);
  const i = Math.min(BRAND_RAMP.length - 2, Math.floor(x));
  const k = x - i;
  const a = BRAND_RAMP[i];
  const b = BRAND_RAMP[i + 1];
  const mix = (c: number) => Math.round(a[c] + (b[c] - a[c]) * k);
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
}

/** How far a cell's jitter may push it along the ramp, as a fraction of it. */
const RAMP_JITTER = 0.1;

function hash01(index: number): number {
  // A multiplicative hash with murmur3's finaliser on the end, unsigned
  // before the divide (the XOR leaves a signed value).
  let h = Math.imul(index + 1, 2654435761) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function curtainShade(
  index: number,
  columns: number,
  rows: number,
  along: Variant["ramp"],
): string {
  const row = Math.floor(index / columns);
  const col = index % columns;
  const pos =
    along === "columns"
      ? columns > 1 ? col / (columns - 1) : 0
      : rows > 1 ? row / (rows - 1) : 0;
  return brandChroma(pos + (hash01(index) - 0.5) * RAMP_JITTER);
}

/**
 * The viewport each demo's rows/columns were authored against. Cell SIZE is
 * what carries the look, not cell COUNT, so the counts are re-derived per
 * viewport from the size these imply. At 1440×900 that returns each demo's
 * own numbers exactly; on a phone it returns fewer cells of the same size
 * instead of the same cells squeezed into slivers.
 */
const REF_W = 1440;
const REF_H = 900;
/** Cell budget per wipe, so a 4K screen doesn't build a thousand of them. */
const MAX_CELLS = 360;

type StaggerBuilder = (
  rows: number,
  columns: number,
) => gsap.TweenVars["stagger"];

/** The reference's `{grid, from, each}` stagger object. */
const gridStagger =
  (from: "start" | "center" | "end" | "edges", each: number): StaggerBuilder =>
  (rows, columns) => ({ grid: [rows, columns] as [number, number], from, each });

/**
 * Demo 1's stagger FUNCTION — `0.03 * (row + random(0, 5))`. Cells fall by row
 * with enough jitter that the row edge never reads as a straight line.
 */
const rowCascade =
  (unit: number, jitter: number): StaggerBuilder =>
  (_rows, columns) =>
  (index: number) =>
    unit * (Math.floor(index / columns) + gsap.utils.random(0, jitter));

interface Step {
  transformOrigin: string;
  duration: number;
  ease: string;
  stagger: StaggerBuilder;
}

interface Variant {
  rows: number;
  columns: number;
  /** Which axis the cells scale on — the reference's scale / scaleY / scaleX. */
  axis: "both" | "y" | "x";
  /** Demo 6 animates scale alone; the rest cross-fade as well. */
  fade: boolean;
  /** Slight overscale so neighbouring cells leave no hairline between them. */
  scaleTo: number;
  /**
   * The axis the brand ramp runs along — the wipe's direction of travel, so
   * the ember leads and the maroon trails: rows for a cascade, columns for
   * a sweep.
   */
  ramp: "rows" | "columns";
  show: Step;
  hide: Step;
}

/** The six demos of the reference, verbatim (forward direction). */
const VARIANTS: Record<PixelWipeVariant, Variant> = {
  1: {
    rows: 8,
    columns: 14,
    axis: "both",
    fade: true,
    scaleTo: 1.01,
    ramp: "rows",
    show: {
      transformOrigin: "50% 0%",
      duration: 0.4,
      ease: "power3.inOut",
      stagger: rowCascade(0.03, 5),
    },
    hide: {
      transformOrigin: "50% 100%",
      duration: 0.4,
      ease: "power2",
      stagger: rowCascade(0.03, 5),
    },
  },
  2: {
    rows: 9,
    columns: 17,
    axis: "both",
    fade: true,
    scaleTo: 1.03,
    ramp: "rows",
    show: {
      transformOrigin: "50% 50%",
      duration: 0.25,
      ease: "power1.in",
      stagger: gridStagger("center", 0.025),
    },
    hide: {
      transformOrigin: "50% 50%",
      duration: 0.25,
      ease: "power1",
      stagger: gridStagger("center", 0.025),
    },
  },
  3: {
    rows: 7,
    columns: 13,
    axis: "both",
    fade: true,
    scaleTo: 1.01,
    ramp: "rows",
    show: {
      transformOrigin: "50% 50%",
      duration: 0.3,
      ease: "power1.inOut",
      stagger: gridStagger("end", 0.035),
    },
    hide: {
      transformOrigin: "50% 50%",
      duration: 0.3,
      ease: "power3",
      stagger: gridStagger("end", 0.035),
    },
  },
  4: {
    rows: 9,
    columns: 17,
    axis: "both",
    fade: true,
    scaleTo: 1.03,
    ramp: "rows",
    show: {
      transformOrigin: "50% 50%",
      duration: 0.25,
      ease: "power1.in",
      stagger: gridStagger("edges", 0.025),
    },
    hide: {
      transformOrigin: "50% 50%",
      duration: 0.25,
      ease: "power1",
      stagger: gridStagger("center", 0.025),
    },
  },
  5: {
    rows: 20,
    columns: 4,
    axis: "y",
    fade: true,
    scaleTo: 1.03,
    ramp: "rows",
    show: {
      transformOrigin: "50% 100%",
      duration: 0.3,
      ease: "power1.in",
      stagger: gridStagger("start", 0.02),
    },
    hide: {
      transformOrigin: "50% 0%",
      duration: 0.3,
      ease: "power3",
      stagger: gridStagger("start", 0.02),
    },
  },
  6: {
    rows: 6,
    columns: 11,
    axis: "x",
    fade: false,
    scaleTo: 1.01,
    ramp: "columns",
    show: {
      transformOrigin: "0% 50%",
      duration: 0.3,
      ease: "power4.in",
      stagger: gridStagger("start", 0.04),
    },
    hide: {
      transformOrigin: "100% 50%",
      duration: 0.5,
      ease: "power4",
      stagger: gridStagger("start", 0.04),
    },
  },
};

export default function PixelWipe({
  variant = 1,
}: {
  variant?: PixelWipeVariant;
}) {
  const markerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { prefersReducedMotion } = useDeviceDetect();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const marker = markerRef.current;
    const layer = layerRef.current;
    const grid = gridRef.current;
    if (!marker || !layer || !grid) return;

    const v = VARIANTS[variant];

    let cells: HTMLDivElement[] = [];
    let master: gsap.core.Timeline | null = null;
    let live = false;
    /** Wipe progress, 0–1. Survives rebuilds so a resize mid-wipe doesn't jump. */
    let t = 0;

    /**
     * Show/hide the curtain. `will-change` goes on the cells only while one is
     * playing: there are four wipes on the page and each holds a couple of
     * hundred cells for the whole session, so promoting them all permanently
     * would spend real GPU memory on curtains that are almost always down.
     */
    const setLive = (on: boolean) => {
      if (on === live) return;
      live = on;
      layer.style.visibility = on ? "visible" : "hidden";
      for (const cell of cells) {
        cell.style.willChange = on ? "transform, opacity" : "";
      }
    };

    const build = () => {
      master?.kill();
      grid.replaceChildren();
      cells = [];

      // Counts from the authored cell SIZE, so the look holds at any viewport.
      let columns = Math.max(2, Math.round(window.innerWidth / (REF_W / v.columns)));
      let rows = Math.max(2, Math.round(window.innerHeight / (REF_H / v.rows)));
      if (rows * columns > MAX_CELLS) {
        const k = Math.sqrt(MAX_CELLS / (rows * columns));
        columns = Math.max(2, Math.round(columns * k));
        rows = Math.max(2, Math.round(rows * k));
      }
      grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
      grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

      const frag = document.createDocumentFragment();
      for (let i = 0; i < rows * columns; i++) {
        const cell = document.createElement("div");
        cell.style.background = curtainShade(i, columns, rows, v.ramp);
        frag.appendChild(cell);
        cells.push(cell);
      }
      grid.appendChild(frag);

      // The reference's from/to states, per axis.
      const hidden =
        v.axis === "x" ? { scaleX: 0 } : v.axis === "y" ? { scaleY: 0 } : { scale: 0 };
      const shown =
        v.axis === "y" ? { scaleY: v.scaleTo } : { scale: v.scaleTo };

      const fromVars: gsap.TweenVars = {
        ...hidden,
        transformOrigin: v.show.transformOrigin,
      };
      const showVars: gsap.TweenVars = {
        ...shown,
        duration: v.show.duration,
        ease: v.show.ease,
        stagger: v.show.stagger(rows, columns),
      };
      const hideVars: gsap.TweenVars = {
        ...hidden,
        duration: v.hide.duration,
        ease: v.hide.ease,
        stagger: v.hide.stagger(rows, columns),
      };
      if (v.fade) {
        fromVars.opacity = 0;
        showVars.opacity = 1;
        hideVars.opacity = 0;
      }

      // Each half is built as its own timeline, then time-scaled to occupy
      // exactly its share of the unit master. That way a stagger's total
      // spread — which depends on the cell count, and so on the viewport —
      // never changes how much SCROLL the cover takes.
      const show = gsap.timeline();
      show.fromTo(cells, fromVars, showVars);
      show.timeScale(show.duration() / COVER_SHARE);

      const hide = gsap.timeline();
      hide.set(cells, { transformOrigin: v.hide.transformOrigin });
      hide.to(cells, hideVars);
      hide.timeScale(hide.duration() / UNCOVER_SHARE);

      master = gsap.timeline({ paused: true });
      master.add(show, LEAD_SHARE);
      master.add(hide, HOLD_AT);
      // Empty tail, so the master's length is exactly 1 and progress maps
      // straight onto the phase shares above.
      master.to({}, { duration: TAIL_SHARE }, UNCOVER_AT);
      master.progress(t);
    };

    /** Map wipe progress onto the curtain. */
    const setPhases = (value: number) => {
      master?.progress(gsap.utils.clamp(0, 1, value));
      // The lead and tail margins hold the cells at zero scale, so anything
      // strictly inside the range is the only thing worth compositing.
      setLive(value > 0.0004 && value < 0.9996);
    };

    build();

    // ── The driver: scroll leads, but the wipe is never stranded ──
    //
    // Carried over from the triangle wipe, where it was tuned against this
    // same seam geometry. A pure scrub freezes wherever the scroll stops — and
    // the natural place to stop is with the seam mid-viewport, which parks the
    // curtain half-lifted over the incoming section. So wipe progress `t`
    // CHASES scroll rather than copying it, and the chase target depends on
    // state:
    //
    //   scrolling down  target = max(p, t) — scroll pulls the wipe forward,
    //                   but never drags a finished wipe back onto the screen.
    //   scrolling up    target = min(p, t) — the mirror: the curtain re-drops
    //                   and replays in reverse as the seam descends.
    //   idle mid-wipe   target = a terminal. Forward to the end once the cover
    //                   is meaningfully underway, back to nothing if barely
    //                   anything had landed. A FORWARD idle completion also
    //                   carries the PAGE with it: once the curtain has played
    //                   out, the scroll glides to the incoming section's start
    //                   (via the Lenis provider's app:scroll-to), so nobody is
    //                   left parked in the seam gap looking at a sliver of a
    //                   section.
    //   seam offscreen  the scroll has left the range entirely (a fast flick)
    //                   and the curtain is now over a section's CONTENT. Clear
    //                   it by the shortest visual route at the brisker exit
    //                   speed — a reader who has arrived must never be kept
    //                   waiting behind a transition.
    //
    // Both speeds are per SECOND, not per frame, so a 144Hz display doesn't
    // run 2.4x faster than a 60Hz one. The scrolling chase is exponential
    // (tight tracking that eases in); the idle completion is LINEAR, because
    // an exponential run-out sprints through the uncover and then lingers on
    // the tail instead of giving each phase its intended share.
    const IDLE_MS = 250;
    const CHASE_PER_SEC = 5.6;
    /** Idle play-out speed: 0.5 ≈ two seconds for a full start-to-end wipe. */
    const IDLE_PLAY_PER_SEC = 0.5;
    /** Getting-out-of-the-way speed once the seam has left the viewport. */
    const EXIT_PLAY_PER_SEC = 1.2;
    /** Under this much progress an idle wipe retreats instead of completing. */
    const commitPoint = LEAD_SHARE + COVER_SHARE * 0.25;

    let p = 0;
    let dir = 1;
    let lastScroll = 0;
    // One auto-scroll per pass, re-armed once the visitor is back on the
    // outgoing side, so scrolling up and stalling again works.
    let autoScrolled = false;

    const tick = (_time: number, deltaTime: number) => {
      const idle = performance.now() - lastScroll > IDLE_MS;
      // Which side of the range the page is on: 0 while the seam is still
      // travelling the viewport, ±1 once it has left it entirely.
      const out = p >= 0.999 ? 1 : p <= 0.001 ? -1 : 0;
      if (out === -1 || p < 0.02) autoScrolled = false;
      let target: number;
      // 0 → exponential chase; > 0 → constant speed, in progress per second.
      // Targets are always true terminals, never t itself — an "already close
      // enough" rest state would park the curtain fractionally short and leave
      // it on screen forever.
      let linear = 0;
      let idleForward = false;
      if (out !== 0) {
        target = t >= 0.5 ? 1 : 0;
        linear = EXIT_PLAY_PER_SEC;
      } else if (!idle) {
        target = dir >= 0 ? Math.max(p, t) : Math.min(p, t);
      } else {
        target = t > commitPoint ? 1 : 0;
        linear = IDLE_PLAY_PER_SEC;
        idleForward = target === 1;
      }
      if (Math.abs(target - t) > 0.0004) {
        const dt = deltaTime / 1000;
        if (linear > 0) {
          const step = Math.sign(target - t) * linear * dt;
          t = Math.abs(target - t) <= Math.abs(step) ? target : t + step;
        } else {
          t += (target - t) * (1 - Math.exp(-dt * CHASE_PER_SEC));
          if (Math.abs(target - t) <= 0.0004) t = target;
        }
        setPhases(t);
        // The visitor stalled mid-transition and the wipe has played out on
        // its own — finish the JOURNEY too, so the section is only ever
        // arrived at THROUGH a completed transition.
        if (idleForward && t === 1 && !autoScrolled) {
          autoScrolled = true;
          const y = window.scrollY + marker.getBoundingClientRect().bottom;
          window.dispatchEvent(
            new CustomEvent("app:scroll-to", { detail: { target: y } }),
          );
        }
      } else if (out === 1 && t === 0) {
        // Cleared by retreating even though the scroll ended up PAST the seam
        // (the fast-flick case). Both terminals are invisible, so silently
        // re-sync to the "passed" side — otherwise scrolling back up would
        // replay the wipe from the wrong end.
        t = 1;
        setPhases(t);
      } else if (out === -1 && t === 1) {
        // The mirror: cleared forward while the scroll ended up ABOVE it.
        t = 0;
        setPhases(t);
      }
    };
    gsap.ticker.add(tick);

    const trigger = ScrollTrigger.create({
      trigger: marker,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        p = self.progress;
        dir = self.direction;
        lastScroll = performance.now();
      },
    });

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        // Cells are rebuilt from scratch, so drop the promotion flag with them.
        live = false;
        build();
        setPhases(t);
        ScrollTrigger.refresh();
      }, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      gsap.ticker.remove(tick);
      trigger.kill();
      master?.kill();
      grid.replaceChildren();
    };
  }, [prefersReducedMotion, variant]);

  return (
    <>
      {/* Seam spacer — the breathing room between the two sections, and the
          scroll the wipe rides. */}
      <div
        ref={markerRef}
        aria-hidden
        className="w-full"
        style={{ height: `${GAP_VH}vh` }}
      />
      {/* Fixed, so it holds the screen while the seam passes. Above the page
          content but below the navbar (z-100), the lightboxes (z-130) and the
          page transition (z-10000). */}
      <div
        ref={layerRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-60 invisible overflow-hidden"
      >
        <div ref={gridRef} className="absolute inset-0 grid" />
      </div>
    </>
  );
}
