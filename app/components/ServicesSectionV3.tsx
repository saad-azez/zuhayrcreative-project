"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import { useLocomotiveScroll } from "./LocomotiveScrollProvider";
import { ScrollTrigger } from "gsap/ScrollTrigger";
/* The tunnel is a WebGL scene that only mounts once the section is leased
   (see below), so its code is fetched then too rather than with the page. */
const WebGLTextTunnel = dynamic(() => import("./WebGLTextTunnel"), { ssr: false });
import { useSceneLease } from "@/app/animations/hooks/useNearViewport";
import ChromaticMetal from "./ChromaticMetal";
import CommStreet from "./CommStreet";
import ContentSet from "./ContentSet";
import AIFinale from "./AIFinale";
import { useArrowMorph } from "./useArrowMorph";
import { useHeroVariant } from "@/app/lib/useHeroVariant";
import { isPhoneDevice } from "@/app/lib/device";
import "@/app/styles/services-section-v3.css";


interface Service {
  index: string;
  name: string;
  description: string;
  tag: string;
}

const SERVICES: Service[] = [
  {
    index: "00_1",
    tag: "WEB",
    name: "Web Design",
    description:
      "Premium interfaces engineered for clarity, motion, and conversion.",
  },
  {
    index: "00_2",
    tag: "AI",
    name: "AI Automation",
    description:
      "Custom agents and pipelines that compress hours of work into minutes.",
  },
  {
    index: "00_3",
    tag: "SEO",
    name: "Search Growth",
    description:
      "Technical, content, and link strategies that move rankings on intent.",
  },
  {
    index: "00_4",
    tag: "BRAND",
    name: "Brand Systems",
    description:
      "Identities and visual languages that scale across every touchpoint.",
  },
];

/**
 * Detailed services for the "Expand" sideways-scroll view (monopo-style).
 *
 * ⚠️ PLACEHOLDER CONTENT — these sub-services are reasonable guesses grouped
 * under the four general buckets. Replace `items` (and copy) with the real
 * detailed services from the old website once provided.
 */
interface ServiceDetail {
  index: string;
  tag: string;
  name: string;
  blurb: string;
  items: string[];
}

const SERVICE_DETAILS: ServiceDetail[] = [
  {
    index: "01",
    tag: "WEB",
    name: "Web Design & Development",
    blurb: "Interfaces engineered for clarity, motion, and conversion.",
    items: [
      "UI / UX Design",
      "Webflow Development",
      "E-commerce Builds",
      "Landing Pages",
      "Design Systems",
      "Motion & Interaction",
    ],
  },
  {
    index: "02",
    tag: "AI",
    name: "AI Automation",
    blurb: "Custom agents and pipelines that compress hours into minutes.",
    items: [
      "Custom AI Agents",
      "Workflow Automation",
      "Chatbots & Assistants",
      "Data Pipelines",
      "LLM Integrations",
      "Process Audits",
    ],
  },
  {
    index: "03",
    tag: "SEO",
    name: "Search Growth",
    blurb: "Technical, content, and link strategies that move rankings.",
    items: [
      "Technical SEO",
      "Content Strategy",
      "Link Building",
      "Local SEO",
      "Analytics & Reporting",
      "Keyword Research",
    ],
  },
  {
    index: "04",
    tag: "BRAND",
    name: "Brand Systems",
    blurb: "Identities and visual languages that scale everywhere.",
    items: [
      "Logo & Identity",
      "Brand Guidelines",
      "Visual Language",
      "Naming & Messaging",
      "Social Templates",
      "Brand Strategy",
    ],
  },
];

/**
 * The model hero variant's services (/?hero=model, draft only): the new list
 * and copy (services-copy-v4, 21 Oct): monopo's wording where it overlaps
 * fromanother's, plus AI Integration. Order (the user, 21 Oct): Brand,
 * Experience, Communication, Content, AI. The live site keeps SERVICES and
 * SERVICE_DETAILS above until the client says otherwise.
 */
const MODEL_SERVICES: Service[] = [
  {
    index: "00_1",
    tag: "BRAND",
    name: "Brand Design",
    description: "Identities built as systems, distinct at a glance, consistent everywhere.",
  },
  {
    index: "00_2",
    tag: "EXPERIENCE",
    name: "Experience Design",
    description: "Digital experiences designed to be felt, built to perform.",
  },
  {
    index: "00_3",
    tag: "COMMUNICATION",
    name: "Communication Design",
    description: "One idea, one point of view, carried through everything we make.",
  },
  {
    index: "00_4",
    tag: "CONTENT",
    name: "Content Production",
    description: "Moving image made to hold attention.",
  },
  {
    index: "00_5",
    tag: "AI",
    name: "AI Integration",
    description: "AI woven into your brand, your experiences, and how you're found.",
  },
];

const MODEL_DETAILS: ServiceDetail[] = [
  {
    index: "01",
    tag: "BRAND",
    name: "Brand Design",
    blurb: "Identities built as systems, distinct at a glance, consistent everywhere.",
    items: ["Brand Development", "Brand Consultation", "Concept Design", "VI / CI Design"],
  },
  {
    index: "02",
    tag: "EXPERIENCE",
    name: "Experience Design",
    blurb: "Digital experiences designed to be felt, built to perform.",
    items: ["UX Design", "UI Design", "Website & App Development", "E-commerce Development", "Digital Experience"],
  },
  {
    index: "03",
    tag: "COMMUNICATION",
    name: "Communication Design",
    blurb: "One idea, one point of view, carried through everything we make.",
    items: ["Communication Strategy", "Creative Planning", "Creative & Art Direction", "Social Media"],
  },
  {
    index: "04",
    tag: "CONTENT",
    name: "Content Production",
    blurb: "Moving image made to hold attention.",
    items: ["Video / Still Production", "Commercial Planning / Production", "Graphic / Motion Design", "CGI"],
  },
  {
    index: "05",
    tag: "AI",
    name: "AI Integration",
    blurb: "AI woven into your brand, your experiences, and how you're found.",
    items: ["AI Consultation", "AI Experience Development", "Generative Content Production", "Generative Engine Optimization (GEO)"],
  },
];

/** A value per breakpoint; the scene's data-bp shows the right one. */
function W({ d, t, p }: { d: string; t: string; p: string }) {
  return (
    <>
      <span data-w="desktop">{d}</span>
      <span data-w="tablet">{t}</span>
      <span data-w="phone">{p}</span>
    </>
  );
}

/** The four depth rails from a pane's corners back to the pane behind it. */
function Rails() {
  return (
    <>
      <i className="svv3__ly-rail svv3__ly-rail--tl" />
      <i className="svv3__ly-rail svv3__ly-rail--tr" />
      <i className="svv3__ly-rail svv3__ly-rail--bl" />
      <i className="svv3__ly-rail svv3__ly-rail--br" />
    </>
  );
}

/**
 * Services Section v3.
 * All service names ride a single scrolling WebGL "text tunnel" strip: each
 * name descends distorted from the top, straightens out at the centre, then
 * warps away below while the next one is already arriving — a continuous
 * loop that automatically includes any names added to SERVICES. The meta
 * layer (tag + name + description) crossfades in lock-step with whichever
 * name is centred, and hovering the tunnel freezes the scroll so it can be
 * read. On touch / reduced-motion it falls back to a static list.
 */
export default function ServicesSectionV3() {
  const sectionRef = useRef<HTMLElement>(null);
  // The tunnel's WebGL: built at load, released on a phone once the reader
  // is far away and rebuilt on approach (useSceneLease — memory).
  const tunnelLeased = useSceneLease(sectionRef, { initial: true, label: "Services" });
  const stageRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();
  // Tunnel runs on every device; only reduced-motion falls back to the list.
  const enableEffects = !prefersReducedMotion;

  // Tunnel type scales with the viewport so names fit the room at every width.
  const [tunnel, setTunnel] = useState({ fontSize: 84, gap: 224 });
  // Back-wall inset, in viewBox percent (the room SVG is 0 0 100 100 with
  // preserveAspectRatio="none", so these are percentages of the frame box).
  // Desktop keeps the original 22% square room. A phone viewport is portrait,
  // so the same 22% leaves a 56%-wide slot only ~218px across — narrower than
  // the tunnel names, which then straddle the wall's vertical edges and read
  // as if the animation and the frame belong to different layouts. Widening
  // and flattening the wall there lands the centred name inside it.
  const [room, setRoom] = useState({ x: 22, y: 22 });
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const fontSize = Math.round(Math.max(38, Math.min(84, vw * 0.075)));
      // Gap comes from viewport HEIGHT, not font size, so the number of bands
      // in view (~4.3, matching desktop) stays constant on every screen. Tying
      // it to the font packed ~7 bands onto a phone, so two names read at once.
      const targetBand = window.innerHeight / 4.3;
      const gap = Math.max(
        Math.round(fontSize * 0.8),
        Math.round(targetBand - fontSize * 1.15),
      );
      setTunnel({ fontSize, gap });
      setRoom(
        vw <= 600
          ? { x: 7, y: 28 }
          : vw <= 980
            ? { x: 14, y: 25 }
            : { x: 22, y: 22 },
      );
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // The tunnel bakes its text into a 2D-canvas texture, so it needs a real
  // font-family STRING — it can't use `var(--font-display)`. Two things follow:
  // the family name is generated by next/font (a hashed `__facade_…`), so it
  // has to be read back off the CSS variable at runtime; and canvas silently
  // rasterises a fallback if the face isn't loaded yet, so the swap waits for
  // document.fonts before rebuilding the strip.
  //
  // Read off the display TOKEN, not off one face's own variable, so the
  // tunnel changes face with the rest of the headings (it named --font-facade
  // and would have stayed on Façade through the Doto trial). The token
  // computes to a whole family list, which canvas and document.fonts take.
  const [tunnelFont, setTunnelFont] = useState(
    "Georgia, 'Times New Roman', serif",
  );
  useEffect(() => {
    const family = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-display")
      .trim();
    if (!family) return;
    let cancelled = false;
    const apply = () => {
      if (!cancelled) setTunnelFont(family);
    };
    try {
      // Resolves (or rejects) once the face is ready either way — apply on both
      // so a rejection can't leave the tunnel stuck on the serif fallback.
      document.fonts.load(`400 84px ${family}`).then(apply, apply);
    } catch {
      document.fonts.ready.then(apply);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Which service is currently readable at the tunnel's centre — reported by
  // the tunnel itself (all names live on its scrolling strip and loop in
  // sequence); drives the meta layer crossfade.
  const [activeIdx, setActiveIdx] = useState(0);

  // ── The model hero variant (/?hero=model, draft) ──
  // There the section holds in place for a few screens and the page's scroll,
  // not the clock, moves the names through the tunnel, past the model's face
  // and neck in close-up behind them (HeroModel's fixed stage, which carries
  // her on from the hero; the section is transparent over it). When "Web Design" settles at the centre
  // a sample site opens around her (the beat below), and closes as it leaves.
  const modelMode = useHeroVariant() === "model";
  const services = modelMode ? MODEL_SERVICES : SERVICES;
  const details = modelMode ? MODEL_DETAILS : SERVICE_DETAILS;
  const bandRef = useRef<number | null>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const cmTRef = useRef(0);
  const ctTRef = useRef(0);
  const aiTRef = useRef(0);
  useEffect(() => {
    if (!modelMode) return;
    const stage = stageRef.current;
    const pin = pinRef.current;
    if (!stage || !pin) return;
    const n = MODEL_SERVICES.length;
    let raf = 0;
    let shown = 0;
    let open = -1;
    let expOpen = -1;
    let sceneOpen = -1;
    let expProg = -1;
    let cmOpen = -1;
    let cmProg = -1;
    let ctOpen = -1;
    let aiOpen = -1;
    let lySp = -1;
    let lyOrb = -1;
    let lyHov = -1;
    let lyW = -1;
    let lyCov = -1;
    let lyH = -1;
    // Each scene exists only around its own stretch of the section: switched
    // off outright (display: none) outside it, so nothing in it composites,
    // animates or holds GPU memory, and switched back on a little before it
    // fades in, while still invisible, so its pictures are decoded and up on
    // the GPU by the time it shows. [selector, from band, to band].
    const SCENES: [string, number, number][] = [
      [".svv3__brand", -9, 1.3],
      [".svv3__layers", 0.1, 2.0],
      [".svv3__comm", 1.1, 3.0],
      [".svv3__content", 2.1, 4.0],
      [".svv3__ai", 3.1, 9],
    ];
    const sceneEls = SCENES.map(([sel]) => pin.querySelector<HTMLElement>(sel));
    const sceneOn = SCENES.map(() => true);
    const phone = isPhoneDevice();
    let then = performance.now();
    let lastEnter = -1;
    let lastBand = -1;
    let lastEnterY = 1e9;
    // While the section is moving, the shared metal rims (and the dock's
    // glass, which reads its silhouette back from the GPU on every rim
    // frame) hold still: those readbacks stalled the page on every frame of
    // a scroll through the scenes. They resume as soon as it settles.
    let busyUntil = 0;
    let busy = false;
    const setBusy = (on: boolean) => {
      if (on === busy) return;
      busy = on;
      document.body.classList.toggle("scene-busy", on);
      if (!on) window.dispatchEvent(new Event("app:scene-uncover"));
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // Time-based easing: the same feel at 60, 120 or 170 Hz (about 0.14 of
      // the way per 60 Hz frame), settling exactly so the tunnel can rest.
      const k = 1 - Math.pow(0.86, Math.min(0.1, (now - then) / 1000) * 60);
      then = now;
      const r = stage.getBoundingClientRect();
      // Leaving: the section's foot dissolves into the page as it goes (see
      // the pin's data-exit in the stylesheet).
      const exit = Math.min(1, Math.max(0, (window.innerHeight - r.bottom) / (0.7 * window.innerHeight)));
      const bandPx = Math.round(exit * 0.5 * window.innerHeight);
      if (bandPx !== lastBand) {
        lastBand = bandPx;
        if (bandPx > 0) {
          pin.dataset.exit = "";
          pin.style.setProperty("--band", `${bandPx}px`);
        } else delete pin.dataset.exit;
      }
      if (r.bottom < 0 || r.top > window.innerHeight) {
        setBusy(false);
        return;
      }
      const travel = Math.max(1, r.height - window.innerHeight);
      const target = Math.min(1, Math.max(0, -r.top / travel));
      const moved = Math.abs(target - shown) >= 1e-4;
      shown = moved ? shown + (target - shown) * k : target;
      if (moved) busyUntil = now + 250;
      setBusy(now < busyUntil);
      // From the first name just arriving to the last one about to leave —
      // inside the seams either side, so the strip (which loops) never shows
      // the last name before the first.
      // The finale (the last band) gets the last 30% of the section to itself;
      // the bands before it share the rest at their old pace.
      const split = 0.7;
      const lastStart = n - 1 - 0.45;
      let band = shown < split ? -0.45 + (shown / split) * (lastStart + 0.45) : lastStart + ((shown - split) / (1 - split)) * 0.9;
      // Scrolling in (the section's top still below the top of the screen):
      // the strip holds still on screen, fades in, and the first name starts
      // rising from the seam, so the scroll itself brings it up.
      const vh0 = window.innerHeight;
      const entering = r.top > 0;
      const arrive = entering ? Math.min(1, Math.max(0, 1 - r.top / vh0)) : 1;
      if (entering) band = -0.5 + 0.05 * arrive;
      const ey = entering ? -r.top : 0;
      const enterR = Math.round(arrive * 1000) / 1000;
      if (enterR !== lastEnter) pin.style.setProperty("--enter", (lastEnter = enterR).toFixed(3));
      if (Math.round(ey) !== lastEnterY) pin.style.setProperty("--enter-y", `${(lastEnterY = Math.round(ey))}px`);
      bandRef.current = band;
      // The Brand Design beat (band 0, the first name, already near the
      // centre as the section pins): builds over the first 12% of the
      // section's scroll, holds while the name sits at the centre, and comes
      // apart as it leaves (half a band past the centre to 0.85).
      const enter = Math.min(1, shown / 0.12);
      const leave = Math.min(1, Math.max(0, (0.85 - band) / 0.35));
      const next = Math.round(Math.min(enter, leave) * 1000) / 1000;
      if (next !== open) pin.style.setProperty("--brand-open", (open = next).toFixed(3));
      // The Experience Design beat (band 1): in from 0.55 to 0.95, holds to
      // 1.45, out by 1.85. Either scene up steps the names and Expand back.
      const exp = Math.round(Math.min(Math.max(0, Math.min(1, (band - 0.55) / 0.4)), Math.max(0, Math.min(1, (1.85 - band) / 0.4))) * 1000) / 1000;
      if (exp !== expOpen) pin.style.setProperty("--exp-open", (expOpen = exp).toFixed(3));
      // ...and how far through it the reader is (0..1), for its sequence.
      const expT = Math.round(Math.min(1, Math.max(0, (band - 0.55) / 1.3)) * 1000) / 1000;
      if (expT !== expProg) pin.style.setProperty("--exp-t", (expProg = expT).toFixed(3));
      // Experience Design, exploded layers: the scene comes apart into its
      // layers in depth, reflows desktop -> tablet -> phone while apart (every
      // layer re-laying itself), opens back out, and goes back together.
      const ly = layersRef.current;
      if (ly) {
        const k = (a: number, b: number) => Math.min(1, Math.max(0, (expT - a) / (b - a)));
        const sm = (x: number) => x * x * (3 - 2 * x);
        const r3 = (x: number) => Math.round(x * 1000) / 1000;
        // spread: apart .18-.32, held, back together .70-.80
        const sp = r3(sm(k(0.18, 0.32)) * (1 - sm(k(0.7, 0.8))));
        // the camera drifts round the stack the whole time it is apart
        const orb = r3(k(0.18, 0.8));
        // the cursor travels to the button and hovers it (desktop)
        const hov = r3(sm(k(0.28, 0.36)));
        // the stack's own size: full screen, shrinking to a desktop-shaped
        // stack as it comes apart, then tablet (.40-.46), phone (.52-.58)
        // and back to desktop (.64-.70)
        const toTab = sm(k(0.4, 0.46));
        const toPh = sm(k(0.52, 0.58));
        const back = sm(k(0.64, 0.7));
        const vw = window.innerWidth, vh = window.innerHeight;
        // On a portrait screen the desktop stack is still desktop-shaped
        // (16:10, most of the width), not the screen's own shape.
        const portrait = vw < vh * 1.1;
        const dw1 = portrait ? 0.8 * vw : 0.56 * vw;
        const dh1 = portrait ? dw1 / 1.6 : 0.5 * vh;
        const dw = vw + (dw1 - vw) * sp, dh = vh + (dh1 - vh) * sp;
        // tablet and phone at their true sizes, on one scale: an 834x1194
        // tablet and a 390x844 phone, as big as the tablet fits
        const unit = Math.min((0.68 * vh) / 1194, (0.6 * vw) / 834);
        const tabW = 834 * unit, tabH = 1194 * unit;
        const phW = 390 * unit, phH = 844 * unit;
        const mix = (a: number, b: number, t: number) => a + (b - a) * t;
        let lw = mix(dw, tabW, toTab), lh = mix(dh, tabH, toTab);
        lw = mix(lw, phW, toPh); lh = mix(lh, phH, toPh);
        lw = mix(lw, dw, back); lh = mix(lh, dh, back);
        lw = Math.round(lw); lh = Math.round(lh);
        if (lw !== lyW) { ly.style.setProperty("--lw", `${lw}px`); ly.style.setProperty("--lwn", String(lw)); lyW = lw; }
        if (lh !== lyH) ly.style.setProperty("--lh", `${(lyH = lh)}px`);
        // The photos keep one fixed, viewport-sized raster and are scaled
        // to cover the stack's box (a resized photo re-rastered, mask and
        // all, on every frame of the spread and the reflow).
        const cov = r3(Math.max(lw / vw, lh / vh));
        if (cov !== lyCov) ly.style.setProperty("--cov", (lyCov = cov).toFixed(3));
        const bp = back > 0.5 ? "desktop" : toPh > 0.5 ? "phone" : toTab > 0.5 ? "tablet" : "desktop";
        if (bp !== ly.dataset.bp) ly.dataset.bp = bp;
        if (sp !== lySp) ly.style.setProperty("--sp", (lySp = sp).toFixed(3));
        if (orb !== lyOrb) ly.style.setProperty("--orb", (lyOrb = orb).toFixed(3));
        if (hov !== lyHov) ly.style.setProperty("--hov", (lyHov = hov).toFixed(3));
      }
      // Communication Design (band 2): the art director's pass. The scene's
      // elements each read their own window of --cm-t.
      const cm = Math.round(Math.min(Math.max(0, Math.min(1, (band - 1.55) / 0.4)), Math.max(0, Math.min(1, (2.85 - band) / 0.4))) * 1000) / 1000;
      if (cm !== cmOpen) pin.style.setProperty("--cm-open", (cmOpen = cm).toFixed(3));
      const cmT = Math.round(Math.min(1, Math.max(0, (band - 1.55) / 1.3)) * 1000) / 1000;
      cmTRef.current = cmT;
      if (cmT !== cmProg) pin.style.setProperty("--cm-t", (cmProg = cmT).toFixed(3));
      // Content Production (band 3): it was a shoot all along.
      const ct = Math.round(Math.min(Math.max(0, Math.min(1, (band - 2.55) / 0.4)), Math.max(0, Math.min(1, (3.85 - band) / 0.4))) * 1000) / 1000;
      if (ct !== ctOpen) pin.style.setProperty("--ct-open", (ctOpen = ct).toFixed(3));
      ctTRef.current = Math.round(Math.min(1, Math.max(0, (band - 2.55) / 1.3)) * 1000) / 1000;
      // AI Integration (band 4), the finale: the last band runs to the end
      // of the section, so it only fades in.
      const ai = Math.round(Math.min(1, Math.max(0, (band - 3.55) / 0.3)) * 1000) / 1000;
      if (ai !== aiOpen) pin.style.setProperty("--ai-open", (aiOpen = ai).toFixed(3));
      aiTRef.current = Math.round(Math.min(1, Math.max(0, (band - 3.55) / 0.9)) * 1000) / 1000;
      pin.dataset.aiT = String(aiTRef.current);
      SCENES.forEach(([, from, to], i) => {
        const on = band > from && band < to;
        const el = sceneEls[i];
        if (el && on !== sceneOn[i]) {
          sceneOn[i] = on;
          el.style.display = on ? "" : "none";
          // On a phone a scene out of range also lets go of its pictures,
          // so only the scenes around the reader hold decoded 4K images
          // (all five at once was more than iOS Safari allows a tab: it
          // reloaded the page as the AI scene came in). Each is back well
          // before its scene shows (the ranges open half a band early).
          if (phone) {
            el.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
              if (on) {
                if (img.dataset.src && !img.getAttribute("src")) img.setAttribute("src", img.dataset.src);
              } else {
                const src = img.getAttribute("src");
                if (src) {
                  img.dataset.src = src;
                  img.removeAttribute("src");
                }
              }
            });
          }
        }
      });
      // Communication, Content and AI are opaque once they are a third open:
      // the hero behind them can stop drawing (HeroModel reads this).
      const cover = Math.max(cm, ct, ai) >= 0.34 ? "1" : "";
      if ((pin.dataset.cover ?? "") !== cover) {
        pin.dataset.cover = cover;
        // While a scene fills the screen, the shared metal rims and the
        // dock's beat pause (nothing under the scene needs them).
        document.body.classList.toggle("scene-cover", cover === "1");
        window.dispatchEvent(new Event(cover ? "app:scene-cover" : "app:scene-uncover"));
      }
      const scene = Math.max(next, exp, cm, ct, ai);
      if (scene !== sceneOpen) pin.style.setProperty("--scene-open", (sceneOpen = scene).toFixed(3));
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      bandRef.current = null;
      document.body.classList.remove("scene-busy");
      if (document.body.classList.contains("scene-cover")) {
        document.body.classList.remove("scene-cover");
        window.dispatchEvent(new Event("app:scene-uncover"));
      }
    };
  }, [modelMode]);

  // Draft switch, for checking a scene on a device: ?at=<scene>:<t> (brand,
  // exp, comm, ct, ai; t 0..1) jumps there once the intro is gone.
  useEffect(() => {
    if (!modelMode) return;
    const q = new URLSearchParams(window.location.search);
    const at = q.get("at");
    const stage = stageRef.current;
    if (!stage) return;
    // ?tour=<seconds>: scrolls from the hero to the end of the services on
    // its own, as a reader would, for checking a whole run on a device.
    if (q.get("tour")) {
      const secs = parseFloat(q.get("tour") as string) || 40;
      let raf = 0;
      const begin = () =>
        window.setTimeout(() => {
          const r = stage.getBoundingClientRect();
          const end = r.top + window.scrollY + r.height;
          const t0 = performance.now();
          const step = (now: number) => {
            const k = Math.min(1, (now - t0) / (secs * 1000));
            window.dispatchEvent(new CustomEvent("app:scroll-to", { detail: { target: end * k, immediate: true } }));
            if (k < 1) raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
        }, 4000);
      if ((window as Window & { __appUncovered?: boolean }).__appUncovered) begin();
      else window.addEventListener("app:uncovered", begin, { once: true });
      return () => cancelAnimationFrame(raf);
    }
    if (!at) return;
    const [name, tv] = at.split(":");
    const t = Math.min(1, Math.max(0, parseFloat(tv) || 0));
    const START: Record<string, [number, number]> = { brand: [-0.45, 1.3], exp: [0.55, 1.3], comm: [1.55, 1.3], ct: [2.55, 1.3], ai: [3.55, 0.9] };
    const [b0, len] = START[name] ?? START.brand;
    const band = b0 + t * len;
    const go = () => {
      const r = stage.getBoundingClientRect();
      const shown = band < 3.55 ? (band + 0.45) / (4 / 0.7) : 0.7 + ((band - 3.55) / 0.9) * 0.3;
      const y = r.top + window.scrollY + shown * (r.height - window.innerHeight);
      window.dispatchEvent(new CustomEvent("app:scroll-to", { detail: { target: y, immediate: true } }));
    };
    // Twice: sections further up can still be settling their heights.
    const later = () => {
      window.setTimeout(go, 600);
      window.setTimeout(go, 2600);
    };
    if ((window as Window & { __appUncovered?: boolean }).__appUncovered) later();
    else window.addEventListener("app:uncovered", later, { once: true });
    return () => window.removeEventListener("app:uncovered", later);
  }, [modelMode]);

  // Decode every scene's pictures ahead of time, one per idle slot, once the
  // page has been uncovered: a 4K picture decoded the moment its scene opens
  // is a visible stall mid-scroll.
  useEffect(() => {
    // Not on phones: holding every scene's pictures decoded at once is what
    // ran iOS Safari out of memory (each scene loads its own as it nears).
    if (!modelMode || isPhoneDevice()) return;
    const urls = [
      "/hero/model/street.jpg",
      "/hero/model/street-screens.png",
      "/hero/model/studio.jpg",
      "/hero/model/her-porcelain-face.png",
      "/hero/model/chrome.jpg",
      "/hero/model/eye-4k.jpg",
      "/shop/brand/zc-wordmark.webp",
      "/shop/brand/zc-mark.webp",
    ];
    let cancelled = false;
    const kept: HTMLImageElement[] = [];
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback?.bind(window);
    const idle = (fn: () => void) => (ric ? ric(fn, { timeout: 2000 }) : globalThis.setTimeout(fn, 200));
    const next = (i: number) => {
      if (cancelled || i >= urls.length) return;
      idle(() => {
        const img = new Image();
        img.decoding = "async";
        img.src = urls[i];
        kept.push(img);
        img.decode().catch(() => {}).finally(() => next(i + 1));
      });
    };
    const start = () => window.setTimeout(() => next(0), 1500);
    if ((window as Window & { __appUncovered?: boolean }).__appUncovered) start();
    else window.addEventListener("app:uncovered", start, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("app:uncovered", start);
      kept.length = 0;
    };
  }, [modelMode]);

  // ── Expanded detailed-services view (cross-slide to a detail screen) ──
  const [expanded, setExpanded] = useState(false);
  // The clipping viewport for the columns row.
  const colsRef = useRef<HTMLDivElement>(null);
  // The row itself. The pan translates THIS — a composited transform, rather
  // than a per-frame scrollLeft write which is integer-snapped and forces a
  // scroll + paint straight after a layout read.
  const trackRef = useRef<HTMLDivElement>(null);
  // Progress rail. Written to directly from the rAF loop: routing pan progress
  // through React state would re-render the whole section every frame.
  const railRef = useRef<HTMLDivElement>(null);
  const railFillRef = useRef<HTMLSpanElement>(null);

  const {
    scrollTo: locoScrollTo,
    isReady: locoReady,
    update: locoUpdate,
  } = useLocomotiveScroll();

  // Open the detail view. Smooth-scroll the section flush with the viewport
  // first so the lock that follows engages on an already-aligned section.
  const ALIGN_S = 0.6;
  // The Expand glass turning into its arrow on hover (useArrowMorph).
  const {
    trigger: expandBtnRef,
    host: expandShapeRef,
    glass: expandGlassRef,
    edge: expandEdgeRef,
  } = useArrowMorph();

  const openExpanded = useCallback(() => {
    const el = sectionRef.current;
    // Already flush (the usual case: the reader is looking at the section)?
    // Open on the click itself. The lock effect snaps away any leftover pixel,
    // so waiting out a whole alignment scroll here only delays the detail.
    if (el && Math.abs(el.getBoundingClientRect().top) < 4) {
      setExpanded(true);
      return;
    }
    // Besides aligning, this cancels any residual Lenis momentum that would
    // otherwise still be drifting when the lock takes hold. Lenis is skipped on
    // touch (locoScrollTo is a no-op there even though locoReady is true), so
    // use native smooth scroll on touch.
    if (!isTouch && locoReady) {
      locoScrollTo("#services", { duration: ALIGN_S });
    } else {
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Open once the alignment scroll has settled.
    window.setTimeout(() => setExpanded(true), ALIGN_S * 1000 + 100);
  }, [isTouch, locoReady, locoScrollTo]);

  // Ways out of the lock other than the Back button: Escape, and anything that
  // asks the page to scroll somewhere else (the nav menu's section links). The
  // latter matters because the lock outlives this component's own UI — without
  // it, picking "Work" from the menu would leave the reader frozen on Services
  // with the destination unreachable.
  const pendingNavRef = useRef<string | number | null>(null);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const onScrollTo = (e: Event) => {
      // Swallow the request and replay it once the lock is off. Letting it
      // through as-is would have the provider scroll a still-frozen document,
      // and the release below would then snap the reader back here anyway.
      const t = (e as CustomEvent<{ target?: string | number }>).detail?.target;
      pendingNavRef.current = t ?? null;
      setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("app:scroll-to", onScrollTo);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("app:scroll-to", onScrollTo);
    };
  }, [expanded]);

  // …and replay it. React runs every cleanup before any effect of the same
  // commit, so the lock is already released by the time this fires; the frame
  // of delay just lets Lenis settle after start().
  useEffect(() => {
    if (expanded || pendingNavRef.current == null) return;
    const target = pendingNavRef.current;
    pendingNavRef.current = null;
    const t = window.setTimeout(
      () =>
        window.dispatchEvent(
          new CustomEvent("app:scroll-to", { detail: { target } }),
        ),
      80,
    );
    return () => window.clearTimeout(t);
  }, [expanded]);

  // ── The expanded view is a real scroll LOCK ──────────────────────────
  // While the detail is open the page itself does not move at all: Lenis is
  // stopped, the document is frozen, and every scroll gesture — wheel, trackpad,
  // finger drag, arrow keys — is re-aimed at the horizontal column pan instead.
  // Running out of columns does NOT release the page. "Back" (or Escape) is the
  // only way out, which is the point: the detail is a destination, not a screen
  // you fall through on the way to the gallery.
  //
  // This replaces the previous approach, where the section grew extra scroll
  // height and mapped page-scroll progress onto the pan. That read well on
  // paper but it is precisely what let a reader carry straight on into the next
  // section, and it needed the section's height — and therefore every
  // ScrollTrigger position on the page — to be recomputed on open, on close and
  // on every resize. With the page frozen, the section's height never changes,
  // so none of that machinery is needed.
  //
  // One mechanism on every device, too. The old pointer/touch split existed
  // only because the pan rode the page scroll and a phone has no wheel; with
  // nothing to ride, both inputs drive the same offset and mobile finally
  // behaves like desktop.
  useEffect(() => {
    if (!expanded) return;
    const section = sectionRef.current;
    const cols = colsRef.current;
    const track = trackRef.current;
    const rail = railRef.current;
    const railFill = railFillRef.current;
    if (!section || !cols || !track) return;

    // ── 1. Freeze the page ──
    // Stop Lenis FIRST, then correct the alignment: the opening scroll is
    // smooth and may still be a pixel or two out when this runs, and snapping
    // while Lenis is live would just be animated away.
    window.dispatchEvent(new Event("app:scroll-lock")); // lenis.stop()
    const drift = section.getBoundingClientRect().top;
    if (Math.abs(drift) > 1) window.scrollTo(0, window.scrollY + drift);
    const lockY = window.scrollY;

    const html = document.documentElement;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    // There is no Lenis on touch (the provider skips it for coarse pointers),
    // so overflow alone leaves native scrolling live — the body has to be
    // pinned. Held at -lockY so the section stays exactly where it is.
    if (isTouch) {
      const b = document.body;
      b.style.position = "fixed";
      b.style.top = `-${lockY}px`;
      b.style.left = "0";
      b.style.right = "0";
      b.style.width = "100%";
    }

    // ── 2. Pan state ──
    let max = 0;
    let target = 0;
    let current = 0;
    let dragging = false;
    let axis: "x" | "y" | null = null;
    const touchOrigin = { x: 0, y: 0 };
    let startPos = 0;
    let startTarget = 0;
    let lastDelta = 0;
    let lastMoveAt = 0;
    let velocity = 0; // px per ms

    const clamp = (v: number) => Math.min(Math.max(v, 0), max);

    // How far the row overflows its viewport. Measured off LAYOUT boxes
    // (offsetWidth / clientWidth), never scrollWidth: the track carries a
    // translate, and a transformed child contributes to a container's
    // scrollable overflow, so scrollWidth would grow as the pan advanced.
    const measure = () => {
      const cs = getComputedStyle(cols);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      const width = track.offsetWidth;
      // How wide the window the columns travel through actually is.
      //
      // This one number decides how far the pan may go, and getting it too
      // SMALL is what empties the screen: `max` is the content minus the
      // window, so a window short by N pixels lets the pan run N pixels past
      // the last column and off the left-hand edge. Recorded from the
      // client's iPhone, frame by frame: the columns left the screen
      // entirely, stayed away for two thirds of a second, then eased back in
      // from the left. That is this arithmetic, with a window that measured
      // far too small — at zero it goes negative, and `max` gains a whole
      // screen and its padding.
      //
      // So: take the widest credible figure rather than the first one, and
      // refuse anything implausible outright, keeping the last good value
      // until the observer below reports a real one. `clientWidth` is the
      // honest source when layout has settled; the border box catches the
      // case where it has not.
      const windowW =
        Math.max(cols.clientWidth, cols.getBoundingClientRect().width) - padL - padR;
      if (!(windowW > 80) || !(width > 0)) return;
      max = Math.max(0, width - windowW);
      target = clamp(target);
      // And clamp where the pan actually IS, not only where it is heading.
      // Clamping the target alone left `current` stranded beyond the end,
      // easing back across an empty screen for as long as it took to get
      // there — the two thirds of a second above. Snapping it into range puts
      // the columns back in the same frame the mistake is noticed.
      current = clamp(current);
      if (rail) rail.style.opacity = max > 0 ? "1" : "0";
    };
    measure();
    // And again whenever the boxes actually change size, rather than once at a
    // guessed 700ms. The slide-in settling, a font arriving, the phone's
    // address bar reflowing the screen, a rotation — they all land here, and
    // the first observation covers the case where the layout was not ready
    // when this effect ran.
    const ro =
      typeof ResizeObserver === "function" ? new ResizeObserver(() => measure()) : null;
    ro?.observe(cols);
    ro?.observe(track);
    const tMeasure = window.setTimeout(measure, 700);

    // ── 3. Frame loop: `current` chases `target` ──
    let raf = 0;
    let lastT = performance.now();
    let painted = -1;
    const frame = (now: number) => {
      const dt = Math.min(now - lastT, 50);
      lastT = now;
      // A finger drag follows 1:1 — smoothing a direct manipulation reads as
      // lag. Everything else eases, so the wheel feels like the Lenis-smoothed
      // scrolling on the rest of the site rather than a jump cut. The factor is
      // frame-rate corrected: a fixed per-frame value pans roughly twice as
      // fast on a 120Hz screen as on a 60Hz one.
      const k = dragging ? 1 : 1 - Math.pow(1 - 0.16, dt / 16.667);
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.05) current = target;
      if (Math.abs(current - painted) > 0.01) {
        painted = current;
        track.style.transform = `translate3d(${-current}px, 0, 0)`;
        if (railFill)
          railFill.style.transform = `scaleX(${max > 0 ? current / max : 0})`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // ── 4. Inputs ──
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom — leave it to the browser
      e.preventDefault();
      // Trackpads report both axes; take whichever the gesture actually moved.
      const raw =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      // deltaMode 1 = lines, 2 = pages. Chrome always sends pixels, Firefox
      // sends lines — unconverted, Firefox would pan ~3px per notch.
      const scale =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? cols.clientWidth : 1;
      target = clamp(target + raw * scale);
    };

    const onTouchStart = (e: TouchEvent) => {
      const t0 = e.touches[0];
      if (!t0) return;
      dragging = true;
      axis = null;
      startPos = 0;
      startTarget = target;
      lastDelta = 0;
      lastMoveAt = performance.now();
      velocity = 0;
      touchOrigin.x = t0.clientX;
      touchOrigin.y = t0.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const t0 = e.touches[0];
      if (!t0) return;
      const dx = touchOrigin.x - t0.clientX;
      const dy = touchOrigin.y - t0.clientY;
      // Lock the axis on the first decisive movement, the way the browser picks
      // a scroll axis. Summing both axes instead would count a diagonal drag
      // twice and run the pan away from the finger.
      if (!axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        startPos = axis === "x" ? dx : dy;
      }
      e.preventDefault();
      const delta = (axis === "x" ? dx : dy) - startPos;
      target = clamp(startTarget + delta);
      const now = performance.now();
      const dt = now - lastMoveAt;
      if (dt > 0) velocity = (delta - lastDelta) / dt;
      lastDelta = delta;
      lastMoveAt = now;
    };

    const onTouchEnd = () => {
      if (!dragging) return;
      dragging = false;
      axis = null;
      // Hand what is left of the flick to the easing as extra distance, so a
      // quick swipe glides on instead of stopping dead under the finger.
      if (Math.abs(velocity) > 0.05) target = clamp(target + velocity * 260);
      velocity = 0;
    };

    const onKey = (e: KeyboardEvent) => {
      const page = cols.clientWidth * 0.75;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          target = clamp(target + 140);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          target = clamp(target - 140);
          break;
        case "PageDown":
        case " ":
          target = clamp(target + page);
          break;
        case "PageUp":
          target = clamp(target - page);
          break;
        case "Home":
          target = 0;
          break;
        case "End":
          target = max;
          break;
        default:
          return;
      }
      e.preventDefault();
    };

    // Non-passive: these listeners exist to preventDefault. On the section
    // rather than the window because the section covers the whole viewport
    // while locked, and a gesture over the fixed navbar should stay the
    // navbar's business.
    const opts = { passive: false } as const;
    section.addEventListener("wheel", onWheel, opts);
    section.addEventListener("touchstart", onTouchStart, opts);
    section.addEventListener("touchmove", onTouchMove, opts);
    section.addEventListener("touchend", onTouchEnd);
    section.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("keydown", onKey);

    // Width is the only thing that changes the overflow. Height-only resizes
    // are the mobile URL bar sliding in and out, and re-measuring on those
    // visibly jumped the pan.
    let lastW = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      measure();
    };
    window.addEventListener("resize", onResize);

    // ── 5. Release ──
    return () => {
      window.clearTimeout(tMeasure);
      ro?.disconnect();
      cancelAnimationFrame(raf);
      section.removeEventListener("wheel", onWheel);
      section.removeEventListener("touchstart", onTouchStart);
      section.removeEventListener("touchmove", onTouchMove);
      section.removeEventListener("touchend", onTouchEnd);
      section.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      track.style.transform = "";
      if (railFill) railFill.style.transform = "scaleX(0)";

      const b = document.body;
      b.style.position = "";
      b.style.top = "";
      b.style.left = "";
      b.style.right = "";
      b.style.width = "";
      b.style.overflow = "";
      html.style.overflow = "";
      // Unpinning the body drops the scroll to 0 — put it back BEFORE Lenis
      // resumes, or Lenis animates the whole page from the top.
      window.scrollTo(0, lockY);
      window.dispatchEvent(new Event("app:scroll-unlock")); // lenis.start()
      locoUpdate(); // re-measure against the unfrozen document
      // And re-measure the SCROLL TRIGGERS against it, which nothing else
      // does.
      //
      // While the detail is open the document is frozen — on touch the body
      // is pinned, so it collapses to one screen and `scrollY` reads 0. Any
      // ScrollTrigger created during that window measures itself against that
      // collapsed page and keeps those positions afterwards. The two wipes
      // are built on approach now, and "on approach" can easily fall inside
      // an open detail view: the reader opens it from the services section,
      // which is exactly where the first wipe's spacer comes near. Its
      // curtain then reads the page through nonsense bounds once the lock
      // lifts, which is a full-screen transition sitting over a section it
      // has no business being over.
      //
      // A frame later, so the restored scroll position is the one being
      // measured from.
      requestAnimationFrame(() => ScrollTrigger.refresh());
    };
  }, [expanded, isTouch, locoUpdate]);

  return (
    <section
      ref={sectionRef}
      id="services"
      className="svv3"
      data-model={modelMode || undefined}
      style={modelMode ? ({ "--svc-count": services.length } as React.CSSProperties) : undefined}
    >
      <div ref={stageRef} className="svv3__stage">
        <div ref={pinRef} className="svv3__pin">
          <div className="svv3__slider" data-expanded={expanded}>
            {/* ── Screen 1: the 3D room ── */}
            <div className="svv3__screen svv3__screen--room">
          {/* ── 3D ROOM frame ── */}
          <svg
            className="svv3__room"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <rect
              x={room.x}
              y={room.y}
              width={100 - room.x * 2}
              height={100 - room.y * 2}
            />
            <line x1="0" y1="0" x2={room.x} y2={room.y} />
            <line x1="100" y1="0" x2={100 - room.x} y2={room.y} />
            <line x1="0" y1="100" x2={room.x} y2={100 - room.y} />
            <line x1="100" y1="100" x2={100 - room.x} y2={100 - room.y} />
          </svg>

          {/* ── Meta layer: tag (name) top-left, name/desc bottom-left ── */}
          <div className="svv3__meta">
            {services.map((s, i) => (
              <div
                key={s.index}
                className="svv3__meta-slide"
                style={
                  enableEffects
                    ? {
                        opacity: i === activeIdx ? 1 : 0,
                        // Scaled with the tunnel's band rate. At 0.7s against
                        // the faster 1.4s dwell the meta would be mid-crossfade
                        // for half its life, so consecutive services would
                        // never fully resolve; 0.45s keeps the old fade-to-hold
                        // ratio. Retune this if animationSpeed changes again.
                        transition: "opacity 0.45s ease",
                      }
                    : undefined
                }
              >
                {/* Top row: index number left (nudged right so it clears the
                    fixed navbar toggle), bracketed tag right. */}
                <div className="svv3__meta-top">
                  <span className="svv3__meta-index">
                    {s.index.replace("_", "")}
                  </span>
                  <h2 className="svv3__meta-tag">
                    <span className="svv3__bracket">(</span>
                    <span className="svv3__meta-tag-text">{s.tag}</span>
                    <span className="svv3__bracket">)</span>
                  </h2>
                </div>
                <div className="svv3__meta-foot">
                  <h3 className="svv3__meta-name">{s.name}</h3>
                  <p className="svv3__meta-desc">{s.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Expand → detailed services (right edge) ── */}
          {/* The button is only the hit area — it keeps the resting pill's
              footprint while the GLASS inside it morphs on hover into the
              arrow (useArrowMorph). If the glass were the button, it would
              shrink out from under the pointer, lose the hover, grow back,
              and flicker. */}
          {/* Not in the model draft: there the list opens from the prompt
              after the last service, and an unmounted button also leaves the
              shared metal-rim renderer one fewer canvas to feed. */}
          {!modelMode && (
          <button
            ref={expandBtnRef}
            type="button"
            className="svv3__expand-btn"
            onClick={openExpanded}
            aria-haspopup="dialog"
            aria-expanded={expanded}
            /* On the phone layout (the 600px rule in the CSS) this button
               moves to the bottom-right — the corner dock's spot — and the
               two collided; the client: "we should not show the + before
               the services section". So here it is a rival of the dock, as
               the hero's and footer's CTAs are, but only under that same
               breakpoint: on wider screens it sits mid-right and the dock
               keeps its corner. See CornerGlassDock's rivals. */
            data-corner-dock-avoid="(max-width: 600px)"
          >
            <span ref={expandShapeRef} className="svv3__expand-shape">
              <span ref={expandGlassRef} className="svv3__expand-glass liquid-glass">
                <ChromaticMetal />
                <span className="svv3__expand-label">Expand</span>
                <span className="svv3__expand-arrow" aria-hidden>
                  →
                </span>
              </span>
              {/* The arrow's light: the glass's edge, sheen and shadow,
                  drawn on the same shape as the glass's mask. Outside the
                  glass so the mask cannot cut it; shown only while the
                  shape is away from the pill. */}
              <span ref={expandEdgeRef} className="svv3__expand-edge" aria-hidden />
            </span>
          </button>
          )}

          {/* ── Centre service names ──
              Desktop: all names ride the tunnel strip in sequence — while one
              is readable at the centre the next is already descending
              distorted from the top. onBandChange keeps the meta layer synced
              to the centred name. (Hover-pause is currently disabled; pass
              `paused` to WebGLTextTunnel to re-enable it.)
              Touch / reduced-motion: a plain static list (see mobile CSS). */}
          {enableEffects ? (
            <>
            <div className="svv3__tunnel">
              {/* Tuned to the reference screenshot: serif type, warp starting
                  close to the centre (low falloff), rows fanning into curved
                  streaks at the edges (high stretchX), squashed to filaments
                  (high stretchY), strong glow, rainbow fringes at the pinches. */}
              {tunnelLeased && (
              <WebGLTextTunnel
                texts={services.map((s) => s.name)}
                onBandChange={setActiveIdx}
                band={modelMode ? bandRef : undefined}
                dprCap={modelMode ? 1.5 : undefined}
                /* The room fades to opacity 0 behind the detail screen — no
                   reason to keep burning a full-viewport WebGL draw per frame
                   underneath the pan. */
                suspended={expanded}
                font={tunnelFont}
                fontWeight={400}
                fontSize={tunnel.fontSize}
                lineHeight={1.15}
                textColor="#FFFFFF"
                background="transparent"
                gap={tunnel.gap}
                /* Percent of one band per second: 70 puts a service name at
                   the centre roughly every 1.4s, against 2.2s at the previous
                   45. The meta crossfade below is tied to this — it is sized as
                   a fraction of the dwell, so the two move together. */
                animationSpeed={70}
                stretchX={60}
                stretchY={85}
                falloff={15}
                bloom={55}
                chromatic={65}
                width="100%"
                height="100%"
              />
              )}
            </div>
            {/* The Brand Design beat (draft): the first service builds a brand
                system out of HER. Construction lines trace her face (drawn on
                her, in HeroModel), colours are sampled from her hair, skin,
                lips and leather, then the board forms around her like a
                guidelines sheet: colour sheets, type, and the studio's own
                mark. No client of any kind is implied. --brand-open (0..1,
                set on the pin by the scroll driver above) runs it. */}
            {modelMode && (
              <div className="svv3__brand" aria-hidden>
                <i className="svv3__crop svv3__crop--tl" />
                <i className="svv3__crop svv3__crop--tr" />
                <i className="svv3__crop svv3__crop--bl" />
                <i className="svv3__crop svv3__crop--br" />
                <section className="svv3__brand-type svv3__brand-card" style={{ "--d": 0 } as React.CSSProperties}>
                  <p className="svv3__brand-label">Typography</p>
                  <p className="svv3__brand-aa">Aa</p>
                  <p className="svv3__brand-abc">ABCDEFGHIJKLM<br />NOPQRSTUVWXYZ<br />0123456789</p>
                  <p className="svv3__brand-faces">
                    <span>Display — Tomato Grotesk</span>
                    <span>Text — Departure Mono</span>
                  </p>
                </section>
                <section className="svv3__brand-mark svv3__brand-card" style={{ "--d": 1 } as React.CSSProperties}>
                  <p className="svv3__brand-label">Mark</p>
                  <div className="svv3__brand-mark-art">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/shop/brand/zc-mark.webp" alt="" draggable={false} />
                  </div>
                  <p className="svv3__brand-faces"><span>Clear space — ½ mark</span></p>
                </section>
                <section className="svv3__brand-sheets">
                  <p className="svv3__brand-label">Palette — sampled from her</p>
                  {[
                    ["Oxblood", "#2D0117", "Jacket"],
                    ["Bordeaux", "#530B26", "Lips"],
                    ["Mulberry", "#430323", "Hair"],
                    ["Lacquer", "#611133", "Leather"],
                    ["Rose", "#AC5565", "Skin"],
                  ].map(([name, hex, at], i) => (
                    <div key={name} className="svv3__sheet" style={{ "--c": hex, "--i": i } as React.CSSProperties}>
                      <b>{name}</b>
                      <span>{hex}</span>
                      <span>{at}</span>
                    </div>
                  ))}
                </section>
                <footer className="svv3__brand-foot">
                  <span><b>01</b> Construction</span>
                  <span><b>02</b> Palette</span>
                  <span><b>03</b> Typography</span>
                  <span><b>04</b> Mark</span>
                </footer>
              </div>
            )}
            {/* The Experience Design scene (draft): the hero comes apart in
                depth into the layers it is built from, labelled like an
                exploded view, with a layers panel tracking it, then goes back
                together. --exp-open fades it in; the driver sets --sp
                (spread), --orb (camera drift) and --hov (cursor). */}
            {modelMode && (
              <div className="svv3__layers" ref={layersRef} data-bp="desktop" aria-hidden>
                <i className="svv3__ly-dim" />
                <div className="svv3__ly-stage">
                  <div className="svv3__ly-stack">
                    <div className="svv3__ly-pane svv3__ly-pane--back" style={{ "--z": 0 } as React.CSSProperties}>
                      <span className="svv3__ly-pic">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/hero/model/her-rest-blur.jpg" alt="" draggable={false} />
                      </span>
                      <span className="svv3__ly-tag"><b>01</b> Atmosphere<em>z −300</em></span>
                    </div>
                    <div className="svv3__ly-pane svv3__ly-pane--subject" style={{ "--z": 1 } as React.CSSProperties}>
                      <span className="svv3__ly-pic">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/hero/model/her-rest.jpg" alt="" draggable={false} />
                      </span>
                      <span className="svv3__ly-tag"><b>02</b> Subject<em>z −150</em></span>
                      <Rails />
                    </div>
                    <div className="svv3__ly-pane svv3__ly-pane--grid" style={{ "--z": 2 } as React.CSSProperties}>
                      <div className="svv3__ly-cols">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>
                      <span className="svv3__ly-tag"><b>03</b> Layout grid · <W d="12" t="8" p="4" /> col<em>z 0</em></span>
                      <Rails />
                    </div>
                    <div className="svv3__ly-pane svv3__ly-pane--type" style={{ "--z": 3 } as React.CSSProperties}>
                      <div className="svv3__ly-typeset">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/shop/brand/zc-wordmark.webp" alt="" draggable={false} />
                        <span>is a design-led</span>
                        <b>AGENCY</b>
                      </div>
                      <span className="svv3__ly-tag"><b>04</b> Typography<em>z +150</em></span>
                      <Rails />
                    </div>
                    <div className="svv3__ly-pane svv3__ly-pane--ui" style={{ "--z": 4 } as React.CSSProperties}>
                      {/* Tablet and phone only: the device is just its metal
                          rail and side buttons; the wide size needs no laptop. */}
                      <i className="svv3__ly-device" />
                      <em className="svv3__ly-btn"><span>Talk to us →</span><i className="svv3__ly-tap" /></em>
                      <i className="svv3__ly-cursor" />
                      <span className="svv3__ly-tag"><b>05</b> Interaction<em>z +300</em></span>
                      <span className="svv3__ly-measure"><span><W d="1440" t="834" p="390" /> px</span></span>
                      <Rails />
                    </div>
                  </div>
                </div>
                <div className="svv3__ly-panel">
                  <p className="svv3__brand-label">Layers</p>
                  <ol>
                    <li style={{ "--z": 4 } as React.CSSProperties}><i /><b>05</b>Interaction<span>+300</span></li>
                    <li style={{ "--z": 3 } as React.CSSProperties}><i /><b>04</b>Typography<span>+150</span></li>
                    <li style={{ "--z": 2 } as React.CSSProperties}><i /><b>03</b>Layout grid<span>0</span></li>
                    <li style={{ "--z": 1 } as React.CSSProperties}><i /><b>02</b>Subject<span>−150</span></li>
                    <li style={{ "--z": 0 } as React.CSSProperties}><i /><b>01</b>Atmosphere<span>−300</span></li>
                  </ol>
                  <p className="svv3__ly-vp">Viewport<b><W d="Desktop · 1440" t="Tablet · 834" p="Phone · 390" /></b></p>
                </div>
              </div>
            )}
            {/* The Communication Design scene (draft): the campaign takes
                the city. A night street whose every ad surface switches on
                with her campaign, the camera gliding down it and pushing into
                the screen at the end (CommStreet). --cm-open fades it;
                cmTRef drives it. */}
            {modelMode && (
              <div className="svv3__comm">
                <CommStreet tRef={cmTRef} />
              </div>
            )}
            {/* The Content Production scene (draft): the hero was a frame
                on a shoot all along (ContentSet). --ct-open fades it. */}
            {modelMode && (
              <div className="svv3__content">
                <ContentSet tRef={ctTRef} />
              </div>
            )}
            {/* The AI Integration scene (draft), the finale: she was never
                just a picture (AIFinale). --ai-open fades it in. */}
            {modelMode && (
              <div className="svv3__ai">
                <AIFinale tRef={aiTRef} />
              </div>
            )}
            </>
          ) : (
            <div className="svv3__track">
              {services.map((s) => (
                <div key={s.index} className="svv3__card">
                  <span className="svv3__card-text">{s.name}</span>
                </div>
              ))}
            </div>
          )}
            </div>

            {/* ── Screen 2: detailed services (minimal columns) ── */}
            <div
              className="svv3__screen svv3__screen--detail"
              aria-hidden={!expanded}
              role="dialog"
              aria-modal={expanded}
              aria-label="Detailed services"
            >
              <button
                type="button"
                className="svv3__back"
                onClick={() => setExpanded(false)}
              >
                <span aria-hidden>←</span> Back
              </button>
              <div className="svv3__cols" ref={colsRef}>
                <div className="svv3__cols-track" ref={trackRef}>
                  {details.map((g) => (
                    <div className="svv3__col" key={g.index}>
                      {/* Services up top, category name below — number removed. */}
                      <ul className="svv3__col-list">
                        {g.items.map((it) => (
                          <li key={it}>{it}</li>
                        ))}
                      </ul>
                      <span className="svv3__col-cat">{g.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* The page is frozen while this is open, so the way out has to be
                  stated rather than discovered — and the rail is the only thing
                  telling a reader how much of the row is left, now that there is
                  no page scrollbar moving. */}
              <div className="svv3__foot">
                <div className="svv3__rail" ref={railRef} aria-hidden>
                  <span className="svv3__rail-fill" ref={railFillRef} />
                </div>
                <p className="svv3__hint">
                  Scroll to explore
                  <span className="svv3__hint-sep" aria-hidden>
                    ·
                  </span>
                  Back to exit
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The way into the full list, in the model draft: not a button lost in
          the first scene but a prompt after the last one, once the five have
          played. It opens the same detailed list view. */}
      {modelMode && (
        <div className="svv3__outro">
          <p className="svv3__outro-kicker"><span>(</span>Services<span>)</span></p>
          <button type="button" className="svv3__outro-cta liquid-glass" onClick={openExpanded} aria-haspopup="dialog" aria-expanded={expanded}>
            <span className="svv3__outro-label">Full list</span>
            <span className="svv3__outro-arrow" aria-hidden>→</span>
          </button>
        </div>
      )}
    </section>
  );
}
