"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import { useLocomotiveScroll } from "./LocomotiveScrollProvider";
import WebGLTextTunnel from "./WebGLTextTunnel";
// TEMPORARY — delete along with scrollDebug.ts once the scroll issue is found.
import {
  installScrollDebug,
  logScrollMoment,
  verifyLimitAfterResize,
  type ScrollDebugRefs,
} from "./scrollDebug";
import "@/app/styles/services-section-v3.css";

gsap.registerPlugin(ScrollTrigger);

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
  const [tunnelFont, setTunnelFont] = useState(
    "Georgia, 'Times New Roman', serif",
  );
  useEffect(() => {
    const family = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-facade")
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

  // ── Expanded detailed-services view (cross-slide to a detail screen) ──
  const [expanded, setExpanded] = useState(false);
  // The horizontally-scrollable columns row. On desktop its scrollLeft is
  // driven from the page scroll (see below); at ≤980px it is a plain native
  // swipe row and nothing here touches it.
  const colsRef = useRef<HTMLDivElement>(null);
  // The row inside the viewport. The pointer-driven pan translates this; touch
  // leaves it alone and scrolls `colsRef` natively.
  const trackRef = useRef<HTMLDivElement>(null);

  // Which mechanism moves the columns: the page-scroll-driven pan, or a native
  // horizontal swipe. This is a question about the INPUT DEVICE, not the
  // viewport — the pan needs a wheel, the swipe row needs a finger. Keying it
  // on width instead left a narrow desktop window (or a side-docked DevTools)
  // showing a swipe row that a mouse simply cannot move. Tracked live because a
  // hybrid laptop can gain or lose a pointer mid-session.
  const POINTER_QUERY = "(hover: hover) and (pointer: fine)";
  const [pointerDrivesPan, setPointerDrivesPan] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(POINTER_QUERY);
    const sync = () => setPointerDrivesPan(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const {
    scrollTo: locoScrollTo,
    isReady: locoReady,
    update: locoUpdate,
    locoScroll,
  } = useLocomotiveScroll();

  // ── TEMPORARY scroll diagnostics ────────────────────────────────────
  // Delete this ref, the effect below, the `logScrollMoment` calls, and
  // app/components/scrollDebug.ts once the scroll issue is pinned down.
  const debugRefs = useRef<ScrollDebugRefs>({
    stage: null,
    cols: null,
    loco: null,
    expanded: false,
    isWide: true,
  });
  // Refreshed after every commit (no dep array) so the snapshot always reads
  // the current DOM + state, never the render that installed the listeners.
  useEffect(() => {
    debugRefs.current = {
      stage: stageRef.current,
      cols: colsRef.current,
      loco: locoScroll as ScrollDebugRefs["loco"],
      expanded,
      isWide: pointerDrivesPan,
    };
  });
  useEffect(() => installScrollDebug(() => debugRefs.current), []);

  // Open the detail view. First smooth-scroll the section flush with the
  // viewport so the detail opens fully in view. This is NOT a scroll lock —
  // once open you can scroll straight on through to the rest of the page.
  const ALIGN_S = 0.6;
  const openExpanded = useCallback(() => {
    const el = sectionRef.current;
    logScrollMoment(
      `Expand CLICKED (isTouch=${isTouch} locoReady=${locoReady} → ${!isTouch && locoReady ? "Lenis scrollTo" : "native scrollIntoView"})`,
      debugRefs.current,
    );
    // Always snap the section flush first. Besides aligning, this cancels any
    // residual Lenis momentum that would otherwise keep drifting the detail out
    // of view in the moment right after it opens. Lenis is skipped on touch
    // (locoScrollTo is a no-op there even though locoReady is true), so use
    // native smooth scroll on touch.
    if (!isTouch && locoReady) {
      locoScrollTo("#services", { duration: ALIGN_S });
    } else {
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Open once the alignment scroll has settled.
    window.setTimeout(() => {
      logScrollMoment("alignment scroll settled → setExpanded(true)", debugRefs.current);
      setExpanded(true);
    }, ALIGN_S * 1000 + 100);
  }, [isTouch, locoReady, locoScrollTo]);

  // Close the expanded view on Escape.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  // DESKTOP horizontal scroll = a pinned section driven by the PAGE scroll
  // position, the same way premium horizontal-scroll sections work — NOT by
  // hijacking the wheel. When expanded, the section gains extra scroll height
  // and the panel sticks to the top (see CSS); scrolling through that extra
  // height maps 1:1 to the column pan, then releases into the next section.
  // Because it's the very same (Lenis-smoothed) page scroll as everywhere else,
  // it feels identical to the rest of the site, there's nothing to get "stuck"
  // on when arriving from another section, and scrolling back up simply runs
  // the mapping in reverse.
  //
  // TOUCH devices deliberately do NOT get this — there the columns are a plain
  // native swipe row (see CSS): the gesture is the obvious one on a phone, and
  // native overflow scrolling runs on the compositor, whereas writing scrollLeft
  // from rAF lags behind momentum scrolling. It also removes the real breakage
  // — mobile browsers fire `resize` every time the URL bar slides, and re-sizing
  // the stage plus ScrollTrigger.refresh() mid-pan jumped the pan (measured: a
  // resize alone moved scrollLeft 0 → 54 with no input).
  //
  // The split is by pointer, NOT by width: a narrow mouse-driven window still
  // needs the wheel-driven pan, because it has no way to swipe.
  useEffect(() => {
    if (!expanded || !pointerDrivesPan) {
      if (expanded)
        logScrollMoment(
          `pan effect SKIPPED — no fine pointer (touch device → native swipe row)`,
          debugRefs.current,
        );
      return;
    }
    const stage = stageRef.current;
    const cols = colsRef.current;
    const track = trackRef.current;
    if (!stage || !cols || !track) {
      logScrollMoment(
        `pan effect ABORTED — stage=${!!stage} cols=${!!cols} track=${!!track}`,
        debugRefs.current,
      );
      return;
    }

    // Measured once per layout change, then held: reading these every frame is
    // what made the pan expensive. `stageDocTop` is the stage's offset in the
    // document, so progress is a pure arithmetic function of window.scrollY.
    let overflow = 0;
    let stageDocTop = 0;

    // Extra height below the pinned viewport = how far the columns overflow.
    // Deliberately split from the ScrollTrigger refresh below: this part is
    // cheap and has to happen at once so the page is scrollable immediately.
    const sizeStage = () => {
      overflow = cols.scrollWidth - cols.clientWidth;
      stage.style.height =
        overflow > 0 ? `calc(100svh + ${overflow}px)` : "100vh";
      // Let Lenis re-measure the taller document so it can scroll into it.
      locoUpdate();
      stageDocTop = stage.getBoundingClientRect().top + window.scrollY;
      logScrollMoment(
        `sizeStage() — cols.scrollWidth=${cols.scrollWidth} clientWidth=${cols.clientWidth} overflow=${overflow}px stageDocTop=${Math.round(stageDocTop)} ${overflow > 0 ? "" : "→ NOTHING TO PAN"}`,
        debugRefs.current,
      );
      verifyLimitAfterResize(debugRefs.current);
    };

    // Growing the stage moves every section below Services, invalidating
    // ScrollTrigger's cached positions — without this the gallery triggers
    // mid-pan and layers its text over the expand content. It is also the most
    // expensive call here (it re-measures every trigger on the page), so it
    // runs AFTER the 600ms slide-in rather than 80ms into it, where its hitch
    // landed in the middle of the animation.
    const refreshTriggers = () => {
      ScrollTrigger.refresh();
      // Re-measure: the refresh can shift everything below it.
      stageDocTop = stage.getBoundingClientRect().top + window.scrollY;
    };

    // Lenis animates a FRACTIONAL scroll position but applies it through
    // window.scrollTo, which quantises to whole pixels — driving the pan from
    // window.scrollY therefore steps the columns a pixel at a time. Reading
    // Lenis's own float restores subpixel motion; falls back to the native
    // value on touch, where Lenis is not running at all.
    const lenis = locoScroll?.lenisInstance;
    const readScroll = () =>
      typeof lenis?.animatedScroll === "number"
        ? lenis.animatedScroll
        : window.scrollY;

    let raf = 0;
    let lastX = -1;
    const loop = () => {
      if (overflow > 0) {
        // How far the sticky panel has been scrolled through its extra height.
        // No getBoundingClientRect here: that read, followed by a scrollLeft
        // write, cost a layout + scroll + paint every single frame.
        const p = Math.min(
          Math.max((readScroll() - stageDocTop) / overflow, 0),
          1,
        );
        const x = p * overflow;
        // Skip redundant writes so a still page costs nothing.
        if (Math.abs(x - lastX) > 0.01) {
          lastX = x;
          track.style.transform = `translate3d(${-x}px, 0, 0)`;
        }
      }
      raf = requestAnimationFrame(loop);
    };

    // Size as soon as the detail has laid out, then keep the pan synced every
    // frame. The expensive trigger refresh waits for the slide-in to finish.
    const t = window.setTimeout(() => {
      sizeStage();
      raf = requestAnimationFrame(loop);
    }, 80);
    const tRefresh = window.setTimeout(refreshTriggers, 700);

    // Only a WIDTH change can alter how far the columns overflow. Height-only
    // resizes (browser chrome sliding in/out) would otherwise re-measure and
    // refresh ScrollTrigger mid-pan for nothing, which visibly jumps the scroll.
    let lastW = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      sizeStage();
      refreshTriggers();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(t);
      window.clearTimeout(tRefresh);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      stage.style.height = ""; // back to the CSS (collapsed) height
      track.style.transform = "";
      cols.scrollLeft = 0;
      locoUpdate();
      // Document shrank back — recompute against the collapsed layout.
      ScrollTrigger.refresh();
    };
  }, [expanded, pointerDrivesPan, locoUpdate, locoScroll]);

  return (
    <section ref={sectionRef} id="services" className="svv3">
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
            {SERVICES.map((s, i) => (
              <div
                key={s.index}
                className="svv3__meta-slide"
                style={
                  enableEffects
                    ? {
                        opacity: i === activeIdx ? 1 : 0,
                        transition: "opacity 0.7s ease",
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
          <button
            type="button"
            className="svv3__expand-btn"
            onClick={openExpanded}
            aria-haspopup="dialog"
            aria-expanded={expanded}
          >
            <span className="svv3__expand-label">Expand</span>
            <span className="svv3__expand-arrow" aria-hidden>
              →
            </span>
          </button>

          {/* ── Centre service names ──
              Desktop: all names ride the tunnel strip in sequence — while one
              is readable at the centre the next is already descending
              distorted from the top. onBandChange keeps the meta layer synced
              to the centred name. (Hover-pause is currently disabled; pass
              `paused` to WebGLTextTunnel to re-enable it.)
              Touch / reduced-motion: a plain static list (see mobile CSS). */}
          {enableEffects ? (
            <div className="svv3__tunnel">
              {/* Tuned to the reference screenshot: serif type, warp starting
                  close to the centre (low falloff), rows fanning into curved
                  streaks at the edges (high stretchX), squashed to filaments
                  (high stretchY), strong glow, rainbow fringes at the pinches. */}
              <WebGLTextTunnel
                texts={SERVICES.map((s) => s.name)}
                onBandChange={setActiveIdx}
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
                animationSpeed={45}
                stretchX={60}
                stretchY={85}
                falloff={15}
                bloom={55}
                chromatic={65}
                width="100%"
                height="100%"
              />
            </div>
          ) : (
            <div className="svv3__track">
              {SERVICES.map((s) => (
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
                  {SERVICE_DETAILS.map((g) => (
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
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
