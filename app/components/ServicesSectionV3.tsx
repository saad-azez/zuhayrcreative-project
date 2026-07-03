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

  // ── Expanded detailed-services view (in-place horizontal shift) ──
  const [expanded, setExpanded] = useState(false);

  const { scrollTo: locoScrollTo, isReady: locoReady } = useLocomotiveScroll();

  // Open the detail view. If the section is scrolled partway out of view when
  // Expand is clicked, first smooth-scroll it flush with the viewport — the
  // expanded screen locks page scroll, so opening misaligned would leave the
  // detail text permanently cut off at the top or bottom.
  const ALIGN_S = 0.6;
  const openExpanded = useCallback(() => {
    const el = sectionRef.current;
    const offTop = el ? el.getBoundingClientRect().top : 0;
    if (Math.abs(offTop) < 8) {
      setExpanded(true);
      return;
    }
    if (locoReady) {
      locoScrollTo("#services", { duration: ALIGN_S });
    } else {
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Open once the alignment scroll has settled (the open locks scroll).
    window.setTimeout(() => setExpanded(true), ALIGN_S * 1000 + 100);
  }, [locoReady, locoScrollTo]);

  // Close the expanded view on Escape.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  // Lock page scroll while the detail view is open — same pattern as the
  // navbar menu and OrbitingGallery's enlarged view: freeze native scroll
  // AND stop the Locomotive/Lenis smooth scroll, so you can't scroll the
  // page into the next section out from underneath the expanded screen.
  useEffect(() => {
    if (!expanded) return;
    document.body.style.overflow = "hidden";
    window.dispatchEvent(new Event("app:scroll-lock"));
    return () => {
      document.body.style.overflow = "";
      window.dispatchEvent(new Event("app:scroll-unlock"));
    };
  }, [expanded]);

  return (
    <section ref={sectionRef} id="services" className="svv3">
      <div
        ref={stageRef}
        className="svv3__stage"
        style={{ height: "100vh" }}
      >
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
              <div className="svv3__cols">
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
