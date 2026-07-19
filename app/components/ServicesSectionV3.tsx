"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import { useLocomotiveScroll } from "./LocomotiveScrollProvider";
import WebGLTextTunnel from "./WebGLTextTunnel";
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
  const enableEffects = !isTouch && !prefersReducedMotion;

  // Which service is currently readable at the tunnel's centre — reported by
  // the tunnel itself (all names live on its scrolling strip and loop in
  // sequence); drives the meta layer crossfade.
  const [activeIdx, setActiveIdx] = useState(0);

  // ── Expanded detailed-services view (cross-slide to a detail screen) ──
  const [expanded, setExpanded] = useState(false);
  // The horizontally-scrollable columns row — used by the touch handler below
  // to drive detail progress before handing scroll back to the page.
  const colsRef = useRef<HTMLDivElement>(null);

  const {
    scrollTo: locoScrollTo,
    isReady: locoReady,
    update: locoUpdate,
  } = useLocomotiveScroll();

  // Open the detail view. First smooth-scroll the section flush with the
  // viewport so the detail opens fully in view. This is NOT a scroll lock —
  // once open you can scroll straight on through to the rest of the page.
  const ALIGN_S = 0.6;
  const openExpanded = useCallback(() => {
    const el = sectionRef.current;
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
    window.setTimeout(() => setExpanded(true), ALIGN_S * 1000 + 100);
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

  // Horizontal scroll = a pinned section driven by the PAGE scroll position, the
  // same way premium horizontal-scroll sections work — NOT by hijacking the
  // wheel. When expanded, the section gains extra scroll height and the panel
  // sticks to the top (see CSS); scrolling through that extra height maps 1:1 to
  // the column pan, then releases into the next section. Because it's the very
  // same (Lenis-smoothed) page scroll as everywhere else, it feels identical to
  // the rest of the site, there's nothing to get "stuck" on when arriving from
  // another section, and scrolling back up simply runs the mapping in reverse.
  useEffect(() => {
    if (!expanded) return;
    const stage = stageRef.current;
    const cols = colsRef.current;
    if (!stage || !cols) return;

    const isMobileLayout = () =>
      window.matchMedia("(max-width: 980px)").matches;

    // Extra height below the pinned viewport = how far the columns overflow.
    const sizeStage = () => {
      const overflow = cols.scrollWidth - cols.clientWidth;
      stage.style.height =
        overflow > 0
          ? `calc(100svh + ${overflow}px)`
          : isMobileLayout()
            ? "100svh"
            : "100vh";
      // Let Lenis re-measure the taller document so it can scroll into it.
      locoUpdate();
    };

    let raf = 0;
    const loop = () => {
      const overflow = cols.scrollWidth - cols.clientWidth;
      if (overflow > 0) {
        // How far the sticky panel has been scrolled through its extra height.
        const top = stage.getBoundingClientRect().top;
        const p = Math.min(Math.max(-top / overflow, 0), 1);
        cols.scrollLeft = p * overflow;
      }
      raf = requestAnimationFrame(loop);
    };

    // Size after the detail has laid out (it slides in), then keep the column
    // pan synced to the scroll position every frame.
    const t = window.setTimeout(() => {
      sizeStage();
      raf = requestAnimationFrame(loop);
    }, 80);

    const onResize = () => sizeStage();
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(t);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      stage.style.height = ""; // back to the CSS (collapsed) height
      cols.scrollLeft = 0;
      locoUpdate();
    };
  }, [expanded, locoUpdate]);

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
            <rect x="22" y="22" width="56" height="56" />
            <line x1="0" y1="0" x2="22" y2="22" />
            <line x1="100" y1="0" x2="78" y2="22" />
            <line x1="0" y1="100" x2="22" y2="78" />
            <line x1="100" y1="100" x2="78" y2="78" />
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
                font="Georgia, 'Times New Roman', serif"
                fontWeight={400}
                fontSize={84}
                lineHeight={1.15}
                textColor="#FFFFFF"
                background="transparent"
                gap={110}
                animationSpeed={45}
                stretchX={60}
                stretchY={85}
                falloff={15}
                bloom={55}
                chromatic={35}
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

    </section>
  );
}
