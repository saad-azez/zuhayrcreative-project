"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";

gsap.registerPlugin(ScrollTrigger);

/**
 * Triangle wipe — a standalone scroll transition between two sections.
 *
 * It is its OWN block of scroll, not an overlay on either neighbour. That is
 * what makes the sequence clean:
 *
 *   1. the outgoing section scrolls away in full, untouched;
 *   2. this block holds the screen — a lattice of interlocking triangles fills
 *      in one at a time in a shuffled order, holds, then empties;
 *   3. only then does the incoming section come up, so ITS OWN entrance
 *      animations play in plain sight.
 *
 * Earlier versions overlaid the neighbours and pinned the incoming section for
 * the reveal. Both neighbours suffered: the curtain shut over the outgoing
 * section before it had been read, and — worse — the incoming section's
 * scroll-triggered text animations fired while it sat hidden behind the
 * curtain, so they were over before it was uncovered. Giving the wipe its own
 * scroll is what stops it stealing either section's moment.
 *
 * The drawing is the reference's: same 150px triangle, same alternating flip,
 * same shuffled order, same per-frame 0.15 approach to the target scale, same
 * lateral drift.
 *
 * ── Matching the reference's SHAPE, not just its drawing ──
 * Two things were off, and both were about sequence rather than rendering.
 *
 * The reference establishes its lattice FIRST: the outline canvas sits behind
 * the content for the whole pin, so you watch a faint wireframe hold the screen
 * and only then see triangles start dropping into it. This drew its outlines
 * too, but the layer was hidden until the first fill, so the wireframe and the
 * fill arrived together and the lattice never got to read as a surface. There
 * is now a lead-in phase where the lattice alone holds the screen.
 *
 * And the reference never empties. It fills to full cover and stays filled —
 * the pin releases and the covered screen scrolls away, revealing the next
 * section beneath it. This used to un-fill in place, triangles retreating one
 * by one, which is a curtain opening rather than a scene being consumed. It is
 * the same lattice either way, which is why the two look so alike, but the
 * reading is the opposite. The fill is now terminal and the covered screen
 * lifts off, which is what un-pinning looks like.
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
 * Height of the block, in screens — the scroll this transition adds to the page.
 *
 * Kept low — much more and it stops reading as a wipe between two sections and
 * starts reading as an empty section of its own, which is the one thing it must
 * not do. But it was one screen, and one screen was too few: the window works
 * out to (SCREENS + HEADROOM)/(SCREENS + 1) − 1/(SCREENS + 1) of a trigger
 * range that is itself SCREENS + 1 tall, which at 1 left 0.37 of a screen —
 * about 330px of scroll — for a lead-in, a fill, a hold AND a lift. The lattice
 * phase got ~50px of that and was never actually seen. At 2 the sequence gets
 * 1.37 screens, which is still a quarter of the reference's five-screen pin but
 * enough for each phase to register.
 *
 * The floor is set by two things it may not overlap: the outgoing section has
 * to have cleared the viewport before the curtain starts, and the curtain has
 * to be gone before the incoming section's own entrance animations fire. Those
 * bracket a window of (SCREENS + HEADROOM − 1) screens, and the close, hold and
 * open have to fit inside it.
 */
const SCREENS = 2;
/**
 * How much of a screen of the incoming section may show before the curtain must
 * be gone, expressed as scroll headroom above the fold.
 *
 * Tied to a real number, not taste: ImpactSection's earliest entrance trigger is
 * `top 88%` on a heading that sits ~224px into it, so it fires once the section
 * top reaches ~568px — about 0.37 of a screen above the fold. Clearing by then
 * is what lets its text animate in plain sight. Re-check this if the incoming
 * section's own triggers change.
 */
const HEADROOM = 0.37;
/**
 * Split of the available window between the four phases, as fractions of it.
 * They must sum to 1.
 *
 *   GRID  the wireframe lattice alone, fading up over the page background —
 *         the reference's persistent outline layer, given a moment to read as
 *         a surface before anything lands in it.
 *   FILL  triangles drop in, shuffled order, to full cover.
 *   HOLD  fully covered. Not padding: each triangle eases toward its target at
 *         a fixed rate PER FRAME, not per pixel of scroll, so on a fast flick
 *         the fill is still catching up when the scroll has already crossed
 *         the window. This is the slack that lets it reach full cover before
 *         the screen has to start lifting. Squeeze it and a quick scroll lifts
 *         a half-filled lattice off the page.
 *   LIFT  the covered screen slides up and off, revealing the incoming
 *         section beneath — the reference's pin releasing.
 */
const GRID_SHARE = 0.16;
const FILL_SHARE = 0.44;
const HOLD_SHARE = 0.1;
const LIFT_SHARE = 0.3;

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
  const sectionRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { prefersReducedMotion } = useDeviceDetect();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    const section = sectionRef.current;
    const layer = layerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !section || !layer || !ctx) return;

    const states = new Map<string, TriangleState>();
    let panX = 0;
    let fill = 0;
    /** Wireframe opacity, 0–1: the lattice's own fade-up during GRID. */
    let lattice = 0;
    /** How far the covered screen has slid off, 0–1 of a viewport height. */
    let lift = 0;
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

      // Padding for the lateral drift. This used to be a flat "+2 columns" on
      // the right only, which is 2 x size/2 = 150px of cover for a drift that
      // is 200px — the rightmost column came up short of the edge at full pan.
      // Deriving it from PAN_DISTANCE, on both sides, makes it exact.
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
      const on = (lattice > 0.001 || anyFilled) && lift < 1;
      layer.style.visibility = on ? "visible" : "hidden";
      layer.style.opacity = on ? String(lattice) : "0";
      // The lift is a translate on the LAYER, not a redraw: the lattice holds
      // its shape and slides as one surface, which is what releasing a pin
      // looks like. Redrawing it at an offset would slide the triangles
      // through their own grid instead.
      layer.style.transform = lift > 0 ? `translate3d(0, ${-lift * 100}%, 0)` : "";

      if (settling) raf = requestAnimationFrame(draw);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    sizeCanvas();
    buildGrid();

    // ── The window the curtain is allowed to use ──
    //
    // The range runs from the block's top at the fold to its bottom at the top
    // of the viewport, so it spans (SCREENS + 1) screens of scroll.
    //
    //   WINDOW_FROM  the block's top has reached the top of the viewport, so
    //                the outgoing section has just cleared it — one screen in.
    //   WINDOW_TO    the incoming section is HEADROOM above the fold, the last
    //                moment before its own entrance animations start firing.
    //
    // Everything happens inside that window, so the curtain never covers either
    // neighbour's content and the page grows by only SCREENS.
    const total = SCREENS + 1;
    const WINDOW_FROM = 1 / total;
    const WINDOW_TO = (SCREENS + HEADROOM) / total;
    const span = WINDOW_TO - WINDOW_FROM;
    const gridTo = WINDOW_FROM + span * GRID_SHARE;
    const fillTo = gridTo + span * FILL_SHARE;
    const holdTo = fillTo + span * HOLD_SHARE;
    // LIFT_SHARE runs holdTo → WINDOW_TO; named so the four shares read as a
    // set even though this one is not used to derive a boundary.
    void LIFT_SHARE;

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        const p = self.progress;
        if (p <= WINDOW_FROM) {
          // Outgoing section still on screen — hands off it entirely.
          lattice = 0;
          fill = 0;
          lift = 0;
        } else if (p < gridTo) {
          lattice = (p - WINDOW_FROM) / (gridTo - WINDOW_FROM);
          fill = 0;
          lift = 0;
        } else if (p < fillTo) {
          lattice = 1;
          fill = (p - gridTo) / (fillTo - gridTo);
          lift = 0;
        } else if (p < holdTo) {
          lattice = 1;
          fill = 1;
          lift = 0;
        } else if (p < WINDOW_TO) {
          lattice = 1;
          fill = 1;
          lift = (p - holdTo) / (WINDOW_TO - holdTo);
        } else {
          // Fully lifted. The fill stays at 1 rather than being reset: the
          // reference's cover is terminal, and holding it means scrolling back
          // up re-enters the lift with the screen already covered instead of
          // having to re-fill from nothing.
          lattice = 1;
          fill = 1;
          lift = 1;
        }
        panX = -p * PAN_DISTANCE;
        schedule();
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
      trigger.kill();
    };
  }, [prefersReducedMotion]);

  return (
    <>
      {/* The block itself. Empty on purpose — it is scroll, not content, and
          the site's shared background shows through it. */}
      <div
        ref={sectionRef}
        aria-hidden
        className="w-full"
        style={{ height: `${SCREENS * 100}vh` }}
      />
      {/* Fixed, so it holds the screen while the block passes. Above the page
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
