"use client";

import { useEffect, useRef, useSyncExternalStore, type MutableRefObject } from "react";
import { isPhoneDevice } from "@/app/lib/device";

/**
 * The Communication Design scene (model draft): the campaign takes the city.
 *
 * A wet Hong Kong crossing at dusk (street.jpg, generated with every screen
 * left blank). As the beat runs, the camera glides into the street and each
 * screen switches on with the same campaign, her picture and the studio's
 * line, ending on the big screen across the crossing, which the camera
 * pushes into until she is full-bleed again: one idea, carried through
 * everything.
 *
 * The still stays exactly as sharp and as true in colour as the plate; the
 * life is drawn in code over it: ripples on the wet road, mist moving
 * through the towers, the neon sign flickering. The
 * posters are real DOM mapped onto the plate's measured screen corners with a
 * homography (matrix3d), so they sit in perspective and stay sharp. Driven by
 * `tRef` (the beat's progress, 0..1, from the services driver).
 */

const PLATE = "/hero/model/street.jpg";
const PW = 3840;
const PH = 2160;
const HER = "/hero/model/her-rest.jpg";
/** Phones: the plate with the grade and the neon's own pixels baked in, and
 *  her picture with the posters' colour filter baked in. On an iPhone the
 *  blend over the whole plate and a filter on her 5504 px picture in six
 *  posters were what ran Safari out of memory here, not the layers alone. */
const PLATE_PHONE = "/hero/model/street-graded-phone.jpg";
const HER_PHONE = "/hero/model/her-rest-cms-phone.jpg";

/** Screen corners in the plate (TL, TR, BR, BL), measured from street.jpg. */
type Quad = [number, number, number, number, number, number, number, number];
const SURFACES: {
  key: string;
  label: string;
  quad: Quad;
  w: number;
  h: number;
  on: number;
}[] = [
  { key: "tower", label: "Digital · Tower", quad: [410, -70, 790, 342, 790, 1236, 410, 1114], w: 300, h: 1000, on: 0.06 },
  { key: "stop", label: "Transit · Tram stop", quad: [1474, 1490, 1610, 1490, 1610, 1782, 1474, 1782], w: 300, h: 690, on: 0.09 },
  { key: "top", label: "Retail · Facade", quad: [3014, 532, 3614, 430, 3618, 786, 3018, 858], w: 1000, h: 560, on: 0.12 },
  { key: "low", label: "Street · Screen", quad: [3256, 1166, 3672, 1040, 3672, 1338, 3256, 1406], w: 700, h: 500, on: 0.15 },
  { key: "phone", label: "Social · Story 9:16", quad: [3044, 1448, 3288, 1430, 3402, 1868, 3144, 1890], w: 300, h: 560, on: 0.18 },
  { key: "screen", label: "Digital · Video wall", quad: [2144, 674, 2756, 670, 2760, 1152, 2138, 1182], w: 1000, h: 790, on: 0.21 },
];
/** The video wall across the crossing, for the final push. */
const SCREEN_C = { x: 2452, y: 928 };
const SCREEN_W = 586;
const SCREEN_H = 462;
/** The plate's own screen pixels (white = screen), which every poster is cut
 *  to: rounded corners, the tram wires and the traffic light in front, the
 *  fingers over the phone. */
const SCREENS_MASK = "/hero/model/street-screens.png";
/** The red neon sign, for its flicker. */
const NEON = { x: 1318, y: 466, w: 180, h: 640 };
/** The wet road, for the ripples. */
const ROAD = { y: 1560, h: 600 };
/** Mist drifting through the towers: three slow banks, out of step (left,
 *  top, width, height, seconds per sweep, seconds already run, opacity). */
const MIST = [
  { x: 1100, y: -80, w: 1900, h: 760, dur: 46, at: 0, o: 1 },
  { x: 2100, y: 260, w: 2000, h: 560, dur: 58, at: 20, o: 0.8 },
  { x: -200, y: 420, w: 1700, h: 520, dur: 64, at: 35, o: 0.7 },
];
/** The mist is drawn at a quarter of the plate's size: it is soft enough
 *  that nothing is lost, and as three animated layers the size of the
 *  plate it was what ran iOS Safari out of memory. */
const MIST_RES = 0.25;
/** Each poster's own patch of the plate (its corners' bounds, plus room for
 *  its glow), so the screens mask is cut per poster rather than as one layer
 *  the size of the plate: that one layer cost a phone ~150 MB. */
const GLOW = 48;
const patch = (q: Quad) => {
  const xs = [q[0], q[2], q[4], q[6]], ys = [q[1], q[3], q[5], q[7]];
  const x = Math.floor(Math.min(...xs)) - GLOW, y = Math.floor(Math.min(...ys)) - GLOW;
  const w = Math.ceil(Math.max(...xs)) + GLOW - x, h = Math.ceil(Math.max(...ys)) + GLOW - y;
  return { x, y, w, h, quad: q.map((v, i) => v - (i % 2 ? y : x)) as Quad };
};

/** CSS ease-in-out, cubic-bezier(.42, 0, .58, 1). */
function easeInOut(x: number): number {
  let lo = 0, hi = 1, u = x;
  for (let k = 0; k < 20; k++) {
    u = (lo + hi) / 2;
    const bx = 3 * u * (1 - u) * (1 - u) * 0.42 + 3 * u * u * (1 - u) * 0.58 + u * u * u;
    if (bx < x) lo = u;
    else hi = u;
  }
  return 3 * u * u * (1 - u) + u * u * u;
}

/** CSS matrix3d taking a w x h box at the origin onto `q`. */
function quadMatrix(w: number, h: number, q: Quad): string {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, d, e, g, hh;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = x1 - x0; b = x3 - x0; d = y1 - y0; e = y3 - y0; g = 0; hh = 0;
  } else {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    hh = (dx1 * dy3 - dx3 * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + hh * x3;
    d = y1 - y0 + g * y1; e = y3 - y0 + hh * y3;
  }
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(",")})`;
}

const sm = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

type Ripple = { x: number; y: number; r: number; max: number };

const noSubscribe = () => () => {};
const one = () => 1;
const phoneWorldScale = () => (isPhoneDevice() ? Math.min(1, 1 / (window.devicePixelRatio || 1)) : 1);

export default function CommStreet({ tRef }: { tRef: MutableRefObject<number> }) {
  const worldRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLCanvasElement>(null);
  const mistRef = useRef<HTMLCanvasElement>(null);
  const neonRef = useRef<HTMLDivElement>(null);
  const posterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tagRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  // A phone lays the world out at the plate's own pixels (k, one device
  // pixel to a plate pixel) and the camera scales it the rest of the way.
  // Laid out at 3840 x 2160 a phone kept every layer in it at 3x: the plate
  // at up to ~150 MB for a picture shown at about a third of its size, each
  // screen's mask at the same, and the street ran iOS Safari out of memory.
  // The small posters are drawn at half size too (pk); the video wall the
  // camera pushes into keeps its full size.
  const k = useSyncExternalStore(noSubscribe, phoneWorldScale, one);
  const pk = k < 1 ? 0.5 : 1;

  useEffect(() => {
    let raf = 0;
    let lastT = -1, lastW = 0, lastH = 0;
    let prev = performance.now();
    const rip = rippleRef.current;
    const pctx = rip?.getContext("2d");
    const ripples: Ripple[] = [];
    let neonDip = 0;
    const mist = mistRef.current;
    const mctx = mist?.getContext("2d");
    const t0 = performance.now();

    // On a portrait screen only a slice of the street fits, so the camera
    // pans it end to end instead: left to right (.04-.48), each screen
    // switching on as it comes into frame, then the same push into the
    // video wall.
    const PAN = [0.04, 0.48];
    const portraitCam = (t: number, W: number, H: number) => {
      const s0 = Math.max(W / PW, H / PH) * 1.12;
      const half = W / 2 / s0;
      const p = sm((t - PAN[0]) / (PAN[1] - PAN[0]));
      return { s0, x: half + (PW - 2 * half) * p, y: 1150, half };
    };
    // The opening on a landscape screen: the whole street, side to side, from
    // the billboard on the left to the hand holding the phone on the right.
    // Where the window is too square for all of it to fit, the camera pans it
    // left to right through the hold (.04-.26) instead of cropping its ends.
    const STREET = [340, 3740];
    const HOLD = [0.04, 0.26];
    const holdCam = (t: number, W: number, H: number) => {
      const s0 = Math.max(W / PW, H / PH);
      const half = W / 2 / s0;
      const a = STREET[0] + half, b = STREET[1] - half;
      const x = a >= b
        ? Math.min(PW - half, Math.max(half, (STREET[0] + STREET[1]) / 2))
        : a + (b - a) * sm((t - HOLD[0]) / (HOLD[1] - HOLD[0]));
      return { s0, x, half };
    };
    // When each surface switches on, on a portrait screen: as the pan brings
    // its left edge a little into frame.
    let onAt: number[] = SURFACES.map((sf) => sf.on);
    let onFor = "";
    const surfaceTimes = (W: number, H: number) => {
      const key = `${W}x${H}`;
      if (key === onFor) return onAt;
      onFor = key;
      if (W >= H) {
        // Landscape: lit on cue, or later if the hold's pan has yet to bring
        // it into frame.
        onAt = SURFACES.map((sf) => {
          const left = Math.min(sf.quad[0], sf.quad[6]);
          for (let t = 0; t <= HOLD[1]; t += 0.002) {
            const c = holdCam(t, W, H);
            if (c.x + c.half * 0.7 >= left) return Math.max(sf.on, t);
          }
          return HOLD[1];
        });
        return onAt;
      }
      onAt = SURFACES.map((sf) => {
        const left = Math.min(sf.quad[0], sf.quad[6]);
        for (let t = 0; t <= PAN[1]; t += 0.002) {
          const c = portraitCam(t, W, H);
          if (c.x + c.half * 0.7 >= left) return Math.max(0.05, t);
        }
        return PAN[1];
      });
      return onAt;
    };

    const camera = (t: number, W: number, H: number) => {
      const cover = Math.max(W / PW, H / PH);
      if (W < H) {
        const c = portraitCam(t, W, H);
        const q = sm((t - 0.5) / 0.18);
        const sEnd = Math.log(Math.max(W / SCREEN_W, H / SCREEN_H) * 1.12);
        const s = Math.exp(Math.log(c.s0) + (sEnd - Math.log(c.s0)) * q);
        const cx = c.x + (SCREEN_C.x - c.x) * q;
        const cy = c.y + (SCREEN_C.y - c.y) * q;
        return { s, tx: W / 2 - cx * s, ty: H / 2 - cy * s, q };
      }
      // Hold while every screen switches on (.06-.25), then glide into the
      // street (.26-.52), then push into the video wall until it is the
      // frame (.50-.68), before the next name arrives.
      const p = sm((t - 0.26) / 0.26);
      const q = sm((t - 0.5) / 0.18);
      // Opens on the whole street, side to side (the billboard on the left,
      // the hand holding the phone on the right), framed low; then glides in.
      const h = holdCam(t, W, H);
      const glide = { x: h.x + (2380 - h.x) * p, y: 1330 + (1060 - 1330) * p };
      let cx = glide.x + (SCREEN_C.x - glide.x) * q;
      let cy = glide.y + (SCREEN_C.y - glide.y) * q;
      const sGlide = Math.log(cover) + Math.log(1.3 * 1.3) * p;
      const sEnd = Math.log(Math.max(W / SCREEN_W, H / SCREEN_H) * 1.12);
      const s = Math.exp(sGlide + (sEnd - sGlide) * q);
      // Never past the plate's edges.
      const hw = W / (2 * s), hh = H / (2 * s);
      cx = hw * 2 >= PW ? PW / 2 : Math.min(PW - hw, Math.max(hw, cx));
      cy = hh * 2 >= PH ? PH / 2 : Math.min(PH - hh, Math.max(hh, cy));
      return { s, tx: W / 2 - cx * s, ty: H / 2 - cy * s, q };
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000));
      prev = now;
      const t = tRef.current;
      const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
      const live = t > 0.004 && t < 0.996;
      if (W !== lastW || H !== lastH) {
        lastW = W;
        lastH = H;
        lastT = -1;
      }

      // The camera and the screens: only when the scroll moves.
      if (t !== lastT) {
        lastT = t;
        const { s, tx, ty, q } = camera(t, W, H);
        const times = surfaceTimes(W, H);
        if (worldRef.current) worldRef.current.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${(s / k).toFixed(5)})`;
        SURFACES.forEach((sf, i) => {
          const on = Math.min(1, Math.max(0, (t - times[i]) / 0.035));
          const flick = on > 0 && on < 1 ? (Math.sin(t * 2300 + i * 7) > 0.1 ? on : on * 0.25) : on;
          const el = posterRefs.current[i];
          if (el) el.style.opacity = flick.toFixed(3);
          if (sf.key === "screen" && el) el.style.setProperty("--lit", q.toFixed(3));
          const tag = tagRefs.current[i];
          if (tag) {
            const gx = tx + Math.max(0, sf.quad[0]) * s;
            const gy = ty + Math.max(0, Math.min(sf.quad[1], sf.quad[3])) * s - 30;
            // A tag whose corner is off the screen or up under the service's
            // title row (on a phone, most of them) fades out rather than
            // crowding the edge.
            const room = Math.min(1, Math.max(0, (gx - 8) / 40), Math.max(0, (W - 150 - gx) / 40), Math.max(0, (gy - H * 0.13) / 40), Math.max(0, (H * 0.8 - gy) / 40));
            tag.style.opacity = (on * room * (1 - sm((t - 0.48) / 0.06))).toFixed(3);
            tag.style.transform = `translate3d(${gx.toFixed(1)}px, ${gy.toFixed(1)}px, 0)`;
          }
        });
      }
      if (!live) return;

      // The mist, each bank sweeping 520 px across and back.
      if (mctx && mist) {
        const secs = (now - t0) / 1000;
        mctx.setTransform(1, 0, 0, 1, 0, 0);
        mctx.clearRect(0, 0, mist.width, mist.height);
        for (const m of MIST) {
          const cyc = (secs + m.at) / m.dur;
          const leg = Math.floor(cyc);
          const e = easeInOut(leg % 2 ? 1 - (cyc - leg) : cyc - leg);
          const cx = m.x + m.w / 2 - 260 + 520 * e, cy = m.y + m.h / 2 - 30 * e;
          mctx.setTransform((m.w / 2) * MIST_RES, 0, 0, (m.h / 2) * MIST_RES, cx * MIST_RES, cy * MIST_RES);
          const g = mctx.createRadialGradient(0, 0, 0, 0, 0, 1);
          g.addColorStop(0, "rgba(226,214,220,0.2)");
          g.addColorStop(0.55, "rgba(226,214,220,0.07)");
          g.addColorStop(1, "rgba(226,214,220,0)");
          mctx.globalAlpha = m.o;
          mctx.fillStyle = g;
          mctx.beginPath();
          mctx.arc(0, 0, 1, 0, Math.PI * 2);
          mctx.fill();
        }
        mctx.globalAlpha = 1;
      }


      // Rings spreading on the wet road, flattened by perspective.
      if (pctx && rip) {
        const RW = rip.width, RH = rip.height;
        for (let k = 0; k < 3; k++) {
          if (Math.random() < 0.9) {
            const yy = Math.random();
            ripples.push({ x: Math.random() * RW, y: yy * RH, r: 0, max: 3 + yy * 10 });
          }
        }
        pctx.clearRect(0, 0, RW, RH);
        for (let k = ripples.length - 1; k >= 0; k--) {
          const rp = ripples[k];
          rp.r += dt * (8 + rp.max * 2);
          const life = rp.r / rp.max;
          if (life >= 1) {
            ripples.splice(k, 1);
            continue;
          }
          pctx.strokeStyle = `rgba(255,225,232,${(0.35 * (1 - life)).toFixed(3)})`;
          pctx.lineWidth = 0.8;
          pctx.beginPath();
          pctx.ellipse(rp.x, rp.y, Math.max(0.01, rp.r), Math.max(0.01, rp.r * 0.28), 0, 0, Math.PI * 2);
          pctx.stroke();
        }
      }

      // The neon sign: steady, with the odd stutter.
      if (neonRef.current) {
        if (neonDip <= 0 && Math.random() < 0.012) neonDip = 0.08 + Math.random() * 0.22;
        let o = 0;
        if (neonDip > 0) {
          neonDip -= dt;
          o = Math.random() < 0.55 ? 0.75 : 0.15;
        }
        // A phone dims it with black over the baked plate (the same as
        // brightness() over its pixels), rather than filtering a copy.
        if (k < 1) neonRef.current.style.opacity = (o * 0.75).toFixed(2);
        else neonRef.current.style.filter = o > 0 ? `brightness(${(1 - o * 0.75).toFixed(2)})` : "none";
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [tRef, k]);

  return (
    <div className="cms" data-phone={k < 1 ? "" : undefined} aria-hidden>
      <div ref={worldRef} className="cms__world" style={{ width: PW * k, height: PH * k }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cms__plate" src={k < 1 ? PLATE_PHONE : PLATE} alt="" draggable={false} />
        {/* The grade: the sky pulled down toward night, the reds deepened. */}
        {k === 1 && <i className="cms__grade" />}
        {/* Mist moving through the towers. */}
        <canvas ref={mistRef} className="cms__mist" width={PW * MIST_RES} height={PH * MIST_RES} style={{ width: PW * MIST_RES, height: PH * MIST_RES, transform: `scale(${k / MIST_RES})` }} />
        {/* The neon sign's stutter: its own pixels, dimmed for a few frames. */}
        <div
          ref={neonRef}
          className={k < 1 ? "cms__neon cms__neon--dim" : "cms__neon"}
          style={{
            left: NEON.x * k,
            top: NEON.y * k,
            width: NEON.w * k,
            height: NEON.h * k,
            ...(k < 1
              ? { opacity: 0 }
              : {
                  backgroundImage: `url(${PLATE})`,
                  backgroundSize: `${PW * k}px ${PH * k}px`,
                  backgroundPosition: `${-NEON.x * k}px ${-NEON.y * k}px`,
                }),
          }}
        />
        <canvas ref={rippleRef} className="cms__ripples" width={1280} height={200} style={{ top: ROAD.y * k, width: 1280, height: 200, transform: `scale(${(PW * k) / 1280}, ${(ROAD.h * k) / 200})` }} />
        {SURFACES.map((sf, i) => {
          const pa = patch(sf.quad);
          const q = sf.key === "screen" ? 1 : pk;
          return (
          <div
            key={sf.key}
            className="cms__screen"
            style={{
              left: pa.x * k,
              top: pa.y * k,
              width: pa.w * k,
              height: pa.h * k,
              maskImage: `url(${SCREENS_MASK})`,
              WebkitMaskImage: `url(${SCREENS_MASK})`,
              maskSize: `${PW * k}px ${PH * k}px`,
              WebkitMaskSize: `${PW * k}px ${PH * k}px`,
              maskPosition: `${-pa.x * k}px ${-pa.y * k}px`,
              WebkitMaskPosition: `${-pa.x * k}px ${-pa.y * k}px`,
            }}
          >
          <div
            ref={(el) => {
              posterRefs.current[i] = el;
            }}
            className={`cms__poster cms__poster--${sf.key}`}
            style={{
              width: sf.w * q,
              height: sf.h * q,
              transform: quadMatrix(sf.w * q, sf.h * q, pa.quad.map((v) => v * k) as Quad),
              boxShadow: q < 1 ? `0 0 ${40 * q}px ${6 * q}px rgba(255, 236, 228, 0.18)` : undefined,
              opacity: 0,
            }}
          >
          {/* Laid out at full size, drawn at the poster's (pk on a phone). */}
          <div className="cms__poster-in" style={{ width: sf.w, height: sf.h, transform: q < 1 ? `scale(${q})` : undefined }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cms__her" src={k < 1 ? HER_PHONE : HER} alt="" draggable={false} />
            {sf.key !== "phone" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cms__mark" src="/shop/brand/zc-wordmark.webp" alt="" draggable={false} />
            )}
            {sf.key === "phone" && (
              <>
                <i className="cms__bars" />
                <p className="cms__handle">zuhayrcreative</p>
              </>
            )}
            {/* Set as the hero sets it: "design-led" plain, the noun bold. */}
            <p className="cms__line"><span>A design-led</span><b>Collective</b></p>
            {sf.key !== "phone" && <i className="cms__leds" />}
            <i className="cms__dither" />
          </div>
          </div>
          </div>
          );
        })}
      </div>
      {SURFACES.map((sf, i) => (
        <p
          key={sf.key}
          ref={(el) => {
            tagRefs.current[i] = el;
          }}
          className="cms__tag"
          style={{ opacity: 0 }}
        >
          <b>0{i + 1}</b>
          {sf.label}
        </p>
      ))}
    </div>
  );
}
