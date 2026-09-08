"use client";

import { useEffect, useRef } from "react";
import "@/app/styles/email-plane.css";

/**
 * One paper plane, flying past above the footer's email address.
 *
 * The reference (Screen Recording 2026-08-25 182057) is a set of folded paper
 * darts drawn as line art — white paper, a thin dark outline on every edge,
 * the facets shaded a shade apart so the fold reads — seen in 3D, turning so
 * that one moment you look down on the wings and the next you see the keel
 * from behind, each with a soft shadow on the ground beneath it. The client
 * asked for one of those, flying by "in an organic manner" above the address,
 * on every width. So: a real dart in 3D, projected into an SVG each frame, on
 * a gliding path built from a few slow sine harmonics so that no two passes
 * are quite the same and nothing in it is a straight line or a fixed angle.
 *
 * The earlier version drew flat red arrow glyphs on CSS 3D transforms — the
 * flock orbited the whole cell, crossed the tagline above, and on a phone was
 * a 14px speck threaded above the label. None of that is the reference.
 *
 * Drawn rather than transformed: the plane is three triangles sharing a nose,
 * and drawing their projections lets every edge be a crisp 1px line and every
 * facet take its own light, which CSS 3D (one bitmap per face, no outlines,
 * no shading) cannot do. The cost is six path `d` writes a frame while a pass
 * is in flight, and nothing at all between passes or off screen.
 */

/** Length of the dart on screen, px — sized with the address's font. */
const SIZE_DESKTOP = 48;
const SIZE_PHONE = 36;
/** One pass, ms, and the pause before the next. */
const FLIGHT_MS = 3800;
const GAP_MS = 2400;

/**
 * The dart, in its own frame: x forward (nose at +1), y to the left wingtip,
 * z up. A classic dart — two wings from the nose to the tail corners, with a
 * little dihedral, and a keel dropping below the spine. Proportions read off
 * the reference's broadside frames: a wingspan 0.62 of the length, the keel
 * a third as deep as the wings are wide.
 */
type V3 = readonly [number, number, number];
const NOSE: V3 = [1, 0, 0];
const WING_L: V3 = [-1, 0.62, 0.14];
const WING_R: V3 = [-1, -0.62, 0.14];
const KEEL_TOP: V3 = [-1, 0, 0.02];
const KEEL_BOT: V3 = [-1, 0, -0.36];
/** Facets, as triangles. The keel is one triangle seen from either side. */
const FACETS: readonly (readonly [V3, V3, V3])[] = [
  [NOSE, WING_L, KEEL_TOP],
  [NOSE, KEEL_TOP, WING_R],
  [NOSE, KEEL_BOT, KEEL_TOP],
];

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Light from above and a little in front of the camera (screen space:
    x right, y down, z toward the viewer). */
const LIGHT = norm([-0.35, -0.85, 0.5]);

/**
 * The flight. Screen space, in the band (W by H). Left to right, on a glide
 * with the long slow rise-and-dive a paper dart actually flies (a phugoid)
 * and a smaller wobble on it, weaving a little toward and away from the
 * viewer so that its facets turn to the light. Each pass gets its own
 * phases, so each is its own flight.
 */
interface Pass {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
}
function newPass(): Pass {
  const r = () => Math.random() * Math.PI * 2;
  return { p1: r(), p2: r(), p3: r(), p4: r(), p5: r() };
}
const TAU = Math.PI * 2;
function pathAt(t: number, W: number, H: number, k: Pass): V3 {
  // Ground speed eases a touch: a dart slows at the top of a rise and gathers
  // pace in the dive, and the x-progress carries that.
  const x = W * (-0.16 + 1.32 * (t + 0.045 * Math.sin(TAU * 1.3 * t + k.p1)));
  // The arc stays inside the band, nose-up at its crest included: the rule
  // above the row is a few px past the band's top.
  const y =
    H * (0.5 - 0.22 * Math.sin(TAU * 1.25 * t + k.p2) - 0.07 * Math.sin(TAU * 2.9 * t + k.p3));
  const z = 0.9 * H * Math.sin(TAU * 0.85 * t + k.p4);
  return [x, y, z];
}
/** Bank about the line of flight: a slow roll and a quicker flutter on it. */
function rollAt(t: number, k: Pass): number {
  return 0.62 * Math.sin(TAU * 1.05 * t + k.p5) + 0.22 * Math.sin(TAU * 2.4 * t + k.p3);
}

export default function EmailPlane() {
  const rootRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const body = bodyRef.current;
    const shadow = shadowRef.current;
    if (!root || !svg || !body || !shadow) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const bodyPaths = Array.from(body.children) as SVGPathElement[];
    const shadowPaths = Array.from(shadow.children) as SVGPathElement[];

    let W = 0;
    let H = 0;
    const measure = () => {
      W = root.clientWidth;
      H = root.clientHeight;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);

    let raf = 0;
    let t0 = 0;
    let pass = newPass();
    let inView = false;

    const hide = () => {
      for (const p of bodyPaths) p.setAttribute("d", "");
      for (const p of shadowPaths) p.setAttribute("d", "");
    };

    const draw = (t: number) => {
      const size = W < 300 ? SIZE_PHONE : SIZE_DESKTOP;
      const L = size / 2;
      // The line of flight, and the frame that hangs off it.
      const dt = 0.004;
      const p = pathAt(t, W, H, pass);
      const a = pathAt(t - dt, W, H, pass);
      const b = pathAt(t + dt, W, H, pass);
      const f = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      // Screen up is -y. Left wing = up x forward; up = forward x left.
      const s0 = norm(cross([0, -1, 0], f));
      const u0 = cross(f, s0);
      const r = rollAt(t, pass);
      const cr = Math.cos(r);
      const sr = Math.sin(r);
      const s: V3 = [
        s0[0] * cr + u0[0] * sr,
        s0[1] * cr + u0[1] * sr,
        s0[2] * cr + u0[2] * sr,
      ];
      const u: V3 = [
        u0[0] * cr - s0[0] * sr,
        u0[1] * cr - s0[1] * sr,
        u0[2] * cr - s0[2] * sr,
      ];
      const world = (v: V3): V3 => [
        p[0] + L * (v[0] * f[0] + v[1] * s[0] + v[2] * u[0]),
        p[1] + L * (v[0] * f[1] + v[1] * s[1] + v[2] * u[1]),
        p[2] + L * (v[0] * f[2] + v[1] * s[2] + v[2] * u[2]),
      ];
      // A mild perspective about the band's centre: the reference is close to
      // orthographic, and this only lets the dart breathe as it weaves.
      const F = 12 * H;
      const cx = W / 2;
      const cy = H / 2;
      const project = (v: V3): [number, number] => {
        const k = F / (F - v[2]);
        return [cx + (v[0] - cx) * k, cy + (v[1] - cy) * k];
      };

      // Each facet: its world triangle, its depth for painter's order, and
      // its light. Normals flipped to face the viewer, so a facet seen from
      // below takes the light of its underside.
      const facets = FACETS.map((tri) => {
        const w = tri.map(world) as unknown as [V3, V3, V3];
        let n = norm(
          cross(
            [w[1][0] - w[0][0], w[1][1] - w[0][1], w[1][2] - w[0][2]],
            [w[2][0] - w[0][0], w[2][1] - w[0][1], w[2][2] - w[0][2]],
          ),
        );
        if (n[2] < 0) n = [-n[0], -n[1], -n[2]];
        const lit = Math.max(0, dot(n, LIGHT));
        const depth = (w[0][2] + w[1][2] + w[2][2]) / 3;
        return { w, lit, depth };
      });
      const order = facets.map((_, i) => i).sort((i, j) => facets[i].depth - facets[j].depth);

      // The ground the shadow lies on: near the foot of the band, clear of
      // the address below it. The shadow is the dart's own silhouette laid
      // flat there, slanted a little by the light, fainter the higher the
      // dart flies.
      const groundY = H * 0.9;
      const lift = Math.max(0, groundY - p[1]) / H;
      const shadowAlpha = 0.34 * Math.max(0, 1 - lift * 0.55);

      for (let k = 0; k < 3; k++) {
        const fc = facets[order[k]];
        const pts = fc.w.map(project);
        const d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}L${pts[1][0].toFixed(1)} ${pts[1][1].toFixed(1)}L${pts[2][0].toFixed(1)} ${pts[2][1].toFixed(1)}Z`;
        const bp = bodyPaths[k];
        bp.setAttribute("d", d);
        // White paper: the lit facets near white, the turned-away ones a
        // shade of grey, never darker than the outline needs to still cut.
        const g = Math.round(214 + 41 * fc.lit);
        bp.setAttribute("fill", `rgb(${g},${g},${g})`);

        const sp = shadowPaths[k];
        const sd = pts
          .map(
            ([x, y]) =>
              `${(x + (groundY - p[1]) * 0.22).toFixed(1)} ${(groundY + (y - p[1]) * 0.3).toFixed(1)}`,
          )
          .join("L");
        sp.setAttribute("d", `M${sd}Z`);
      }
      shadow.setAttribute("opacity", shadowAlpha.toFixed(3));
    };

    const frame = (now: number) => {
      const el = now - t0;
      if (el < 0) {
        hide();
      } else if (el < FLIGHT_MS) {
        draw(el / FLIGHT_MS);
      } else if (el < FLIGHT_MS + GAP_MS) {
        hide();
      } else {
        t0 = now;
        pass = newPass();
        draw(0);
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf) return;
      t0 = performance.now() + 500;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      hide();
    };

    // Flies only while the address is on screen; nothing runs behind the
    // sections above.
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) start();
        else stop();
      },
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(root);
    const onVis = () => {
      if (document.hidden) stop();
      else if (inView) start();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <span ref={rootRef} className="email-plane" aria-hidden>
      <svg ref={svgRef} viewBox="0 0 100 40" focusable="false">
        <defs>
          <filter id="email-plane-shadow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="1.3" />
          </filter>
        </defs>
        <g ref={shadowRef} className="email-plane__shadow" filter="url(#email-plane-shadow)">
          <path />
          <path />
          <path />
        </g>
        <g ref={bodyRef} className="email-plane__body">
          <path />
          <path />
          <path />
        </g>
      </svg>
    </span>
  );
}
