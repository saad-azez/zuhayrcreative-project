"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useAppReady } from "@/app/animations/useAppReady";
import { isPhoneDevice } from "@/app/lib/device";
import SignatureLogo, { LOGO_CLASS, type SignatureLogoHandle } from "./SignatureLogo";
import "@/app/styles/intro-signal.css";

/**
 * The intro for the model draft (?hero=model): a signal tuning in.
 *
 * The screen powers on as a single line drawn across it; the line draws in
 * to the signature, which writes itself centre stage (the one part kept from
 * the old intro). Behind it the site says hello in the five languages the hero
 * speaks, one at a time, huge, dithered and dim red, each cut a glitch tear,
 * with the HUD naming the language. Then the screen tears away in bands, onto
 * the hero. (The full-bright greetings act that used to come first was dropped
 * on 22 Oct: it repeated what plays behind the logo.)
 *
 * The greetings are drawn into a low-res canvas (one cell per 4 css px),
 * dithered against a Bayer matrix and blown up without smoothing, at 30 fps:
 * a broadcast's frame rate, and light on the main thread while the page loads
 * behind it.
 *
 * Keep the words in step with GREETINGS in app/fonts/noto-sans-kr/subset.mjs:
 * the reveal face ships only the characters it lists.
 */
const GREETINGS = [
  { word: "Hello", code: "EN", lang: "English", say: "hello" },
  { word: "你好", code: "ZH", lang: "Mandarin", say: "nǐ hǎo" },
  { word: "こんにちは", code: "JA", lang: "Japanese", say: "konnichiwa" },
  { word: "안녕하세요", code: "KO", lang: "Korean", say: "annyeonghaseyo" },
  { word: "Hola", code: "ES", lang: "Spanish", say: "hola" },
];

/** Seconds. Power on, each greeting (it quickens), the stutter, the collapse. */
const POWER = 0.45;
/** Each greeting's turn behind the signature. */
const BEAT = 0.9;
/**
 * ?intro=bright (22 Oct, the user: keep the bright greetings, lose the
 * repeat): the greetings at full strength, ONCE, behind the signature as it
 * writes; they quicken, stutter, and collapse into a line under the finished
 * lockup. Seconds after power on.
 */
const HOLDS = [0.62, 0.56, 0.5, 0.46, 0.48];
const STUTTER = 0.5;
const FLASH = 0.055;
const COLLAPSE = 0.3;

const FPS = 30;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const BANDS = 12;
const BANDS_PHONE = 8;

const MAX_MS = 6000;
const MAX_MS_PHONE = 3500;

type Props = { onReveal: () => void; onComplete: () => void };

export default function IntroSignal({ onReveal, onComplete }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef<HTMLElement>(null);
  const langRef = useRef<HTMLElement>(null);
  const sayRef = useRef<HTMLElement>(null);
  const tcRef = useRef<HTMLElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const logoWrapRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<SignatureLogoHandle>(null);
  const exited = useRef(false);

  const [duringTransition] = useState(
    () =>
      typeof window !== "undefined" &&
      !!(window as Window & { __blockTransition?: boolean }).__blockTransition,
  );
  const [bandCount] = useState(() => (typeof window !== "undefined" && isPhoneDevice() ? BANDS_PHONE : BANDS));
  const [logoDone, setLogoDone] = useState(duringTransition);

  const ready = useAppReady({
    minMs: duringTransition ? 0 : 800,
    maxMs: duringTransition ? 0 : isPhoneDevice() ? MAX_MS_PHONE : MAX_MS,
  });

  // ── The greetings, then the line, then the signature ────────────────────
  useEffect(() => {
    if (duringTransition) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const src = document.createElement("canvas");
    const sctx = src.getContext("2d", { willReadFrequently: true });
    const out = document.createElement("canvas");
    const octx = out.getContext("2d");
    let raf = 0;
    let killed = false;
    const tweens: gsap.core.Animation[] = [];
    // The bright one-pass version is the intro (the user, 22 Oct); ?intro=faint
    // keeps the dim looping one to compare.
    const bright = new URLSearchParams(window.location.search).get("intro") !== "faint";
    if (rootRef.current) rootRef.current.dataset.v = bright ? "bright" : "faint";

    // Into the signature: the line shrinks to the lockup's width and goes,
    // and the lockup flickers on and starts writing.
    let intoLogo = false;
    let safety = 0;
    const toLogo = () => {
      if (killed || intoLogo) return;
      intoLogo = true;
      const line = lineRef.current;
      if (bright) {
        // The line opens into the greetings at full strength (see tick).
        if (line) tweens.push(gsap.to(line, { opacity: 0, duration: 0.18, ease: "power1.out" }));
      } else if (canvas) {
        // The signal stays on behind the signature, dim and red.
        canvas.style.opacity = "0";
        tweens.push(gsap.to(canvas, { opacity: 0.36, duration: 0.8, delay: 0.5, ease: "power1.inOut" }));
      }
      if (line && !bright) {
        tweens.push(
          gsap.fromTo(line, { opacity: 1, scaleX: 1 }, { scaleX: 0.36, duration: 0.42, ease: "expo.out" }),
          gsap.to(line, { opacity: 0, duration: 0.5, delay: 0.3, ease: "power2.out" }),
        );
      }
      const logo = logoWrapRef.current;
      if (logo) {
        tweens.push(
          gsap.fromTo(
            logo,
            { opacity: 0 },
            { keyframes: [{ opacity: 1, duration: 0.05 }, { opacity: 0.2, duration: 0.05 }, { opacity: 1, duration: 0.06 }, { opacity: 0.5, duration: 0.04 }, { opacity: 1, duration: 0.1 }], delay: 0.12 },
          ),
        );
      }
      logoRef.current?.play();
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canvas || !ctx || !sctx || !octx || reduced) {
      if (lineRef.current) lineRef.current.style.opacity = "0";
      toLogo();
      return () => {
        killed = true;
        tweens.forEach((t) => t.kill());
      };
    }

    const phone = isPhoneDevice();
    const CELL = phone ? 3 : 4;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, bw = 0, bh = 0;
    let img: ImageData | null = null;
    const size = () => {
      // Never zero: a window opened hidden or in the background can report
      // 0 x 0, and a zero-sized ImageData throws.
      W = Math.max(1, window.innerWidth);
      H = Math.max(1, window.innerHeight);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      bw = Math.ceil(W / CELL);
      bh = Math.ceil(H / CELL);
      src.width = out.width = bw;
      src.height = out.height = bh;
      img = octx.createImageData(bw, bh);
    };
    size();
    window.addEventListener("resize", size);

    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-reveal").trim() || "sans-serif";
    const font = (px: number) => `700 ${px}px ${family}`;

    // The schedule, in seconds from power on.
    const starts: number[] = [];
    let acc = POWER;
    for (const h of HOLDS) { starts.push(acc); acc += h; }
    const stutterAt = acc;
    const collapseAt = stutterAt + STUTTER;
    const endAt = bright ? collapseAt + COLLAPSE : POWER;
    // Bright: the pass is over; the line sits under the lockup, draws in to
    // its width and goes, and the signal is off.
    let passDone = false;
    const endPass = () => {
      if (passDone) return;
      passDone = true;
      cancelAnimationFrame(raf);
      if (hudRef.current) hudRef.current.style.opacity = "0";
      tweens.push(gsap.to(canvas, { opacity: 0, duration: 0.25, ease: "power1.out" }));
      const line = lineRef.current;
      if (line) {
        tweens.push(
          gsap.fromTo(line, { opacity: 1, scaleX: 1 }, { scaleX: 0.36, duration: 0.42, ease: "expo.out" }),
          gsap.to(line, { opacity: 0, duration: 0.5, delay: 0.3, ease: "power2.out" }),
        );
      }
    };

    let seed = 0x9e3779b9;
    const rnd = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) % 100000) / 100000;
    };

    let shown = -1;
    const label = (i: number) => {
      if (i === shown) return;
      shown = i;
      const g = GREETINGS[i];
      if (idxRef.current) idxRef.current.textContent = `0${i + 1}/0${GREETINGS.length}`;
      if (langRef.current) langRef.current.textContent = `${g.code} · ${g.lang}`;
      if (sayRef.current) sayRef.current.textContent = g.say;
    };

    // One frame of the signal: `word` drawn at `scale`, resolved to
    // `density` (0 static .. 1 locked), torn by `g` (0..1), squashed to `sy`.
    const draw = (word: string, density: number, g: number, sy: number, scale: number, dim = false) => {
      if (!img) return;
      sctx.globalCompositeOperation = "source-over";
      sctx.fillStyle = "#000";
      sctx.fillRect(0, 0, bw, bh);
      sctx.font = font(100);
      const wd = sctx.measureText(word).width || 1;
      const px = Math.min((100 * bw * 0.84) / wd, bh * 0.56) * scale;
      sctx.font = font(px);
      sctx.textAlign = "center";
      // Centred on its own ink, so every script sits level with the
      // signature's middle (on the em box, with a nudge down, they sat
      // 7-21 px low on desktop).
      sctx.textBaseline = "alphabetic";
      const ink = sctx.measureText(word);
      sctx.globalCompositeOperation = "lighter";
      const split = 1 + g * 9;
      const cx = bw / 2, cy = bh / 2 + (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2;
      sctx.fillStyle = "#ff0000";
      sctx.fillText(word, cx - split, cy);
      sctx.fillStyle = "#0000ff";
      sctx.fillText(word, cx + split * 0.7, cy + g * 2);
      sctx.fillStyle = "#00ff00";
      sctx.fillText(word, cx, cy);

      const s = sctx.getImageData(0, 0, bw, bh).data;
      const d = img.data;
      const amp = (1 - density) * 0.85;
      const ghost = 0.32 + g * 0.9;
      const staticOdds = 0.012 + g * 0.06;
      for (let y = 0; y < bh; y++) {
        const row = (y & 3) * 4;
        for (let x = 0; x < bw; x++) {
          const i = (y * bw + x) * 4;
          const b = BAYER[row + (x & 3)];
          const c = s[i + 1] / 255;
          const r = rnd();
          let R = 0, G = 0, B = 0;
          if (dim) {
            if (c > b) { R = 120; G = 8; B = 34; }
            else if ((s[i] / 255) * ghost > b) { R = 60; G = 2; B = 16; }
          } else if (c * density + (r - 0.5) * amp > b) {
            if (c > 0.5) { R = 246; G = 238; B = 240; }
            else if (r > 0.93) { R = 220; G = 20; B = 60; }
            else { R = 96; G = 84; B = 88; }
          } else if ((s[i] / 255) * ghost > b) { R = 220; G = 20; B = 60; }
          else if ((s[i + 2] / 255) * ghost * 0.8 > b) { R = 128; G = 0; B = 32; }
          else if (r < staticOdds) { R = 58; G = 4; B = 16; }
          d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);

      // Blown up, unsmoothed, into the screen: in torn strips while glitching.
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cp = CELL * dpr;
      const mid = canvas.height / 2;
      if (g < 0.05) {
        ctx.drawImage(out, 0, 0, bw, bh, 0, mid - (bh * cp * sy) / 2, bw * cp, bh * cp * sy);
      } else {
        for (let y0 = 0; y0 < bh; ) {
          const hs = Math.min(bh - y0, 2 + Math.floor(rnd() * 14));
          const dx = rnd() < g * 0.55 ? (rnd() - 0.5) * g * bw * 0.22 : 0;
          ctx.drawImage(out, 0, y0, bw, hs, dx * cp, mid + (y0 - bh / 2) * cp * sy, bw * cp, hs * cp * sy);
          y0 += hs;
        }
        // A few blocks lifted out of place.
        const blocks = Math.floor(g * 5);
        for (let k = 0; k < blocks; k++) {
          const w = 8 + rnd() * bw * 0.3, h = 2 + rnd() * bh * 0.12;
          const x = rnd() * (bw - w), y = rnd() * (bh - h);
          ctx.drawImage(out, x, y, w, h, (x + (rnd() - 0.5) * bw * 0.3) * cp, mid + (y - bh / 2 + (rnd() - 0.5) * 6) * cp * sy, w * cp, h * cp * sy);
        }
      }
    };

    let t0 = 0;
    let lastFrame = -1;
    const tick = (now: number) => {
      if (killed) return;
      raf = requestAnimationFrame(tick);
      const t = (now - t0) / 1000;
      const frame = Math.floor(t * FPS);
      if (frame === lastFrame) return;
      lastFrame = frame;
      if (tcRef.current) {
        const ff = frame % FPS, ss = Math.floor(t) % 60;
        tcRef.current.textContent = `00:00:${String(ss).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
      }
      const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

      if (t < POWER) {
        // Power on: a single line drawn out across the screen.
        const line = lineRef.current;
        if (line) {
          line.style.opacity = "1";
          line.style.transform = `scaleX(${ease(t / POWER).toFixed(3)})`;
        }
        return;
      }
      toLogo();
      if (bright) {
        if (t < stutterAt) {
          let i = 0;
          while (i < HOLDS.length - 1 && t >= starts[i + 1]) i++;
          const local = t - starts[i];
          label(i);
          // The first opens out of the line; each cut after is a tear, with
          // a stray flicker now and then while it holds.
          const density = i === 0 ? 0.35 + 0.65 * ease(local / 0.3) : 0.5 + 0.5 * ease(local / 0.2);
          let g = Math.max(0, 1 - local / 0.17);
          if (g === 0 && rnd() < 0.07) g = 0.25 + rnd() * 0.3;
          const sy = i === 0 ? Math.max(0.006, ease(local / 0.22)) : 1;
          draw(GREETINGS[i].word, density, g, sy, 1 + 0.07 * (local / HOLDS[i]));
          return;
        }
        if (t < collapseAt) {
          // The stutter: all five, a frame or two each, quickening, breaking up.
          const u = (t - stutterAt) / STUTTER;
          const i = (Math.floor((t - stutterAt) / (FLASH * (1 - u * 0.5))) + 1) % GREETINGS.length;
          label(i);
          draw(GREETINGS[i].word, 0.75 + rnd() * 0.25, 0.45 + u * 0.55, 1, 1.02 + u * 0.12);
          return;
        }
        if (t < endAt) {
          // The collapse: everything squeezed into one bright line.
          const u = (t - collapseAt) / COLLAPSE;
          label(0);
          draw(GREETINGS[0].word, 1, 0.5 * (1 - u), Math.max(0.004, 1 - Math.pow(u, 0.6)), 1.1);
          return;
        }
        endPass();
        return;
      }
      // Behind the signature: the greetings carry on, slow, dim and red.
      const amb = t - endAt;
      const i = Math.floor(amb / BEAT) % GREETINGS.length;
      const local = amb % BEAT;
      label(i);
      let g = Math.max(0, 1 - local / 0.12) * 0.6;
      if (g === 0 && rnd() < 0.05) g = 0.3;
      draw(GREETINGS[i].word, 1, g, 1, 1.18 + 0.05 * (local / BEAT), true);
    };

    // Start once the reveal face is in, so the first greeting is in it; never
    // wait more than a beat for it.
    const fontsIn = Promise.race([
      document.fonts.load(font(64), GREETINGS.map((g) => g.word).join("")).catch(() => null),
      new Promise((r) => setTimeout(r, 700)),
    ]);
    fontsIn.then(() => {
      if (killed) return;
      t0 = performance.now();
      // A hidden tab stops rAF; the signature must still come, and with it
      // the way out.
      safety = window.setTimeout(toLogo, (endAt + 1.5) * 1000);
      if (hudRef.current) hudRef.current.style.opacity = "1";
      raf = requestAnimationFrame(tick);
    });

    return () => {
      killed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
      window.removeEventListener("resize", size);
      tweens.forEach((t) => t.kill());
    };
  }, [duringTransition]);

  // ── Exit: once the page is ready and the signature is written ───────────
  useEffect(() => {
    if (!ready || !logoDone || exited.current) return;
    exited.current = true;
    const root = rootRef.current;
    if (!root) {
      onReveal();
      onComplete();
      return;
    }
    onReveal();
    if (duringTransition) {
      const tw = gsap.to(root, { opacity: 0, duration: 0.45, ease: "power2.inOut", onComplete });
      return () => { tw.kill(); };
    }
    // The lockup glitches off, then the screen tears away in bands, each
    // band out to its own side, a red edge leading.
    const tl = gsap.timeline({ onComplete });
    const logo = logoWrapRef.current;
    if (logo) {
      tl.to(logo, {
        keyframes: [
          { x: -6, opacity: 0.6, duration: 0.04 },
          { x: 8, opacity: 1, duration: 0.04 },
          { x: -3, opacity: 0.3, duration: 0.04 },
          { x: 0, opacity: 0, duration: 0.08 },
        ],
      }, 0);
    }
    const bands = root.querySelectorAll<HTMLElement>(".intro-signal__band");
    bands.forEach((b, i) => {
      const dir = i % 2 ? 1 : -1;
      tl.to(b, { xPercent: dir * 105, duration: 0.62, ease: "power3.in" }, 0.12 + ((i * 7) % bands.length) * 0.022);
    });
    return () => { tl.kill(); };
  }, [ready, logoDone, duringTransition, onReveal, onComplete]);

  return (
    <div ref={rootRef} className="intro-signal" aria-hidden>
      {Array.from({ length: bandCount }, (_, i) => (
        <i
          key={i}
          className="intro-signal__band"
          data-dir={i % 2 ? "r" : "l"}
          style={{ top: `${(i / bandCount) * 100}%`, height: `calc(${100 / bandCount}% + 1px)` }}
        />
      ))}
      {!duringTransition && (
        <>
          <canvas ref={canvasRef} className="intro-signal__canvas" />
          <i className="intro-signal__scan" />
          <div ref={hudRef} className="intro-signal__hud">
            <i className="intro-signal__crop intro-signal__crop--tl" />
            <i className="intro-signal__crop intro-signal__crop--tr" />
            <i className="intro-signal__crop intro-signal__crop--bl" />
            <i className="intro-signal__crop intro-signal__crop--br" />
            <p className="intro-signal__tl"><i />Live · Greeting</p>
            <p className="intro-signal__tr"><b ref={tcRef}>00:00:00:00</b></p>
            <p className="intro-signal__bl"><b ref={idxRef}>01/05</b><span ref={langRef}>EN · English</span></p>
            <p className="intro-signal__br"><b ref={sayRef}>hello</b></p>
          </div>
          <div ref={lineRef} className="intro-signal__line" />
          <div className="intro-signal__logo">
            <div ref={logoWrapRef} className={LOGO_CLASS} style={{ opacity: 0 }}>
              <SignatureLogo ref={logoRef} className="w-full" onComplete={() => setLogoDone(true)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
