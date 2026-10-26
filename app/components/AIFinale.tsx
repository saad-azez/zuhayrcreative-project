"use client";

import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type MutableRefObject } from "react";
import { isPhoneDevice } from "@/app/lib/device";

/**
 * The AI Integration scene (model draft), the finale of the services: she was
 * never just a picture.
 *
 * On her exactly as the hero frames her, a red seam draws itself down the
 * centre line of her face. Her skin on the far side unzips from the seam
 * outward, a red edge travelling across, as the camera eases in, and beneath is her face again in
 * porcelain (after Bjork's porcelain machines: her own nose, lips and brow in
 * ivory, in its own colour). Then the porcelain's cheek panel parts (the
 * Ghost in the Shell geisha's gesture) and polished chrome catches the light
 * in the gap (Sorayama), and the ruby eye wakes. Her human eye blinks; the
 * ruby one does not. The camera dives into the ruby eye and everything the
 * services showed rushes past, full screen. Then out, the panel closes, the
 * skin comes back, the seam heals, and she blinks once more.
 *
 * World units are her-rest.jpg's (5504 x 3072). her-porcelain-face.png is the
 * porcelain half (an edit of her photo, its eye moved and sized to mirror
 * hers and its half of the mouth narrowed to meet her lips at the seam),
 * cut out and placed at PORCELAIN. Driven by `tRef` (the beat's progress,
 * 0..1, from the services driver).
 */

const HER = "/hero/model/her-rest.jpg";
const PORCELAIN_SRC = "/hero/model/her-porcelain-face.png";
/** Real mirror chrome (from an edit of the porcelain frame), fitted under
 *  the cheek panel's gap. */
const CHROME_SRC = "/hero/model/chrome.jpg";
const CHROME_BOX = { x: 3016, y: 830, w: 256, h: 362 };
/** A 4K upscale of the ruby eye's region (2850,855 320x200), which takes
 *  over as the camera dives in, so the eye stays sharp at full screen. */
const EYE_HI = "/hero/model/eye-4k.jpg";
const EYE_HI_BOX = { x: 2850, y: 855, w: 320, h: 200 };
const BLINK = "/hero/model/blink.mp4";
const WW = 5504;
const WH = 3072;
const PORCELAIN = { x: 2780, y: 300, w: 510, h: 1430 };
/** The half of her face that opens (her photo's px). */
const FACE: [number, number][] = [
  [2790, 330], [2880, 310], [3020, 340], [3140, 420], [3210, 540], [3260, 700], [3280, 860], [3270, 1040],
  [3250, 1050], [3240, 1110], [3200, 1180], [3160, 1280], [3150, 1370], [3125, 1480], [3060, 1590],
  [3000, 1660], [2910, 1700], [2800, 1718], [2790, 1718],
];
/** The porcelain's cheek panel, along its own panel lines. */
const CHEEK: [number, number][] = [
  [3110, 925], [3270, 830], [3272, 1000], [3236, 1160], [3180, 1192], [3090, 1140], [3040, 1072], [3016, 1000], [3070, 990],
];
/** How far the skin pulls back: from the seam to past her face's far edge. */
const OPEN_FROM = 2780;
const OPEN_TO = 3330;
const EYE = { x: 3010, y: 955 };
const SEAM_X = 2790;
const BLINK_RECT = { x: 0.38993 * WW, y: 0.22491 * WH, w: 0.23364 * WW, h: 0.16729 * WH };
const RUSH = [
  { src: HER, label: "Brand Design", pos: "54% 30%" },
  { src: HER, label: "Experience Design", pos: "50% 22%", grid: true },
  { src: "/hero/model/street.jpg", label: "Communication Design", pos: "60% 45%" },
  { src: "/hero/model/studio.jpg", label: "Content Production", pos: "50% 40%" },
  { src: HER, label: "Brand Design", pos: "46% 60%" },
  { src: "/hero/model/street.jpg", label: "Communication Design", pos: "28% 30%" },
  { src: "/hero/model/studio.jpg", label: "Content Production", pos: "30% 55%" },
  { src: HER, label: "Experience Design", pos: "60% 36%", grid: true },
];

/** Everything that opens in her face (porcelain, chrome, cheek, eyes, the
 *  skin's edge with its shadows) lies in this box of her picture: those
 *  layers are cut to it rather than to her whole picture (two layers her
 *  picture's size cost a phone ~200 MB). Their coordinates are relative to
 *  it (fx, fy). */
const FB = { x: 2680, y: 200, w: 760, h: 1600 };
const poly = (pts: [number, number][], k = 1) => `polygon(${pts.map(([x, y]) => `${+((x - FB.x) * k).toFixed(2)}px ${+((y - FB.y) * k).toFixed(2)}px`).join(",")})`;
const pathOf = (pts: [number, number][], k = 1) => `M${pts.map(([x, y]) => `${+((x - FB.x) * k).toFixed(2)} ${+((y - FB.y) * k).toFixed(2)}`).join(" L")} Z`;
/** Phones: the rushes with their filter and red tint baked in (a filter on
 *  a 4K picture and a colour blend over it, eight times over, on an iPhone). */
const TILE_PHONE: Record<string, string> = {
  [HER]: "/hero/model/her-rest-ai-tile-phone.jpg",
  "/hero/model/street.jpg": "/hero/model/street-ai-tile-phone.jpg",
  "/hero/model/studio.jpg": "/hero/model/studio-ai-tile-phone.jpg",
};
const noSubscribe = () => () => {};
const one = () => 1;
const phoneWorldScale = () => (isPhoneDevice() ? Math.min(1, 1 / (window.devicePixelRatio || 1)) : 1);
const sm = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};
const bump = (x: number, c: number, w: number) => Math.max(0, 1 - Math.abs(x - c) / w);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export default function AIFinale({ tRef }: { tRef: MutableRefObject<number> }) {
  const worldRef = useRef<HTMLDivElement>(null);
  const seamRef = useRef<SVGLineElement>(null);
  const porcelainRef = useRef<HTMLDivElement>(null);
  const cheekRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const eyeRef = useRef<HTMLDivElement>(null);
  const eyeHiRef = useRef<HTMLImageElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const blinkRef = useRef<HTMLVideoElement>(null);
  const rushRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const flashRef = useRef<HTMLDivElement>(null);
  // A phone lays her world out at her picture's own pixels (wk, one device
  // pixel to a picture pixel) and the camera scales it the rest of the way:
  // at 5504 x 3072 a phone kept it at 3x, ~160 MB of layer as the scene came
  // in. The sharp eye for the dive keeps its full size in a layer of its own.
  const wk = useSyncExternalStore(noSubscribe, phoneWorldScale, one);

  useEffect(() => {
    let raf = 0;
    let last = -1, lw = 0, lh = 0;
    const blinked = [false, false];

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const t = tRef.current;
      const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
      if (t === last && W === lw && H === lh) return;
      last = t; lw = W; lh = H;

      // The camera: the hero's framing; easing in on the opening half as it
      // opens (.12-.40); into the ruby eye (.42-.52); back out (.80-.96).
      const cover = Math.max(W / WW, H / WH);
      const sA = cover * 1.32;
      const cA = { x: WW * 0.5, y: WH * 0.38 + (WH * 0.5 - WH * 0.38) / 1.32 };
      // ...no closer than keeps the whole machine half (out to the cheek
      // panel's far edge) in frame on a narrow screen.
      const sB = Math.min(sA * 1.75, W / 800);
      const cB = { x: 2930, y: 1010 };
      const sD = Math.max(W, H) / 60;
      const near = sm((t - 0.12) / 0.28) * (1 - sm((t - 0.88) / 0.08));
      const dive = sm((t - 0.42) / 0.1) * (1 - sm((t - 0.8) / 0.08));
      let s = Math.exp(lerp(Math.log(sA), Math.log(sB), near));
      let cx = lerp(cA.x, cB.x, near), cy = lerp(cA.y, cB.y, near);
      s = Math.exp(lerp(Math.log(s), Math.log(sD), dive));
      cx = lerp(cx, EYE.x, Math.min(1, dive * 1.5));
      cy = lerp(cy, EYE.y, Math.min(1, dive * 1.5));
      if (worldRef.current) worldRef.current.style.transform = `translate3d(${(W / 2 - cx * s).toFixed(2)}px, ${(H / 2 - cy * s).toFixed(2)}px, 0) scale(${(s / wk).toFixed(5)})`;
      if (eyeHiRef.current) eyeHiRef.current.style.opacity = sm((dive - 0.08) / 0.2).toFixed(3);

      // The seam down her centre line: draws (.06-.14), heals (.93-.96).
      const seamIn = Math.min(1, Math.max(0, (t - 0.06) / 0.08));
      const seamOut = sm((t - 0.93) / 0.03);
      if (seamRef.current) {
        seamRef.current.style.strokeDashoffset = (1 - seamIn).toFixed(3);
        seamRef.current.style.opacity = (seamIn > 0 ? (1 - seamOut) * (0.85 + 0.15 * Math.sin(t * 900)) : 0).toFixed(3);
      }

      // Her skin unzips from the seam outward (.14-.30), a red edge
      // travelling across; it zips back (.88-.94).
      const lift = sm((t - 0.14) / 0.16) * (1 - sm((t - 0.88) / 0.06));
      const edge = lerp(OPEN_FROM, OPEN_TO, lift);
      if (porcelainRef.current) {
        const m = `linear-gradient(90deg, #000 ${((edge - FB.x) * wk).toFixed(1)}px, transparent ${((edge + 26 - FB.x) * wk).toFixed(1)}px)`;
        porcelainRef.current.style.maskImage = m;
        porcelainRef.current.style.webkitMaskImage = m;
        porcelainRef.current.style.opacity = lift > 0.001 ? "1" : "0";
      }
      if (edgeRef.current) {
        edgeRef.current.style.transform = `translateX(${((edge - OPEN_FROM) * wk).toFixed(1)}px)`;
        edgeRef.current.style.opacity = (lift > 0.001 && lift < 0.995 ? 1 : 0).toString();
      }

      // The cheek panel parts (.30-.38), chrome in the gap; closes (.86-.89).
      const part = sm((t - 0.3) / 0.08) * (1 - sm((t - 0.86) / 0.03));
      if (cheekRef.current) cheekRef.current.style.transform = `translate(${(part * 46 * wk).toFixed(1)}px, ${(part * 34 * wk).toFixed(1)}px) rotate(${(part * 3.5).toFixed(2)}deg)`;
      if (chromeRef.current) chromeRef.current.style.opacity = Math.min(1, part * 3).toFixed(3);
      const wake = sm((t - 0.32) / 0.06) * (1 - sm((t - 0.86) / 0.04));
      if (eyeRef.current) eyeRef.current.style.opacity = (wake * (0.82 + 0.18 * Math.sin(t * 380))).toFixed(3);

      // Her human eye blinks (.39, .975); the ruby eye never does.
      const v = blinkRef.current;
      if (v) {
        const fire = (i: number, at: number) => {
          if (t >= at && t < at + 0.03 && !blinked[i]) {
            blinked[i] = true;
            v.currentTime = 0;
            v.style.opacity = "1";
            v.play().catch(() => {});
          }
          if (t < at - 0.02) blinked[i] = false;
        };
        fire(0, 0.39);
        fire(1, 0.975);
      }

      // Inside the ruby eye: the services rush past, full screen (.52-.80).
      const inside = sm((t - 0.51) / 0.02) * (1 - sm((t - 0.79) / 0.02));
      if (rushRef.current) rushRef.current.style.opacity = inside.toFixed(3);
      if (flashRef.current) flashRef.current.style.opacity = Math.max(bump(t, 0.51, 0.022), bump(t, 0.8, 0.022)).toFixed(3);
      const u = (t - 0.52) / 0.28;
      tileRefs.current.forEach((el, i) => {
        if (!el) return;
        // One after another from deep in, through the camera.
        const k = u * (RUSH.length * 0.5 + 1.2) - i * 0.5;
        const z = -3200 + k * 3400;
        const side = i % 2 ? 1 : -1;
        // Sharp all the way in; a streak only in the last instant.
        const blur = Math.max(0, (z - 380) / 160);
        el.style.transform = `translate3d(${(side * W * 0.06).toFixed(0)}px, ${(((i % 3) - 1) * H * 0.04).toFixed(0)}px, ${z.toFixed(0)}px)`;
        el.style.opacity = (sm((k + 0.1) / 0.35) * (1 - sm((z - 450) / 250))).toFixed(3);
        el.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : "none";
      });
    };

    const ended = () => {
      if (blinkRef.current) blinkRef.current.style.opacity = "0";
    };
    const bv = blinkRef.current;
    bv?.addEventListener("ended", ended);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      bv?.removeEventListener("ended", ended);
    };
  }, [tRef, wk]);

  const face = { left: FB.x * wk, top: FB.y * wk, width: FB.w * wk, height: FB.h * wk, "--ox": `${FB.x}px`, "--oy": `${FB.y}px` } as CSSProperties;
  const porcelainImg = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="aif__porcelain-img"
      src={PORCELAIN_SRC}
      alt=""
      draggable={false}
      style={{ left: (PORCELAIN.x - FB.x) * wk, top: (PORCELAIN.y - FB.y) * wk, width: PORCELAIN.w * wk, height: PORCELAIN.h * wk }}
    />
  );

  return (
    <div className="aif" data-phone={wk < 1 ? "" : undefined} aria-hidden>
      <div ref={worldRef} className="aif__world" style={{ width: WW * wk, height: WH * wk, "--k": wk } as CSSProperties}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="aif__her" src={HER} alt="" draggable={false} />
        {/* Beneath her skin: porcelain, and chrome under the cheek panel. */}
        <div ref={porcelainRef} className="aif__layer aif__face" style={{ ...face, opacity: 0 }}>
          <div ref={chromeRef} className="aif__chrome" style={{ clipPath: poly(CHEEK, wk), opacity: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={CHROME_SRC} alt="" draggable={false} style={{ left: (CHROME_BOX.x - FB.x) * wk, top: (CHROME_BOX.y - FB.y) * wk, width: CHROME_BOX.w * wk, height: CHROME_BOX.h * wk }} />
          </div>
          <div className="aif__layer" style={{ clipPath: `path(evenodd, "${pathOf(FACE, wk)} ${pathOf(CHEEK, wk)}")` }}>{porcelainImg}</div>
          <div ref={cheekRef} className="aif__layer aif__cheek" style={{ transformOrigin: `${(3270 - FB.x) * wk}px ${(1000 - FB.y) * wk}px` }}>
            <div className="aif__layer" style={{ clipPath: poly(CHEEK, wk) }}>{porcelainImg}</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={eyeHiRef}
            className="aif__eye-hi"
            src={EYE_HI}
            alt=""
            draggable={false}
            style={{
              left: (EYE_HI_BOX.x - FB.x) * wk,
              top: (EYE_HI_BOX.y - FB.y) * wk,
              width: EYE_HI_BOX.w,
              height: EYE_HI_BOX.h,
              transform: wk < 1 ? `scale(${wk})` : undefined,
              transformOrigin: "0 0",
              willChange: wk < 1 ? "transform" : undefined,
              opacity: 0,
            }}
          />
          <div ref={eyeRef} className="aif__eye" style={{ left: (EYE.x - 140 - FB.x) * wk, top: (EYE.y - 140 - FB.y) * wk }} />
        </div>
        {/* Her blink, on her human eye only. */}
        <video
          ref={blinkRef}
          className="aif__blink"
          src={BLINK}
          muted
          playsInline
          preload="auto"
          style={{ left: BLINK_RECT.x * wk, top: BLINK_RECT.y * wk, width: BLINK_RECT.w * wk, height: BLINK_RECT.h * wk }}
        />
        {/* The travelling edge of her skin as it pulls back. */}
        <div className="aif__layer aif__face" style={{ ...face, clipPath: poly(FACE, wk) }}>
          <div ref={edgeRef} className="aif__edge" style={{ left: (OPEN_FROM - FB.x) * wk, opacity: 0 }} />
        </div>
        {/* Only the seam's own strip: drawn over the blink as a layer of its
            own, the size of her photo it cost a phone ~160 MB. */}
        <svg className="aif__seam" viewBox={`${SEAM_X - 40} 260 80 1480`} width={80 * wk} height={1480 * wk} style={{ left: (SEAM_X - 40) * wk, top: 260 * wk }}>
          <line ref={seamRef} x1={SEAM_X} y1={300} x2={SEAM_X} y2={1700} pathLength={1} />
        </svg>
      </div>
      <div ref={rushRef} className="aif__rush">
        <div className="aif__tiles">
          {RUSH.map((tile, i) => (
            <div
              key={i}
              ref={(el) => {
                tileRefs.current[i] = el;
              }}
              className="aif__tile"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wk < 1 ? TILE_PHONE[tile.src] ?? tile.src : tile.src} alt="" draggable={false} style={{ objectPosition: tile.pos }} />
              {wk === 1 && <i className="aif__tint" />}
              {tile.grid && <i className="aif__grid" />}
              <i className="aif__dither" />
              <span>{tile.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div ref={flashRef} className="aif__flash" />
    </div>
  );
}
