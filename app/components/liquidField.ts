/* ═══════════════════════════════════════════════════════════════════
   liquidField — the geometry behind the corner dock's liquid glass.

   The reference film (Screen Recording 2026-09-08 000509) is one body
   of glass that stretches, buds, necks and pinches into two, the way a
   drop of water does. Nothing in CSS morphs like that: border-radius
   transitions can round a box, they cannot join two boxes with a neck.
   So the silhouette is computed. Each box is a rounded rectangle with a
   signed distance; the boxes are blended with an EXPONENTIAL smooth
   minimum,

       F(p) = -c * ln( sum_i exp(-d_i(p) / s_i) )

   which is exactly a metaball field with exponential falloff: F = 0
   where the sum is 1, so a lone body's outline is precisely its own
   rectangle whatever its s_i, and two bodies grow a neck that thins and
   snaps as they part — at a gap of ~1.4*s when both share a scale s,
   much sooner when one of them is crisp (small s). The scale is PER
   BODY so that a body in flight can be stringy without every resting
   pair on the sheet growing a neck along with it. F is sampled on a coarse grid,
   contoured by marching squares, smoothed, and emitted as ONE SVG path
   string that both the CSS clip-path on the frosted layer and the SVG
   lighting share. Every buffer is allocated once; a frame allocates
   nothing but the output string.
   ═══════════════════════════════════════════════════════════════════ */

export interface FieldBody {
  /** Centre. */
  x: number;
  y: number;
  /** Full width / height. Under half a pixel and the body is skipped. */
  w: number;
  h: number;
  /** Corner radius; clamped to half the smaller side. */
  r: number;
  /** Surface-wave amplitude in px — the ripples that run along a fast-
      moving body's skin in the film. Zero at rest. */
  wob: number;
  /** Goo scale in px: how far this body reaches to join a neighbour. */
  s: number;
}

/* The field's own scale, which only sets the slope of F (the zero set
   does not depend on it). Near the bodies' typical s, for well-behaved
   interpolation. */
const C = 8;

/* Marching-squares case table. Bits: TL=8 TR=4 BR=2 BL=1, set when the
   corner is INSIDE (F < 0). Edges: 0 top, 1 right, 2 bottom, 3 left.
   Each entry is a flat list of edge pairs; the two saddles (5, 10) are
   resolved at run time from the cell's centre value. */
const CASES: ReadonlyArray<ReadonlyArray<number>> = [
  [], // 0
  [3, 2], // 1  BL
  [2, 1], // 2  BR
  [3, 1], // 3  bottom row
  [0, 1], // 4  TR
  [], // 5  saddle
  [0, 2], // 6  right column
  [0, 3], // 7  all but TL
  [3, 0], // 8  TL
  [0, 2], // 9  left column
  [], // 10 saddle
  [0, 1], // 11 all but TR
  [3, 1], // 12 top row
  [1, 2], // 13 all but BR
  [3, 2], // 14 all but BL
  [], // 15
];
const SADDLE_5_IN = [0, 3, 1, 2];
const SADDLE_5_OUT = [0, 1, 2, 3];
const SADDLE_10_IN = [0, 1, 2, 3];
const SADDLE_10_OUT = [3, 0, 1, 2];

export class LiquidField {
  readonly width: number;
  readonly height: number;
  readonly cell: number;
  readonly nx: number;
  readonly ny: number;
  private readonly F: Float32Array;
  /* Edge ids: the top edge of cell (i,j) is j*nx+i; its left edge is
     nH + j*nx+i. A shared edge gets one crossing point, computed once
     per frame and stamped, so nothing needs clearing between frames. */
  private readonly nH: number;
  private readonly ex: Float32Array;
  private readonly ey: Float32Array;
  private readonly eStamp: Int32Array;
  private readonly eSeg0: Int32Array;
  private readonly eSeg1: Int32Array;
  private readonly eSegStamp: Int32Array;
  private readonly segA: Int32Array;
  private readonly segB: Int32Array;
  private readonly visited: Uint8Array;
  private readonly loop: Float32Array;
  private frame = 0;

  constructor(width: number, height: number, cell = 2) {
    this.width = width;
    this.height = height;
    this.cell = cell;
    this.nx = Math.floor(width / cell) + 1;
    this.ny = Math.floor(height / cell) + 1;
    const n = this.nx * this.ny;
    this.F = new Float32Array(n);
    this.nH = n;
    const nE = 2 * n;
    this.ex = new Float32Array(nE);
    this.ey = new Float32Array(nE);
    this.eStamp = new Int32Array(nE);
    this.eSeg0 = new Int32Array(nE);
    this.eSeg1 = new Int32Array(nE);
    this.eSegStamp = new Int32Array(nE);
    /* At most two segments per cell. */
    this.segA = new Int32Array(2 * n);
    this.segB = new Int32Array(2 * n);
    this.visited = new Uint8Array(2 * n);
    this.loop = new Float32Array(4 * n);
  }

  /**
   * Contour the bodies at time `t` (seconds; drives the surface waves).
   * Returns an SVG path string, or "" when nothing is inside.
   */
  path(bodies: ReadonlyArray<FieldBody>, t: number): string {
    this.sample(bodies, t);
    return this.contour();
  }

  private sample(bodies: ReadonlyArray<FieldBody>, t: number) {
    const { nx, ny, cell, F } = this;
    const live = bodies.filter((b) => b.w > 0.5 && b.h > 0.5);
    const nb = live.length;
    const anyWob = live.some((b) => b.wob > 0);
    for (let j = 0; j < ny; j++) {
      const py = j * cell;
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const px = i * cell;
        /* The skin wave, one evaluation per sample shared by every body
           (each scales it by its own amplitude). Two incommensurate waves
           so the surface never visibly repeats. */
        const wave = anyWob
          ? 0.6 * Math.sin(0.21 * px - 0.13 * py + 24 * t) +
            0.4 * Math.sin(0.17 * py + 0.09 * px - 19 * t)
          : 0;
        let acc = 0;
        let dmin = 1e9;
        for (let k = 0; k < nb; k++) {
          const b = live[k];
          const r = Math.min(b.r, b.w * 0.5, b.h * 0.5);
          const qx = Math.abs(px - b.x) - (b.w * 0.5 - r);
          const qy = Math.abs(py - b.y) - (b.h * 0.5 - r);
          const ox = qx > 0 ? qx : 0;
          const oy = qy > 0 ? qy : 0;
          const inner = qx > qy ? qx : qy;
          const d =
            Math.sqrt(ox * ox + oy * oy) + (inner < 0 ? inner : 0) - r + b.wob * wave;
          if (d < dmin) dmin = d;
          if (d < 6 * b.s) acc += Math.exp(-d / b.s);
        }
        F[row + i] = acc > 1e-12 ? -C * Math.log(acc) : dmin;
      }
    }
  }

  private contour(): string {
    const { nx, ny, cell, F, nH, ex, ey, eStamp, eSeg0, eSeg1, eSegStamp, segA, segB } =
      this;
    const frame = ++this.frame;
    let nSeg = 0;

    const register = (e: number, n: number) => {
      if (eSegStamp[e] !== frame) {
        eSegStamp[e] = frame;
        eSeg0[e] = n;
        eSeg1[e] = -1;
      } else {
        eSeg1[e] = n;
      }
    };
    const addSeg = (e1: number, e2: number) => {
      const n = nSeg++;
      segA[n] = e1;
      segB[n] = e2;
      register(e1, n);
      register(e2, n);
    };

    const ids = [0, 0, 0, 0];
    for (let j = 0; j < ny - 1; j++) {
      const row = j * nx;
      const py = j * cell;
      for (let i = 0; i < nx - 1; i++) {
        const a = F[row + i];
        const b = F[row + i + 1];
        const c = F[row + nx + i + 1];
        const d = F[row + nx + i];
        const code =
          (a < 0 ? 8 : 0) | (b < 0 ? 4 : 0) | (c < 0 ? 2 : 0) | (d < 0 ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const px = i * cell;
        /* Edge ids for this cell: top, right, bottom, left. */
        const eT = row + i;
        const eR = nH + row + i + 1;
        const eB = row + nx + i;
        const eL = nH + row + i;
        if (eStamp[eT] !== frame) {
          eStamp[eT] = frame;
          ex[eT] = px + (cell * a) / (a - b);
          ey[eT] = py;
        }
        if (eStamp[eR] !== frame) {
          eStamp[eR] = frame;
          ex[eR] = px + cell;
          ey[eR] = py + (cell * b) / (b - c);
        }
        if (eStamp[eB] !== frame) {
          eStamp[eB] = frame;
          ex[eB] = px + (cell * d) / (d - c);
          ey[eB] = py + cell;
        }
        if (eStamp[eL] !== frame) {
          eStamp[eL] = frame;
          ex[eL] = px;
          ey[eL] = py + (cell * a) / (a - d);
        }
        let pairs: ReadonlyArray<number>;
        if (code === 5) {
          pairs = a + b + c + d < 0 ? SADDLE_5_IN : SADDLE_5_OUT;
        } else if (code === 10) {
          pairs = a + b + c + d < 0 ? SADDLE_10_IN : SADDLE_10_OUT;
        } else {
          pairs = CASES[code];
        }
        ids[0] = eT;
        ids[1] = eR;
        ids[2] = eB;
        ids[3] = eL;
        for (let p = 0; p < pairs.length; p += 2) {
          addSeg(ids[pairs[p]], ids[pairs[p + 1]]);
        }
      }
    }
    if (nSeg === 0) return "";

    /* Walk the segments into closed loops via their shared edges, and
       emit each loop through quadratic midpoints, which rounds off the
       stair-step the grid leaves on near-axis-aligned edges. */
    const visited = this.visited;
    visited.fill(0, 0, nSeg);
    const loop = this.loop;
    let out = "";
    for (let s0 = 0; s0 < nSeg; s0++) {
      if (visited[s0]) continue;
      visited[s0] = 1;
      let n = 0;
      const startEdge = segA[s0];
      let cur = s0;
      let edge = segB[s0];
      loop[n++] = ex[startEdge];
      loop[n++] = ey[startEdge];
      while (edge !== startEdge) {
        loop[n++] = ex[edge];
        loop[n++] = ey[edge];
        const other = eSeg0[edge] === cur ? eSeg1[edge] : eSeg0[edge];
        if (other < 0 || visited[other]) break;
        visited[other] = 1;
        cur = other;
        edge = segA[other] === edge ? segB[other] : segA[other];
      }
      const count = n >> 1;
      if (count < 3) continue;
      const px = (k: number) => loop[(k % count) * 2];
      const py = (k: number) => loop[(k % count) * 2 + 1];
      const f = (v: number) => Math.round(v * 10) / 10;
      out += `M${f((px(0) + px(1)) * 0.5)} ${f((py(0) + py(1)) * 0.5)}`;
      for (let k = 1; k <= count; k++) {
        out += `Q${f(px(k))} ${f(py(k))} ${f((px(k) + px(k + 1)) * 0.5)} ${f(
          (py(k) + py(k + 1)) * 0.5
        )}`;
      }
      out += "Z";
    }
    return out;
  }
}
