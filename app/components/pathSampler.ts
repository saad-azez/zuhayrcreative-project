/**
 * Points along an SVG path at even arc-length steps — the table the stroke
 * wipe paints from (PixelWipe, strokePaint) — without asking the browser for
 * each one.
 *
 * `SVGGeometryElement.getPointAtLength` re-walks the whole path on every
 * call, and Blink's walk subdivides each curve finely: on the wipe's
 * squiggle it measured 225µs a call, and the table needs one call every
 * three units of a 4000-unit path. That was a 300ms synchronous block on a
 * fast machine — 1.2 s at a phone's speed — spent at mount, under the
 * loading curtain, on every visit (it was the largest single task of the
 * first load).
 *
 * The path is eight cubic Béziers. Flattening them here costs under a
 * millisecond, and the samples are checked against the browser's within a
 * hundredth of a unit (see the validation in the commit that added this).
 * The browser's own total length is still used as the scale: the dash
 * offsets that DrawSVG hands the painter are in the browser's units, so the
 * table is stretched to match them exactly at both ends.
 *
 * Returns null for a path with commands this does not handle (arcs, or
 * anything relative); the caller then falls back to the browser.
 */

export type PathSamples = { px: Float32Array; py: Float32Array; n: number };

/** Sub-steps per curve segment for the arc-length table. */
const SUBDIV = 400;

type Cubic = [number, number, number, number, number, number, number, number];

/** Absolute M / L / C / Z only — the commands the reference path uses. */
function parseCubics(d: string): Cubic[] | null {
  const tokens = d.match(/[MLCZmlcz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) return null;
  const segs: Cubic[] = [];
  let cmd = "";
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let i = 0;
  const num = () => {
    const v = Number(tokens[i++]);
    if (!Number.isFinite(v)) throw new Error("bad number");
    return v;
  };
  try {
    while (i < tokens.length) {
      const t = tokens[i];
      if (/[A-Za-z]/.test(t)) {
        cmd = t;
        i++;
        if (cmd === "Z" || cmd === "z") {
          if (x !== sx || y !== sy) segs.push([x, y, x, y, sx, sy, sx, sy]);
          x = sx;
          y = sy;
          continue;
        }
      }
      if (cmd === "M") {
        x = num();
        y = num();
        sx = x;
        sy = y;
        cmd = "L"; // further pairs after M are implicit lineto
      } else if (cmd === "L") {
        const nx = num();
        const ny = num();
        segs.push([x, y, x, y, nx, ny, nx, ny]);
        x = nx;
        y = ny;
      } else if (cmd === "C") {
        const c1x = num();
        const c1y = num();
        const c2x = num();
        const c2y = num();
        const nx = num();
        const ny = num();
        segs.push([x, y, c1x, c1y, c2x, c2y, nx, ny]);
        x = nx;
        y = ny;
      } else {
        return null; // relative or unsupported command
      }
    }
  } catch {
    return null;
  }
  return segs.length ? segs : null;
}

/**
 * @param d          the path data
 * @param step       arc-length spacing of the samples, in path units
 * @param totalLength the browser's `getTotalLength()`, which the table is
 *                   scaled to so its units agree with DrawSVG's dash offsets
 */
export function samplePath(d: string, step: number, totalLength: number): PathSamples | null {
  const segs = parseCubics(d);
  if (!segs || !(totalLength > 0) || !(step > 0)) return null;

  // One flattened polyline for the whole path, with cumulative lengths.
  const count = segs.length * SUBDIV + 1;
  const fx = new Float64Array(count);
  const fy = new Float64Array(count);
  const fl = new Float64Array(count);
  let k = 0;
  let len = 0;
  fx[0] = segs[0][0];
  fy[0] = segs[0][1];
  fl[0] = 0;
  k = 1;
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of segs) {
    let lx = x0;
    let ly = y0;
    for (let j = 1; j <= SUBDIV; j++) {
      const t = j / SUBDIV;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const e = t * t * t;
      const x = a * x0 + b * x1 + c * x2 + e * x3;
      const y = a * y0 + b * y1 + c * y2 + e * y3;
      len += Math.hypot(x - lx, y - ly);
      fx[k] = x;
      fy[k] = y;
      fl[k] = len;
      lx = x;
      ly = y;
      k++;
    }
  }
  if (!(len > 0)) return null;

  // The browser's length is the scale the painter works in.
  const scale = len / totalLength;
  const n = Math.max(2, Math.ceil(totalLength / step) + 1);
  const px = new Float32Array(n);
  const py = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const want = Math.min(len, Math.min(totalLength, i * step) * scale);
    while (j < count - 2 && fl[j + 1] < want) j++;
    const l0 = fl[j];
    const l1 = fl[j + 1];
    const u = l1 > l0 ? (want - l0) / (l1 - l0) : 0;
    px[i] = fx[j] + (fx[j + 1] - fx[j]) * u;
    py[i] = fy[j] + (fy[j + 1] - fy[j]) * u;
  }
  return { px, py, n };
}
