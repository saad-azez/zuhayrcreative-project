"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";

gsap.registerPlugin(ScrollTrigger);

/**
 * Triangle wipe — a scroll transition BETWEEN two sections.
 *
 * The component renders a GAP_VH-tall spacer at the seam between the outgoing
 * and incoming sections — a stretch of bare page that is both the sections'
 * breathing room and what makes the reveal honest: with no gap, the screen
 * under the curtain at full cover was still mostly the OUTGOING section, so
 * the un-fill handed back the section just left. With it, the cover happens
 * over the gap and the un-fill uncovers the incoming section arriving beneath.
 * The sequence plays across the spacer's whole travel through the viewport
 * (its top entering the fold to its bottom reaching the viewport top, i.e. the
 * incoming section filling the screen):
 *
 *   1. as the outgoing section's tail scrolls up, a faint wireframe lattice
 *      fades up over it — the transition announcing itself;
 *   2. triangles drop into the lattice in a shuffled order until the screen is
 *      covered, consuming the outgoing section;
 *   3. the triangles retreat again — each shrinking back to the outline it
 *      started as — uncovering the incoming section as it rises into the
 *      viewport, and the wireframe lattice fades away last.
 *
 * Scroll leads the sequence but can never strand it: if scrolling stops
 * mid-wipe, the wipe finishes on its own — playing forward to the end once
 * the fill is underway, or retreating if only the lattice had shown. See the
 * driver comment below.
 *
 * (An earlier version gave the wipe its own 2-screen block of empty scroll so
 * it never overlapped either neighbour. That kept both sections' entrances
 * pristine but made the wipe read as an empty section of its own — the page
 * held on a blank screen between the two. Riding the seam instead means the
 * curtain does cover the neighbours' edges while it plays: that is what a
 * transition between sections is.)
 *
 * The drawing is the reference's: same 150px triangle, same alternating flip,
 * same shuffled order, same per-frame 0.15 approach to the target scale, same
 * lateral drift.
 */

const TRIANGLE_SIZE = 150;
const LINE_WIDTH = 1;
/** Below this, a triangle is still "empty" and draws as an outline. */
const SCALE_THRESHOLD = 0.01;
/** Per-frame approach to the target scale — the softness of each pop. */
const EASE_PER_FRAME = 0.15;
/** How far the lattice drifts sideways across the whole wipe, in px. */
const PAN_DISTANCE = 200;

/**
 * Height of the seam spacer, in vh — the breathing room between the two
 * sections. Enough that the un-fill reveals the incoming section (plus a
 * little bare page above it) rather than the outgoing section's tail; kept
 * under a screen so it never reads as an empty section of its own.
 */
const GAP_VH = 75;

/**
 * Split of the wipe's scroll range — the spacer's top entering the fold to
 * its bottom reaching the viewport top — between the five phases, as
 * fractions of it. They must sum to 1.
 *
 * Tuned against the geometry that range implies (at GAP_VH 75 the outgoing
 * section has fully left the viewport at p ≈ 0.57, and the incoming one
 * enters the fold at p ≈ 0.43): the cover is complete before the outgoing
 * section finishes leaving, the hold carries it through that exit, and the
 * un-fill then uncovers the incoming section rising up the screen.
 *
 *   GRID    the wireframe lattice alone, fading up over the outgoing
 *           section's tail — given a moment to read as a surface before
 *           anything lands.
 *   FILL    triangles drop in, shuffled order, to full cover.
 *   HOLD    fully covered. Not padding: each triangle eases toward its target
 *           at a fixed rate PER FRAME, not per pixel of scroll, so on a fast
 *           flick the fill is still catching up when the scroll has already
 *           crossed the phase. This is the slack that lets it reach full
 *           cover before the un-fill starts.
 *   UNFILL  the triangles retreat in reverse order, each shrinking back to
 *           the outline it started as, uncovering the incoming section.
 *   FADE    the wireframe lattice dissolves, ending the wipe on the bare
 *           incoming section.
 */
const GRID_SHARE = 0.14;
const FILL_SHARE = 0.3;
const HOLD_SHARE = 0.16;
const UNFILL_SHARE = 0.28;
const FADE_SHARE = 0.12;

const OUTLINE_STYLE = "rgba(255, 255, 255, 0.075)";
/** Brand crimson, in place of the reference's orange. Opaque — it is a curtain. */
const FILL_STYLE = "#c4010d";

interface TriangleState {
  order: number;
  scale: number;
  row: number;
  col: number;
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fillScale: number,
  flipped: boolean,
) {
  const half = TRIANGLE_SIZE / 2;

  const trace = () => {
    ctx.beginPath();
    if (!flipped) {
      ctx.moveTo(x, y - half);
      ctx.lineTo(x + half, y + half);
      ctx.lineTo(x - half, y + half);
    } else {
      ctx.moveTo(x, y + half);
      ctx.lineTo(x + half, y - half);
      ctx.lineTo(x - half, y - half);
    }
    ctx.closePath();
  };

  if (fillScale < SCALE_THRESHOLD) {
    trace();
    ctx.strokeStyle = OUTLINE_STYLE;
    ctx.lineWidth = LINE_WIDTH;
    ctx.stroke();
    return;
  }

  // Scale about the triangle's own centre so it blooms in place.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(fillScale, fillScale);
  ctx.translate(-x, -y);
  trace();
  ctx.fillStyle = FILL_STYLE;
  ctx.strokeStyle = FILL_STYLE;
  ctx.lineWidth = LINE_WIDTH;
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

export default function TriangleWipe() {
  const markerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { prefersReducedMotion } = useDeviceDetect();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    const marker = markerRef.current;
    const layer = layerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !marker || !layer || !ctx) return;

    const states = new Map<string, TriangleState>();
    let panX = 0;
    let fill = 0;
    /** Wireframe opacity, 0–1: the lattice's fade-up (GRID) and -out (FADE). */
    let lattice = 0;
    let raf = 0;
    let cssW = 0;
    let cssH = 0;

    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = window.innerWidth;
      cssH = window.innerHeight;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      // setTransform, not scale: this runs again on every resize, and `scale`
      // would compound onto the transform the previous pass left behind.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const buildGrid = () => {
      states.clear();
      // Columns step by half a triangle so neighbours interlock and the plane
      // is covered with no gaps.
      const cols = Math.ceil(cssW / (TRIANGLE_SIZE * 0.5));
      const rows = Math.ceil(cssH / TRIANGLE_SIZE) + 1;

      // Padding for the lateral drift, derived from PAN_DISTANCE on both
      // sides so the edge columns still cover the screen at full pan.
      const pad = Math.ceil(Math.abs(PAN_DISTANCE) / (TRIANGLE_SIZE * 0.5)) + 1;

      const positions: { row: number; col: number }[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = -pad; c < cols + pad; c++) positions.push({ row: r, col: c });
      }
      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }

      positions.forEach((q, i) => {
        states.set(`${q.row}-${q.col}`, {
          // (i + 1), not i, so orders run in (0, 1] rather than [0, 1). With a
          // zero the first triangle satisfies `order <= fill` even at fill 0,
          // and one square stayed lit on screen for the rest of the page.
          order: (i + 1) / positions.length,
          scale: 0,
          row: q.row,
          col: q.col,
        });
      });
    };

    const draw = () => {
      raf = 0;
      ctx.clearRect(0, 0, cssW, cssH);

      let settling = false;
      let anyFilled = false;

      states.forEach((s) => {
        if (s.scale < 1) {
          const x = s.col * (TRIANGLE_SIZE * 0.5) + TRIANGLE_SIZE / 2 + panX;
          const y = s.row * TRIANGLE_SIZE + TRIANGLE_SIZE / 2;
          drawTriangle(ctx, x, y, 0, (s.row + s.col) % 2 !== 0);
        }
      });

      states.forEach((s) => {
        const target = s.order <= fill ? 1 : 0;
        const next = s.scale + (target - s.scale) * EASE_PER_FRAME;
        if (Math.abs(next - s.scale) > 0.001) {
          s.scale = next;
          settling = true;
        }
        if (s.scale >= SCALE_THRESHOLD) {
          anyFilled = true;
          const x = s.col * (TRIANGLE_SIZE * 0.5) + TRIANGLE_SIZE / 2 + panX;
          const y = s.row * TRIANGLE_SIZE + TRIANGLE_SIZE / 2;
          drawTriangle(ctx, x, y, s.scale, (s.row + s.col) % 2 !== 0);
        }
      });

      // Visibility follows what is actually ON the canvas rather than which
      // trigger claims to be active — at the boundaries of a range there are
      // frames where no trigger reports active and the curtain would blink out.
      // `anyFilled` keeps it up while triangles are still easing back down on a
      // reverse scroll, after the phase maths has already zeroed the lattice.
      const on = lattice > 0.001 || anyFilled;
      layer.style.visibility = on ? "visible" : "hidden";
      layer.style.opacity = on ? String(lattice) : "0";

      if (settling) raf = requestAnimationFrame(draw);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    sizeCanvas();
    buildGrid();

    // Phase boundaries across the wipe's range: the spacer's top entering the
    // fold (p=0) to its bottom reaching the viewport top (p=1) — the moment
    // the incoming section fills the screen.
    const gridTo = GRID_SHARE;
    const fillTo = gridTo + FILL_SHARE;
    const holdTo = fillTo + HOLD_SHARE;
    const unfillTo = holdTo + UNFILL_SHARE;
    // FADE_SHARE runs unfillTo → 1; named so the five shares read as a set
    // even though this one is not used to derive a boundary.
    void FADE_SHARE;

    /** Map wipe progress `v` (0–1) onto the phase variables. */
    const setPhases = (v: number) => {
      if (v <= 0) {
        lattice = 0;
        fill = 0;
      } else if (v < gridTo) {
        lattice = v / gridTo;
        fill = 0;
      } else if (v < fillTo) {
        lattice = 1;
        fill = (v - gridTo) / (fillTo - gridTo);
      } else if (v < holdTo) {
        lattice = 1;
        fill = 1;
      } else if (v < unfillTo) {
        lattice = 1;
        fill = 1 - (v - holdTo) / (unfillTo - holdTo);
      } else if (v < 1) {
        lattice = 1 - (v - unfillTo) / (1 - unfillTo);
        fill = 0;
      } else {
        lattice = 0;
        fill = 0;
      }
      panX = -v * PAN_DISTANCE;
    };

    // ── The driver: scroll leads, but the wipe is never stranded ──
    //
    // A pure scrub freezes wherever the scroll stops — and the natural place
    // to stop is with the seam mid-viewport, which left the curtain parked
    // half-lifted over the incoming section ("it doesn't end"). So the wipe
    // progress `t` CHASES scroll rather than copying it, and the chase target
    // depends on state:
    //
    //   scrolling down  target = max(p, t) — scroll pulls the wipe forward,
    //                   but never drags a finished wipe back onto the screen
    //                   when the auto-finish has run ahead of the scrollbar;
    //   scrolling up    target = min(p, t) — the mirror: the curtain smoothly
    //                   re-drops and replays in reverse as the seam descends;
    //   idle mid-wipe   target = a terminal. Forward through the un-fill to
    //                   the end once the fill is meaningfully underway, back
    //                   to nothing if only the lattice (or the first few
    //                   triangles) had shown. A FORWARD idle completion also
    //                   carries the PAGE with it: the visitor stopped in the
    //                   middle of a transition, so once the curtain has played
    //                   out the scroll glides to the incoming section's start
    //                   (via the Lenis provider's app:scroll-to). Nobody is
    //                   left parked in the seam gap looking at a sliver of a
    //                   section — the content is only ever arrived at THROUGH
    //                   the transition.
    //   seam offscreen  the scroll has left the wipe's range entirely (a fast
    //                   flick), so the curtain is now playing over a section's
    //                   CONTENT. Clear it by the shortest visual route, at the
    //                   brisker exit speed — the wipe is a transition, and a
    //                   reader who has already arrived must never be kept
    //                   waiting behind it.
    //
    // Both speeds are per SECOND, not per frame — a 144Hz display would
    // otherwise run 2.4x faster than a 60Hz one. The scrolling chase is
    // exponential (tight tracking that eases in), but the idle completion is
    // LINEAR: an exponential run-out sprints through the un-fill and then
    // lingers on the fade, while a constant speed gives every phase its
    // intended share of the play-out.
    const IDLE_MS = 250;
    const CHASE_PER_SEC = 5.6;
    /** Idle play-out speed: 0.5 ≈ two seconds for a full start-to-end wipe. */
    const IDLE_PLAY_PER_SEC = 0.5;
    /** Getting-out-of-the-way speed once the seam has left the viewport. */
    const EXIT_PLAY_PER_SEC = 1.2;
    /** Under this much progress an idle wipe retreats instead of completing. */
    const commitPoint = gridTo + (fillTo - gridTo) * 0.25;

    let p = 0;
    let dir = 1;
    let lastScroll = 0;
    let t = 0;
    // One auto-scroll per pass through the wipe — re-armed once the visitor
    // is back on the outgoing side, so scrolling up and stalling again works.
    let autoScrolled = false;

    const tick = (_time: number, deltaTime: number) => {
      const idle = performance.now() - lastScroll > IDLE_MS;
      // Which side of the wipe's range the page is on: 0 while the seam is
      // still travelling the viewport, ±1 once it has left it entirely.
      const out = p >= 0.999 ? 1 : p <= 0.001 ? -1 : 0;
      if (out === -1 || p < 0.02) autoScrolled = false;
      let target: number;
      // 0 → exponential chase; > 0 → constant speed, in progress per second.
      // Targets are always true terminals (0 or 1), never t itself — an
      // "already close enough" rest state would park the wipe fractionally
      // short and leave the layer sitting on screen forever.
      let linear = 0;
      // Idle completion in the forward direction, with the page still resting
      // inside the wipe's range: the case that must also move the SCROLL.
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
        schedule();
        // The visitor stalled mid-transition and the wipe has now played out
        // to its end on its own — finish the JOURNEY too: glide the page to
        // the incoming section's start (the marker's bottom at the viewport
        // top, i.e. p = 1). The section is only ever seen through a completed
        // transition, never from a resting spot inside the seam gap.
        if (idleForward && t === 1 && !autoScrolled) {
          autoScrolled = true;
          const y = window.scrollY + marker.getBoundingClientRect().bottom;
          window.dispatchEvent(
            new CustomEvent("app:scroll-to", { detail: { target: y } }),
          );
        }
      } else if (out === 1 && t === 0) {
        // Cleared by retreating even though the scroll ended up PAST the
        // seam (the fast-flick case). Both terminals are invisible, so
        // silently re-sync to the "passed" side — otherwise scrolling back
        // up would replay the wipe from the wrong end.
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
        sizeCanvas();
        buildGrid();
        schedule();
        ScrollTrigger.refresh();
      }, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      if (raf) cancelAnimationFrame(raf);
      gsap.ticker.remove(tick);
      trigger.kill();
    };
  }, [prefersReducedMotion]);

  return (
    <>
      {/* Seam spacer — the breathing room between the two sections, and the
          scroll the wipe rides. Bare page on purpose: it is what sits under
          the curtain at full cover, so the un-fill reveals the incoming
          section rising over it rather than the outgoing section's tail. */}
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
        className="pointer-events-none fixed inset-0 z-60 invisible opacity-0"
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </>
  );
}
