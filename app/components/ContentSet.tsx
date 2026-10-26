"use client";

import { useEffect, useRef, useSyncExternalStore, type MutableRefObject } from "react";
import { isPhoneDevice } from "@/app/lib/device";

/**
 * The Content Production scene (model draft): it was a shoot all along.
 *
 * It opens on her exactly as the hero framed her, then the camera pulls back
 * and the frame hands over (on a glitch cut, her eyes lined up) to the set
 * she is being shot on (studio.jpg): red key light, softbox, stands, haze, a
 * cinema camera in the foreground. The camera pushes into the
 * camera's own monitor, which plays what the shoot makes: a still, a
 * commercial, a motion piece, a CGI pass.
 *
 * World units are the set plate's (5504 x 3072). Her photo sits inside it at
 * the scale and place where her eyes match the set's (measured: her iris at
 * 3010,962 in her-rest.jpg lands on 2775,882 in the set, at 0.1757). Driven by
 * `tRef` (the beat's progress, 0..1, from the services driver).
 */

const SET = "/hero/model/studio.jpg";
/** Phones: the set with its burgundy grade baked in (a filter over the whole
 *  set picture, on an iPhone). */
const SET_PHONE = "/hero/model/studio-burgundy-phone.jpg";
const HER = "/hero/model/her-rest.jpg";
const WW = 5504;
const WH = 3072;
const K = 0.1757;
const HER_RECT = { x: 2775 - 3010 * K, y: 882 - 962 * K, w: 5504 * K, h: 3072 * K };
/** The on-board monitor's screen in the set (TL, TR, BR, BL). */
type Quad = [number, number, number, number, number, number, number, number];
const MONITOR: Quad = [1094, 1744, 1603, 1761, 1589, 2064, 1087, 2050];
const MON_C = { x: 1343, y: 1905, w: 505 };
const MON_W = 960;
const MON_H = 540;
const OUTPUTS = ["Still", "Commercial", "Motion", "CGI"];

function quadMatrix(w: number, h: number, q: Quad): string {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const hh = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3;
  const d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(",")})`;
}

const sm = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};
const bump = (x: number, c: number, w: number) => Math.max(0, 1 - Math.abs(x - c) / w);

const noSubscribe = () => () => {};
const one = () => 1;
const phoneWorldScale = () => (isPhoneDevice() ? Math.min(1, 1 / (window.devicePixelRatio || 1)) : 1);

export default function ContentSet({ tRef }: { tRef: MutableRefObject<number> }) {
  const worldRef = useRef<HTMLDivElement>(null);
  const herRef = useRef<HTMLImageElement>(null);
  const cutRef = useRef<HTMLDivElement>(null);
  const outRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tcRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // A phone lays the set out at its own pixels (wk, one device pixel to a
  // set pixel) and the camera scales it the rest of the way: at 5504 x 3072
  // a phone kept it at 3x, ~216 MB of layer, enough with the scenes round it
  // for iOS Safari to reload the page. Her photo, which opens the scene
  // full-bleed, keeps its full size in a layer of its own; the monitor,
  // never shown larger than about a third of its size, is drawn at half.
  const wk = useSyncExternalStore(noSubscribe, phoneWorldScale, one);
  const pk = wk < 1 ? 0.5 : 1;

  // The set's grade: burgundy (chosen 22 Oct), a touch warmer than the
  // hero's final grade, as on-set light is; ?set=red shows it as generated.
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("set");
    if (rootRef.current) rootRef.current.dataset.grade = g === "red" ? "red" : "burgundy";
    const set = rootRef.current?.querySelector<HTMLImageElement>(".cts__set");
    if (g === "red" && set) set.src = SET;
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = -1, lw = 0, lh = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const t = tRef.current;
      const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
      if (t === last && W === lw && H === lh) return;
      last = t; lw = W; lh = H;

      // The camera: from the hero's framing of her, out to the whole set
      // (.06-.28), then in to the camera's monitor (.40-.50). All of it
      // lands before the next service's name takes over (~.72).
      const z = sm((t - 0.06) / 0.22);
      const m = sm((t - 0.4) / 0.1);
      const sA = Math.max(W / HER_RECT.w, H / HER_RECT.h) * 1.32;
      const cA = { x: HER_RECT.x + HER_RECT.w * 0.5, y: HER_RECT.y + HER_RECT.h * 0.471 };
      const sB = Math.max(W / WW, H / WH) * 1.02;
      const cB = { x: WW / 2, y: WH / 2 };
      // Portrait: the monitor fits the width, whole, with the set round it.
      const sC = W < H ? (0.92 * W) / MON_C.w : Math.max((0.62 * W) / MON_C.w, (0.62 * H) / (MON_C.w * 0.6));
      const cC = { x: MON_C.x, y: MON_C.y };
      let ls = Math.log(sA) + (Math.log(sB) - Math.log(sA)) * z;
      let cx0 = cA.x + (cB.x - cA.x) * z, cy0 = cA.y + (cB.y - cA.y) * z;
      // A portrait screen fits only a slice of the set: the camera pulls back
      // to the set's full height towards its right-hand end (.06-.22), then
      // pans the whole set right to left (.22-.40) before the same push into
      // the monitor, so every piece of the real set is seen.
      if (W < H) {
        const s0 = (H / WH) * 1.02;
        const half = W / 2 / s0;
        const out = sm((t - 0.06) / 0.16);
        const pan = sm((t - 0.22) / 0.18);
        const right = WW - half, left = half;
        const px = right + (left - right) * pan;
        ls = Math.log(sA) + (Math.log(s0) - Math.log(sA)) * out;
        // She stays centred while the frame opens; only then does it slide
        // to the set's right-hand end, ready to pan back across it.
        cx0 = cA.x + (px - cA.x) * sm((t - 0.13) / 0.09);
        cy0 = cA.y + (WH / 2 - cA.y) * out;
      }
      const s = Math.exp(ls + (Math.log(sC) - ls) * m);
      const cx = cx0 + (cC.x - cx0) * m, cy = cy0 + (cC.y - cy0) * m;
      if (worldRef.current) {
        worldRef.current.style.transform = `translate3d(${(W / 2 - cx * s).toFixed(2)}px, ${(H / 2 - cy * s).toFixed(2)}px, 0) scale(${(s / wk).toFixed(5)})`;
      }

      // The hand-over from her photo to the set: a short glitch cut.
      if (herRef.current) {
        const o = 1 - sm((z - 0.3) / 0.08);
        herRef.current.style.opacity = o.toFixed(3);
        herRef.current.style.visibility = o > 0 ? "" : "hidden";
      }
      if (cutRef.current) {
        const c = bump(z, 0.34, 0.06);
        cutRef.current.style.opacity = c.toFixed(3);
        // Hidden between cuts: its tear runs forever, a layer the size of
        // the screen kept live.
        cutRef.current.style.visibility = c > 0 ? "" : "hidden";
      }


      // What the shoot makes, on the monitor: one output at a time.
      const k = (t - 0.5) / 0.05;
      const idx = Math.max(0, Math.min(OUTPUTS.length - 1, Math.floor(k)));
      // Hidden, not just transparent: an output under the animated one was
      // kept as a layer of its own.
      outRefs.current.forEach((el, i) => {
        if (el) {
          el.style.opacity = i === idx ? "1" : "0";
          el.style.visibility = i === idx ? "" : "hidden";
        }
      });
      if (tcRef.current) {
        const f = Math.floor(Math.max(0, t) * 1200);
        tcRef.current.textContent = `00:00:${String(Math.floor(f / 24) % 60).padStart(2, "0")}:${String(f % 24).padStart(2, "0")}`;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [tRef, wk]);

  return (
    <div ref={rootRef} className="cts" data-grade="burgundy" data-phone={wk < 1 ? "" : undefined} aria-hidden>
      <div ref={worldRef} className="cts__world" style={{ width: WW * wk, height: WH * wk }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cts__set" src={wk < 1 ? SET_PHONE : SET} alt="" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={herRef}
          className="cts__her"
          src={HER}
          alt=""
          draggable={false}
          style={{
            left: HER_RECT.x * wk,
            top: HER_RECT.y * wk,
            width: HER_RECT.w,
            height: HER_RECT.h,
            transform: wk < 1 ? `scale(${wk})` : undefined,
            transformOrigin: "0 0",
            willChange: wk < 1 ? "transform" : undefined,
          }}
        />
        <div className="cts__monitor" style={{ width: MON_W * pk, height: MON_H * pk, transform: quadMatrix(MON_W * pk, MON_H * pk, MONITOR.map((v) => v * wk) as Quad) }}>
          <div className="cts__monitor-in" style={{ width: MON_W, height: MON_H, transform: pk < 1 ? `scale(${pk})` : undefined }}>
          <div ref={(el) => { outRefs.current[0] = el; }} className="cts__out cts__out--still">
            <span className="cts__label"><b>01</b>{OUTPUTS[0]}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HER} alt="" draggable={false} />
            <p>1/250 · f2.8 · ISO 400</p>
          </div>
          <div ref={(el) => { outRefs.current[1] = el; }} className="cts__out cts__out--film">
            <span className="cts__label"><b>02</b>{OUTPUTS[1]}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HER} alt="" draggable={false} />
            <p>A design-led collective.</p>
          </div>
          <div ref={(el) => { outRefs.current[2] = el; }} className="cts__out cts__out--motion">
            <span className="cts__label"><b>03</b>{OUTPUTS[2]}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HER} alt="" draggable={false} />
            <i className="cts__bar cts__bar--a" />
            <i className="cts__bar cts__bar--b" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cts__mark" src="/shop/brand/zc-wordmark.webp" alt="" draggable={false} />
          </div>
          <div ref={(el) => { outRefs.current[3] = el; }} className="cts__out cts__out--cgi">
            <span className="cts__label"><b>04</b>{OUTPUTS[3]}</span>
            <i className="cts__floor" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HER} alt="" draggable={false} />
          </div>
          <div className="cts__hud">
            <span className="cts__rec"><i />REC</span>
            <b ref={tcRef}>00:00:00:00</b>
            <span>4K · 24p</span>
          </div>
          </div>
        </div>
      </div>
      <div ref={cutRef} className="cts__cut" />
    </div>
  );
}
