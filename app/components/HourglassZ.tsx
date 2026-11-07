"use client";

import { useEffect, useRef } from "react";

/**
 * The Z logo as an hourglass — the idle countdown's timer (client, 19 Oct:
 * "the Z logo is acting as the hourglass with the pixel fill going down the
 * two halves of the logo").
 *
 * The mark is two pieces with a gap between their blades (public/
 * logo_cursor.png), which is an hourglass already: the upper piece is the top
 * bulb, the lower one the bottom, the slanted gap between the blades the
 * neck. Both are drawn as a thin outline, and filled with square pixels on a
 * grid. Over `durationMs` from when it mounts, the top empties from its
 * surface down and the bottom fills from its floor up, while a thin stream of
 * pixels falls through the neck: at the end the top is empty and the bottom
 * full. A pixel on its way out, or just landed, shows a darker half-tone
 * first, as the cells of the client's reference dissolve do (its photo goes
 * to black through grey blocks); so the surfaces flicker rather than slide.
 *
 * One 2D canvas, the size of the element, drawn every frame while it is
 * mounted (it is up for five seconds at a time).
 *
 * `refined` (the model draft, where it stands alone in the banner): finer
 * grains; the top drains with a dip forming over the neck and the bottom
 * builds as a mound, as sand does, instead of flat rows; each grain its own
 * shade of the brand's reds; and a soft glow on the falling stream.
 */

/** The two pieces, in the mark's own units (logo_cursor.png at 1932 px). */
const TOP: [number, number][] = [[297, 168], [1776, 178], [1013, 1141], [1056, 737], [56, 634]];
const BOTTOM: [number, number][] = [[917, 800], [875, 1204], [1874, 1306], [1612, 1762], [153, 1762]];
const BOX = { x0: 56, y0: 168, x1: 1874, y1: 1762 };
/** The neck: where the falling pixels run, from the top piece's floor to the bottom piece's. */
const NECK_FROM: [number, number] = [990, 745];
const NECK_TO: [number, number] = [944, 1200];

/** Rows of pixels from the mark's top to its foot: chunky, as the reference's cells are. */
const ROWS = 14;
/** How long a pixel shows the half-tone on its way out or in, ms. */
const HALF_MS = 160;
/** How long a pixel takes to fall through the neck, ms. */
const FALL_MS = 260;
/** Pixels in the falling stream at once. */
const STREAM = 4;

const RED = "#c4010d";
const HALF = "#5c0710";
const LINE = "rgba(243, 238, 238, 0.92)";
/**
 * The glass: the inside of the mark, dark, under the pixels. Without it the
 * empty part was whatever the page had behind it, often the same maroon as
 * the pixels, and full and empty read alike.
 */
const GLASS = "rgba(12, 3, 5, 0.6)";

function inside(x: number, y: number, poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** A fixed random number in 0..1 for a grid cell. */
const cellRandom = (gx: number, gy: number, k = 0) => {
  const v = Math.sin(gx * 127.1 + gy * 311.7 + k * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

interface Cell {
  gx: number;
  gy: number;
  /** When it leaves the top, or lands in the bottom, as a share of the duration. */
  at: number;
}

/**
 * The cells of each piece, in the order they go (top, highest first) or come
 * (bottom, lowest first). A little jitter on that order makes the surfaces
 * ragged, as sand is, and never a ruled line.
 */
/** Refined: grains a shade lighter or deeper than the brand red, fixed per grain. */
const SHADES = ["#dc143c", "#c4010d", "#e8475d", "#b0102a", "#d0122f"];
const ROWS_REFINED = 22;

function cellsOf(poly: [number, number][], cell: number, fromTop: boolean, end: number, refined = false) {
  const out: (Cell & { key: number })[] = [];
  for (let gy = 0; BOX.y0 + gy * cell < BOX.y1; gy++) {
    for (let gx = 0; BOX.x0 + gx * cell < BOX.x1; gx++) {
      const cx = BOX.x0 + (gx + 0.5) * cell;
      const cy = BOX.y0 + (gy + 0.5) * cell;
      if (!inside(cx, cy, poly)) continue;
      const jitter = cellRandom(gx, gy) * 2.5;
      if (!refined) {
        out.push({ gx, gy, at: 0, key: fromTop ? gy + jitter : -(gy - jitter) });
        continue;
      }
      // As sand: the top's surface dips over the neck (grains near it go a
      // layer or two early), the bottom builds up as a mound under it.
      const rows = (BOX.y1 - BOX.y0) / cell;
      const neckX = fromTop ? NECK_FROM[0] : NECK_TO[0];
      const off = Math.abs(cx - neckX) / (BOX.x1 - BOX.x0);
      const key = fromTop ? gy - (1 - off) * rows * 0.22 + jitter * 0.6 : -gy + off * rows * 0.7 + jitter * 0.6;
      out.push({ gx, gy, at: 0, key });
    }
  }
  out.sort((a, b) => a.key - b.key);
  out.forEach((c, i) => (c.at = ((i + 0.5) / out.length) * end));
  return out;
}

export default function HourglassZ({
  durationMs,
  className = "",
  refined = false,
}: {
  /** From full to empty, from when it mounts. */
  durationMs: number;
  className?: string;
  /** Finer grains, sand-like draining and piling, shaded grains, a glowing stream. */
  refined?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();

    let dpr = 1;
    let k = 1; // device px per mark unit
    let ox = 0; // where the mark's box starts in the canvas, device px
    let oy = 0;
    let cell = 1; // mark units per pixel
    let top: Cell[] = [];
    let bottom: Cell[] = [];

    const size = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // The mark fitted in, with room for the outline's half width.
      const pad = dpr;
      const bw = BOX.x1 - BOX.x0;
      const bh = BOX.y1 - BOX.y0;
      k = Math.min((canvas.width - 2 * pad) / bw, (canvas.height - 2 * pad) / bh);
      ox = (canvas.width - bw * k) / 2;
      oy = (canvas.height - bh * k) / 2;
      // Whole device pixels per cell, so the grid is crisp.
      const cellPx = Math.max(2, Math.round((bh * k) / (refined ? ROWS_REFINED : ROWS)));
      cell = cellPx / k;
      // The last pixel leaves the top a fall before the end, so it lands as
      // the time runs out; the bottom is filled by then.
      const fall = FALL_MS / durationMs;
      top = cellsOf(TOP, cell, true, 1 - fall, refined);
      bottom = cellsOf(BOTTOM, cell, false, 1 - fall, refined).map((c) => ({ ...c, at: c.at + fall }));
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    const at = ([x, y]: [number, number]) => [ox + (x - BOX.x0) * k, oy + (y - BOX.y0) * k];
    const pixel = (gx: number, gy: number, colour: string) => {
      const x = Math.round(ox + gx * cell * k);
      const y = Math.round(oy + gy * cell * k);
      const s = Math.round(cell * k);
      ctx.fillStyle = colour;
      // A device pixel's seam between them, so it reads as pixels.
      ctx.fillRect(x, y, s - 1, s - 1);
    };

    let raf = 0;
    const draw = () => {
      const ms = performance.now() - started;
      const f = Math.min(1, ms / durationMs);
      const half = HALF_MS / durationMs;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = GLASS;
      for (const poly of [TOP, BOTTOM]) {
        ctx.beginPath();
        poly.forEach((p, i) => {
          const [x, y] = at(p);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
      }

      const shade = (c: Cell) => (refined ? SHADES[Math.floor(cellRandom(c.gx, c.gy, 3) * SHADES.length)] : RED);
      // The top: still there until its moment, half-toned just before it.
      for (const c of top) {
        if (f >= c.at) continue;
        pixel(c.gx, c.gy, !still && f >= c.at - half ? HALF : shade(c));
      }
      // The bottom: there from its moment, half-toned just after it.
      for (const c of bottom) {
        if (f < c.at) continue;
        pixel(c.gx, c.gy, !still && f < c.at + half ? HALF : shade(c));
      }
      // The stream through the neck, while the top still has sand.
      if (!still && f > 0 && f < 1 - FALL_MS / durationMs) {
        const s = Math.round(cell * k);
        for (let n = 0; n < STREAM; n++) {
          const p = (ms / FALL_MS + n / STREAM) % 1;
          const [x, y] = at([
            NECK_FROM[0] + (NECK_TO[0] - NECK_FROM[0]) * p,
            NECK_FROM[1] + (NECK_TO[1] - NECK_FROM[1]) * p,
          ]);
          ctx.fillStyle = n % 2 ? RED : HALF;
          if (refined) {
            ctx.fillStyle = n % 2 ? "#e8475d" : RED;
            ctx.shadowColor = "rgba(232, 71, 93, 0.9)";
            ctx.shadowBlur = s * 1.6;
          }
          ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s - 1, s - 1);
        }
        ctx.shadowBlur = 0;
      }

      // The outline over it all: both pieces, one device-independent pixel wide.
      ctx.strokeStyle = LINE;
      ctx.lineWidth = dpr;
      ctx.lineJoin = "miter";
      for (const poly of [TOP, BOTTOM]) {
        ctx.beginPath();
        poly.forEach((p, i) => {
          const [x, y] = at(p);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
      }

      if (f < 1) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [durationMs, refined]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
