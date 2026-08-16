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
 * The drawing is the reference sketch's: same 150px triangle, same alternating
 * flip, same shuffled order, same per-frame 0.15 approach to the target scale,
 * same lateral drift.
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
 * Kept deliberately low. Much more and it stops reading as a wipe between two
 * sections and starts reading as an empty section of its own, which is the one
 * thing it must not do.
 *
 * The floor is set by two things it may not overlap: the outgoing section has
 * to have cleared the viewport before the curtain starts, and the curtain has
 * to be gone before the incoming section's own entrance animations fire. Those
 * bracket a window of (SCREENS + HEADROOM − 1) screens, and the close, hold and
 * open have to fit inside it.
 */
const SCREENS = 1;
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
 * Split of the available window between closing, holding shut, and opening.
 *
 * The hold is not padding. Each triangle eases toward its target at a fixed
 * rate PER FRAME, not per pixel of scroll, so on a fast flick the fill is still
 * catching up when the scroll has already crossed the window — the hold is the
 * slack that lets it reach full cover before the curtain has to start lifting.
 * Squeeze it and a quick scroll wipes through on a partly-filled lattice.
 */
const CLOSE_SHARE = 0.36;
const HOLD_SHARE = 0.28;

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
      // is covered with no gaps; the extra two absorb the lateral drift.
      const cols = Math.ceil(cssW / (TRIANGLE_SIZE * 0.5)) + 2;
      const rows = Math.ceil(cssH / TRIANGLE_SIZE) + 1;

      const positions: { row: number; col: number }[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) positions.push({ row: r, col: c });
      }
      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }
      positions.forEach((p, i) => {
        states.set(`${p.row}-${p.col}`, {
          // (i + 1), not i, so orders run in (0, 1] rather than [0, 1). With a
          // zero the first triangle satisfies `order <= fill` even at fill 0,
          // and one square stayed lit on screen for the rest of the page.
          order: (i + 1) / positions.length,
          scale: 0,
          row: p.row,
          col: p.col,
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
      const on = fill > 0.0005 || anyFilled;
      layer.style.visibility = on ? "visible" : "hidden";
      layer.style.opacity = on ? "1" : "0";

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
    const closeTo = WINDOW_FROM + span * CLOSE_SHARE;
    const openFrom = closeTo + span * HOLD_SHARE;

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        const p = self.progress;
        fill =
          p <= WINDOW_FROM
            ? 0 // outgoing section still on screen — hands off
            : p < closeTo
              ? (p - WINDOW_FROM) / (closeTo - WINDOW_FROM)
              : p < openFrom
                ? 1 // held shut
                : p < WINDOW_TO
                  ? 1 - (p - openFrom) / (WINDOW_TO - openFrom)
                  : 0; // incoming section takes over a clear screen
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
