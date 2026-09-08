"use client";

import { useEffect, useRef } from "react";
import "@/app/styles/email-plane.css";

/**
 * One paper plane, gliding round and round the footer's email address.
 *
 * The reference (Screen Recording 2026-08-25 182057) is a set of folded paper
 * darts drawn as line art — white paper, a thin dark outline on every edge,
 * the facets shaded a shade apart so the fold reads — seen in 3D, circling,
 * so that one moment you look down on the wings and the next you see the keel
 * from behind, each with a soft shadow on the ground beneath it. The client
 * asked for one of those, and then, of the fly-by that came first, said it
 * should not come from nowhere and leave for nowhere: it should fly round the
 * WHOLE address, "in a very unique way, trying to glide without actually
 * colliding with the email". So this is a dart that is always there, on a
 * circuit around the address's box — left to right above it, down past its
 * end, right to left beneath, up past its start — and the circuit is alive:
 * its clearance from the text breathes in and out on slow, unrelated rhythms
 * so no two laps are the same track, it slows as it climbs and gathers pace
 * as it dives like a glider does, it banks into the turns at the ends, and
 * every so often, on a straight, it throws a full roll. It never crosses the
 * text: the track is built outward from the address's own box, with a floor
 * on the clearance that the plane's wingtips cannot reach past.
 *
 * Drawn rather than transformed: the plane is three triangles sharing a nose,
 * and drawing their projections lets every edge be a crisp 1px line and every
 * facet take its own light, which CSS 3D (one bitmap per face, no outlines,
 * no shading) cannot do. Six path `d` writes a frame while the address is on
 * screen; nothing at all while it is not.
 */

/** Length of the dart on screen, px — sized with the address's font. */
const SIZE_DESKTOP = 44;
const SIZE_PHONE = 34;
/** Cruising speed, px/s, before the glide's ebb and flow. */
const SPEED_DESKTOP = 100;
const SPEED_PHONE = 80;

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

/* Screen space throughout: x right, y down, z toward the viewer. */
/** Light from above and a little in front of the camera. */
const LIGHT = norm([-0.35, -0.85, 0.5]);
/** The ring the plane flies in is laid back from the camera, as the
    reference's is: its normal points up and toward the viewer, and that is
    the plane's "up" — so the wings are seen from above all the way round, and
    the keel shows when it banks. */
const RING_UP = norm([0, -0.72, 0.7]);

const TAU = Math.PI * 2;

/**
 * The circuit's clearances from the address's box, px, at the desktop size
 * (scaled with the dart on phones): a base, a breath, and the breath's rate
 * in Hz, each side on its own slow rhythm. What breathes is the PLANE's own
 * clearance; the floor of each is the base minus the breath, and the
 * wingtips reach at most 0.75 of a half-length past the plane's centre,
 * which is what the floors are set from. More air above than below, per the
 * reference's laid-back ring; more on the right, where the row has room,
 * than on the left, where the text starts near the edge.
 */
const AIR = {
  top: [44, 8, 0.21],
  bottom: [40, 5, 0.17],
  left: [27, 3, 0.29],
  right: [40, 8, 0.24],
} as const;
/** The plane flies this far above its shadow on the ring, px. */
const LIFT = 10;
/** No point of the dart ever comes closer than this to the text, px. The
    track keeps it clear by design; this is the guard on it, where the
    breathing, the banking and a roll at a corner might add up. */
const PAD = 5;
/** The superellipse's exponent: 2 is an ellipse, higher squares the corners.
    With a box this wide and low, an ellipse cuts in at the corners; 4 keeps
    the corners' clearance near the straights' and still rounds them. */
const SQUARENESS = 4;

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

    // The address's box, in this layer's coordinates: the thing to fly round.
    // The link's first child is the text itself (the arrow that slides in on
    // hover is its sibling and would pad the box on the right).
    const link = root.parentElement?.querySelector<HTMLElement>('a[href^="mailto:"]') ?? null;
    const text = link?.firstElementChild instanceof HTMLElement ? link.firstElementChild : link;

    // ── Hover: the address turns brand red under the pointer, and so does
    // the plane, on the same 300ms — the paper is red then, shaded the same
    // way. Only the LINK's hover counts: the plane is pointer-transparent,
    // so passing over it hovers nothing, and it flies where the address is
    // not. Focus counts too, as the link's own colour change does not, but
    // a keyboard user deserves the same cue.
    const red = (() => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--title-red").trim();
      const m = /^#([0-9a-f]{6})$/i.exec(v);
      if (!m) return [220, 20, 60];
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    })();
    let hotTarget = 0;
    let hot = 0;
    const onHot = () => {
      hotTarget = 1;
    };
    const onCold = () => {
      hotTarget = 0;
    };
    link?.addEventListener("pointerenter", onHot);
    link?.addEventListener("pointerleave", onCold);
    link?.addEventListener("focus", onHot);
    link?.addEventListener("blur", onCold);
    let W = 0;
    let H = 0;
    let cx = 0;
    let cy = 0;
    let hw = 0;
    let hh = 0;
    let scale = 1;
    let size = SIZE_DESKTOP;
    let speed = SPEED_DESKTOP;
    const measure = () => {
      const rr = root.getBoundingClientRect();
      W = rr.width;
      H = rr.height;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const tr = text ? text.getBoundingClientRect() : rr;
      cx = tr.left - rr.left + tr.width / 2;
      cy = tr.top - rr.top + tr.height / 2;
      hw = tr.width / 2;
      hh = tr.height / 2;
      const phone = window.matchMedia("(max-width: 639px)").matches;
      size = phone ? SIZE_PHONE : SIZE_DESKTOP;
      speed = phone ? SPEED_PHONE : SPEED_DESKTOP;
      scale = size / SIZE_DESKTOP;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    if (text) ro.observe(text);

    // ── The flight's state: where on the circuit, how banked, and whether a
    // roll is under way. Persistent: the plane is wherever it got to when the
    // address left the screen, and carries on from there when it is back.
    let theta = Math.random() * TAU;
    let bank = 0;
    let clock = Math.random() * 1000;
    let last = 0;
    let rollAt = -1; // the clock at which the current roll began, or -1
    let lastRoll = -20;
    const phase = [
      Math.random() * TAU,
      Math.random() * TAU,
      Math.random() * TAU,
      Math.random() * TAU,
    ];

    const air = (k: keyof typeof AIR, t: number, i: number) => {
      const [base, breath, rate] = AIR[k];
      return (base + breath * Math.sin(TAU * rate * t + phase[i])) * scale;
    };
    /** The plane's centre on the circuit at angle th, at clock t. */
    const at = (th: number, t: number): V3 => {
      const c = Math.cos(th);
      const s = Math.sin(th);
      const a = hw + (c >= 0 ? air("right", t, 3) : air("left", t, 2));
      const b = hh + (s >= 0 ? air("bottom", t, 1) : air("top", t, 0));
      const r = Math.pow(
        Math.pow(Math.abs(c / a), SQUARENESS) + Math.pow(Math.abs(s / b), SQUARENESS),
        -1 / SQUARENESS,
      );
      // The ring is laid back: its near side is the bottom of the screen.
      return [cx + r * c, cy + r * s, 0.9 * b * s];
    };

    const draw = (dt: number) => {
      // ── Advance along the circuit by distance, not angle: the track is far
      // wider than it is tall, and equal angles would rush the ends.
      const dth = 0.01;
      let p0 = at(theta, clock);
      let p1 = at(theta + dth, clock);
      const dpdth = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) / dth || 1;
      const tan0 = norm([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]);
      // A glider: it slows on the way up and gathers pace on the way down,
      // and on top of that its pace drifts a little from lap to lap.
      const v =
        speed * (1 + 0.38 * tan0[1]) * (1 + 0.1 * Math.sin(TAU * 0.07 * clock + phase[1]));
      const dtheta = (v * dt) / dpdth;
      theta += dtheta;
      if (theta > TAU) theta -= TAU;
      clock += dt;
      // The colour follows the pointer on the address's own 300ms ease.
      hot += (hotTarget - hot) * Math.min(1, dt / 0.3) * 2;
      hot = Math.max(0, Math.min(1, hot));

      p0 = at(theta, clock);
      p1 = at(theta + dth, clock);
      const p2 = at(theta + 2 * dth, clock);
      const f = norm([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]);
      // ── Bank into the turn: the heading's rate of turn, smoothed, plus a
      // slow wobble so the straights are never dead level.
      const h0 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      const h1 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
      let dh = h1 - h0;
      if (dh > Math.PI) dh -= TAU;
      if (dh < -Math.PI) dh += TAU;
      const turnRate = (dh / dth) * (dtheta / dt); // rad of heading per s
      const bankTarget =
        Math.max(-0.95, Math.min(0.95, 0.42 * turnRate)) +
        0.14 * Math.sin(TAU * 0.33 * clock + phase[2]);
      bank += (bankTarget - bank) * (1 - Math.exp(-dt / 0.22));

      // ── The flourish: now and then, on a straight, a full roll. Never in a
      // turn (nor so late on a straight that the roll runs into one — at the
      // left end that would swing a wingtip past the screen's edge), never
      // twice within eight seconds, and about once a lap.
      const onStraight = Math.abs(Math.sin(theta)) > 0.93 && Math.abs(f[0]) > 0.9;
      if (rollAt < 0 && onStraight && clock - lastRoll > 8 && Math.random() < dt / 5) {
        rollAt = clock;
        lastRoll = clock;
      }
      let flourish = 0;
      if (rollAt >= 0) {
        const uu = (clock - rollAt) / 1.1;
        if (uu >= 1) rollAt = -1;
        else flourish = TAU * (uu < 0.5 ? 2 * uu * uu : 1 - Math.pow(-2 * uu + 2, 2) / 2);
      }

      // ── The dart's frame: nose along the track, up along the ring's
      // normal (less whatever of it lies along the nose), then rolled.
      const L = size / 2;
      const along = dot(RING_UP, f);
      const u0 = norm([RING_UP[0] - along * f[0], RING_UP[1] - along * f[1], RING_UP[2] - along * f[2]]);
      const s0 = cross(u0, f);
      const r = bank + flourish;
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
      const pc: [number, number, number] = [p0[0], p0[1] - LIFT * scale, p0[2]];
      const world = (v3: V3): V3 => [
        pc[0] + L * (v3[0] * f[0] + v3[1] * s[0] + v3[2] * u[0]),
        pc[1] + L * (v3[0] * f[1] + v3[1] * s[1] + v3[2] * u[1]),
        pc[2] + L * (v3[0] * f[2] + v3[1] * s[2] + v3[2] * u[2]),
      ];
      // Perspective about the plane's own centre, so that the track's
      // clearances hold exactly on screen: the dart is smaller on the far
      // side of the ring (the top) and larger on the near (the bottom).
      const F = 520 * scale;
      const project = (v3: V3): [number, number] => {
        const k = F / (F - v3[2]);
        return [pc[0] + (v3[0] - pc[0]) * k, pc[1] + (v3[1] - pc[1]) * k];
      };

      // Each facet: its world triangle, its depth for painter's order, and
      // its light. Normals flipped to face the viewer, so a facet seen from
      // below takes the light of its underside.
      const facets = FACETS.map((tri) => {
        const w = tri.map(world) as [V3, V3, V3];
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

      // ── The guard: the dart's outline, sampled along its edges, against
      // the text's box. Where any of it would come within PAD of the text,
      // the whole dart is moved out by the shortfall, away from the nearest
      // point of the text. The track is built to make this a no-op; it is
      // here for the corners, where the breathing, the bank and a roll can
      // add up, and it holds whatever they do.
      const pad = PAD * scale;
      const x0 = cx - hw;
      const y0 = cy - hh;
      const x1 = cx + hw;
      const y1 = cy + hh;
      for (let pass = 0; pass < 3; pass++) {
        let worst = Infinity;
        let nx = 0;
        let ny = 0;
        for (const fc of facets) {
          const pts = fc.w.map(project);
          for (let i = 0; i < 3; i++) {
            const a = pts[i];
            const b = pts[(i + 1) % 3];
            for (let q = 0; q <= 8; q++) {
              const x = a[0] + ((b[0] - a[0]) * q) / 8;
              const y = a[1] + ((b[1] - a[1]) * q) / 8;
              const ex = Math.max(x0 - x, 0, x - x1);
              const ey = Math.max(y0 - y, 0, y - y1);
              const dd = Math.hypot(ex, ey);
              if (dd < worst) {
                worst = dd;
                // Outward: from the box's nearest point to this one — or,
                // for a point inside the box, straight out of its nearest
                // side.
                if (dd > 0) {
                  nx = (x < x0 ? -ex : x > x1 ? ex : 0) / dd;
                  ny = (y < y0 ? -ey : y > y1 ? ey : 0) / dd;
                } else {
                  const toL = x - x0;
                  const toR = x1 - x;
                  const toT = y - y0;
                  const toB = y1 - y;
                  const m = Math.min(toL, toR, toT, toB);
                  nx = m === toL ? -1 : m === toR ? 1 : 0;
                  ny = m === toT ? -1 : m === toB ? 1 : 0;
                }
              }
            }
          }
        }
        if (worst >= pad) break;
        const push = pad - worst;
        pc[0] += nx * push;
        pc[1] += ny * push;
        for (const fc of facets) {
          for (let i = 0; i < 3; i++) {
            const v = fc.w[i];
            fc.w[i] = [v[0] + nx * push, v[1] + ny * push, v[2]];
          }
        }
      }

      for (let k = 0; k < 3; k++) {
        const fc = facets[order[k]];
        const pts = fc.w.map(project);
        const d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}L${pts[1][0].toFixed(1)} ${pts[1][1].toFixed(1)}L${pts[2][0].toFixed(1)} ${pts[2][1].toFixed(1)}Z`;
        const bp = bodyPaths[k];
        bp.setAttribute("d", d);
        // White paper: the lit facets near white, the turned-away ones a
        // shade of grey, never darker than the outline needs to still cut.
        // Under the pointer, red paper, shaded the same way: the lit facets
        // the brand red lifted toward white, the turned-away ones the brand
        // red deepened.
        const g = 214 + 41 * fc.lit;
        const tone = 0.78 + 0.22 * fc.lit;
        const rr = red[0] * tone + 35 * fc.lit;
        const rg = red[1] * tone + 40 * fc.lit;
        const rb = red[2] * tone + 30 * fc.lit;
        const cr8 = Math.round(g + (Math.min(255, rr) - g) * hot);
        const cg8 = Math.round(g + (Math.min(255, rg) - g) * hot);
        const cb8 = Math.round(g + (Math.min(255, rb) - g) * hot);
        bp.setAttribute("fill", `rgb(${cr8},${cg8},${cb8})`);

        // The shadow: the dart's silhouette on the ring beneath it, LIFT
        // below on screen, flattened, slanted a touch by the light.
        const sp = shadowPaths[k];
        const sd = pts
          .map(
            ([x, y]) =>
              `${(x + LIFT * scale * 0.25).toFixed(1)} ${(p0[1] + (y - pc[1]) * 0.42).toFixed(1)}`,
          )
          .join("L");
        sp.setAttribute("d", `M${sd}Z`);
      }
    };

    let raf = 0;
    const frame = (now: number) => {
      // A hitch (a screenshot, a tab switch, a long task) is a jump of at
      // most a tenth of a second, not slow motion.
      const dt = Math.min(0.1, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // Flies only while the address is on screen; nothing runs behind the
    // sections above. It keeps its place on the circuit in between.
    let inView = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) start();
        else stop();
      },
      { threshold: 0 },
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
      link?.removeEventListener("pointerenter", onHot);
      link?.removeEventListener("pointerleave", onCold);
      link?.removeEventListener("focus", onHot);
      link?.removeEventListener("blur", onCold);
    };
  }, []);

  return (
    <span ref={rootRef} className="email-plane" aria-hidden>
      <svg ref={svgRef} viewBox="0 0 100 40" focusable="false">
        <defs>
          <filter id="email-plane-shadow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="1.2" />
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
