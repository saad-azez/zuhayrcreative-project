"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import "@/app/styles/services-section-v3.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

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

// Corner positions as fraction of viewport height, relative to viewport center.
// Wall zone:   -CORNER < y < +CORNER   → text upright.
// Floor zone:  y > +CORNER             → text lying flat on floor.
// Ceiling:     y < -CORNER             → text lying flat on ceiling.
const CORNER = 0.28;
// Soft transition band around each corner — smooth bend.
const BAND = 0.06;
// Vertical spacing between successive service cards (in vh units).
const STRIDE = 0.55;
// Max fold angle (degrees) when fully on floor / ceiling.
const FOLD_DEG = 78;
// Max push-back (px) when fully folded — makes flat text recede into room.
const FOLD_Z = 220;

/**
 * Services Section v3 — 3D room.
 * One service name centered on the back wall. Others stacked into the
 * floor below it (and lifted to the ceiling above as they exit). Each
 * card rotates around the X axis based on which zone its center sits in,
 * so floor / ceiling cards appear as a foreshortened plane laid flat.
 */
export default function ServicesSectionV3() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const metaRefs = useRef<(HTMLDivElement | null)[]>([]);
  const iconRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();
  const enableEffects = !isTouch && !prefersReducedMotion;

  // ── Expanded detailed-services view (in-place horizontal shift) ──
  const [expanded, setExpanded] = useState(false);

  // Close the expanded view on Escape.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  useGSAP(
    () => {
      if (!enableEffects) return;
      const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
      const metas = metaRefs.current.filter(Boolean) as HTMLDivElement[];
      if (!cards.length) return;

      const n = cards.length;

      /**
       * Smooth fold value for a Y position (px relative to viewport center).
       * Returns t ∈ [-1, +1]:
       *   t = +1  → fully on floor
       *   t =  0  → upright on the back wall
       *   t = -1  → fully on ceiling
       * Soft lerp across the BAND around each corner so the rotation
       * eases from upright → flat as the card sweeps past the boundary.
       */
      const foldUnit = (yPx: number, vh: number) => {
        const yNorm = yPx / vh;
        const floor = CORNER;
        const ceil = -CORNER;
        if (yNorm > floor + BAND) return 1;
        if (yNorm > floor - BAND) return (yNorm - (floor - BAND)) / (2 * BAND);
        if (yNorm < ceil - BAND) return -1;
        if (yNorm < ceil + BAND) return (yNorm - (ceil + BAND)) / (2 * BAND);
        return 0;
      };

      // Wrap a raw slot into [-n/2, n/2) so cards form an infinite ring.
      // Card just exited the ceiling reappears below the floor on the next
      // cycle — seamless loop with no visible reset jump.
      const wrapSlot = (raw: number) => {
        const m = ((raw % n) + n) % n;
        return m > n / 2 ? m - n : m;
      };

      const applyFrame = (globalPos: number) => {
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;

        cards.forEach((card, ci) => {
          const slot = wrapSlot(ci - globalPos);
          const cardCenterY = slot * (vh * STRIDE);
          const t = foldUnit(cardCenterY, vh);

          // Blur scales with fold magnitude — sharp on the wall, blurry
          // once the card folds onto the floor or ceiling.
          const absT = Math.abs(t);
          const blurPx = absT * 18; // 0 on wall → 18px when flat
          // Floor/ceiling cards grow larger than the centered wall card.
          // wall (t=0) → scale 1, fully folded (|t|=1) → 1.45×.
          const foldScale = 1 + absT * 0.45;
          // Brand color (title-red) when on the wall; fades to white as it
          // folds away so floor/ceiling text reads as a soft echo.
          const brand = { r: 245, g: 59, b: 90 }; // #f53b5a
          const white = { r: 255, g: 255, b: 255 };
          const lerp = (a: number, b: number) => Math.round(a + (b - a) * absT);
          const color = `rgb(${lerp(brand.r, white.r)},${lerp(brand.g, white.g)},${lerp(brand.b, white.b)})`;

          // Anchor card center; rotate the entire card as one rigid plane.
          gsap.set(card, {
            xPercent: -50,
            yPercent: -50,
            y: cardCenterY,
            rotateX: t * FOLD_DEG,
            z: -Math.abs(t) * FOLD_Z,
            // Distant cards shrink toward the vanishing point, but folded
            // text grows larger so the wall stays the visual anchor.
            scale:
              foldScale * Math.max(0.55, 1 - Math.abs(slot) * 0.12),
            opacity: Math.abs(slot) > 3 ? 0 : 1,
            filter: blurPx > 0.05 ? `blur(${blurPx}px)` : "none",
            transformOrigin: "50% 50%",
            color,
          });
        });

        // Active card = the one whose wrapped slot is closest to 0.
        const wrapped = ((globalPos % n) + n) % n;
        const activeIdx = Math.round(wrapped) % n;
        metas.forEach((m, i) => {
          gsap.set(m, {
            opacity: i === activeIdx ? 1 : 0,
            pointerEvents: i === activeIdx ? "auto" : "none",
          });
        });
        // Sync icon — only the active service's icon shows.
        const icons = iconRefs.current.filter(Boolean) as HTMLSpanElement[];
        icons.forEach((ic, i) => {
          gsap.set(ic, {
            opacity: i === activeIdx ? 1 : 0,
            pointerEvents: i === activeIdx ? "auto" : "none",
          });
        });
      };

      applyFrame(0);

      // Auto-loop: globalPos ticks 0 → n continuously, ~1.4s per service.
      const state = { pos: 0 };
      const loop = gsap.to(state, {
        pos: n,
        duration: n * 1.4,
        ease: "none",
        repeat: -1,
        onUpdate: () => applyFrame(state.pos),
      });
      loop.play(0);

      // Pause only when hovering directly on a service-name card (not the
      // whole section). Each card gets its own listener pair.
      const onEnter = () => loop.pause();
      const onLeave = () => loop.play();
      cards.forEach((card) => {
        card.addEventListener("mouseenter", onEnter);
        card.addEventListener("mouseleave", onLeave);
      });

      return () => {
        loop.kill();
        cards.forEach((card) => {
          card.removeEventListener("mouseenter", onEnter);
          card.removeEventListener("mouseleave", onLeave);
        });
      };
    },
    { scope: sectionRef, dependencies: [enableEffects] },
  );

  return (
    <section ref={sectionRef} id="services-v3" className="svv3">
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

          <span className="svv3__star" aria-hidden>
            ✦
          </span>

          {/* ── Active service icon (top-right, crossfades per service) ── */}
          <div className="svv3__icons" aria-label="Active service icon">
            {SERVICES.map((s, i) => {
              const Icon = SERVICE_ICONS[i] ?? SERVICE_ICONS[0];
              return (
                <span
                  key={s.index}
                  ref={(el) => {
                    iconRefs.current[i] = el;
                  }}
                  className="svv3__icon"
                  title={s.name}
                >
                  <Icon />
                </span>
              );
            })}
          </div>

          {/* ── Left meta column ── */}
          <div className="svv3__meta">
            {SERVICES.map((s, i) => (
              <div
                key={s.index}
                ref={(el) => {
                  metaRefs.current[i] = el;
                }}
                className="svv3__meta-slide"
              >
                <span className="svv3__meta-index">{s.index}</span>
                <h2 className="svv3__meta-tag">
                  <span className="svv3__bracket">(</span>
                  <span className="svv3__meta-tag-text">{s.tag}</span>
                  <span className="svv3__bracket">)</span>
                </h2>
                <div className="svv3__meta-foot">
                  <h3 className="svv3__meta-name">{s.name}</h3>
                  <p className="svv3__meta-desc">{s.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Signature ── */}
          <div className="svv3__sig" aria-hidden>
            <span className="svv3__sig-line">— Zuhayr Creative</span>
          </div>

          {/* ── Expand → detailed services (right edge) ── */}
          <button
            type="button"
            className="svv3__expand-btn"
            onClick={() => setExpanded(true)}
            aria-haspopup="dialog"
            aria-expanded={expanded}
          >
            <span className="svv3__expand-label">Expand</span>
            <span className="svv3__expand-arrow" aria-hidden>
              →
            </span>
          </button>

          {/* ── Center 3D card stack ── */}
          <div className="svv3__track">
            {SERVICES.map((s, ci) => (
              <div
                key={s.index}
                ref={(el) => {
                  cardRefs.current[ci] = el;
                }}
                className="svv3__card"
              >
                <span className="svv3__card-text">{s.name}</span>
              </div>
            ))}
          </div>
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
                    <span className="svv3__col-no">{g.index}</span>
                    <span className="svv3__col-cat">{g.name}</span>
                    <ul className="svv3__col-list">
                      {g.items.map((it) => (
                        <li key={it}>{it}</li>
                      ))}
                    </ul>
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

/* ═════════════════════════════════════════════════════════════════════
   Low-poly faceted 3D icons — origami / Z-logo style.
   Solid flat polygons only (no gradients). Each face uses one of four
   palette stops so shading direction reads as a 3D form.
   ═════════════════════════════════════════════════════════════════════ */

const ICON_VB = "0 0 64 64";

// Brand palette — matches Z logo polygons (light pink → deep magenta).
const C_LIGHT = "#ff4a8c";
const C_MID = "#e8146a";
const C_DARK = "#8e0040";
const C_SHADOW = "#4d001e";

// ── Icon 1 — Web Design (faceted browser window with cursor) ──────────
function IconWeb() {
  return (
    <svg viewBox={ICON_VB} xmlns="http://www.w3.org/2000/svg" className="svv3__icon-svg">
      {/* Browser back depth — right + bottom edges show thickness */}
      <polygon points="56,12 60,16 60,50 56,46" fill={C_SHADOW} />
      <polygon points="8,46 56,46 60,50 12,50" fill={C_DARK} />
      {/* Title bar */}
      <polygon points="6,12 56,12 56,22 6,22" fill={C_DARK} />
      {/* Window body (front, light) */}
      <polygon points="6,22 56,22 56,46 6,46" fill={C_LIGHT} />
      {/* Title bar accent strip (mid) for depth */}
      <polygon points="6,20 56,20 56,22 6,22" fill={C_MID} />
      {/* 3 traffic-light dots (diamond facets) */}
      <polygon points="11,14 14,17 11,20 8,17" fill={C_LIGHT} />
      <polygon points="18,14 21,17 18,20 15,17" fill={C_MID} />
      <polygon points="25,14 28,17 25,20 22,17" fill={C_SHADOW} />
      {/* Content lines */}
      <polygon points="12,28 36,28 36,31 12,31" fill={C_MID} />
      <polygon points="12,34 48,34 48,37 12,37" fill={C_DARK} opacity="0.7" />
      <polygon points="12,40 28,40 28,43 12,43" fill={C_DARK} opacity="0.5" />
      {/* Cursor arrow bottom-right (tiny designer pointer) */}
      <polygon
        points="49,40 52,42 50.5,42.5 51,44.5 50,45 49.5,43 49,43"
        fill={C_SHADOW}
      />
    </svg>
  );
}

// ── Icon 2 — AI Automation (faceted microchip with circuit core) ──────
function IconAI() {
  return (
    <svg viewBox={ICON_VB} xmlns="http://www.w3.org/2000/svg" className="svv3__icon-svg">
      {/* Chip pins on all 4 sides */}
      {[16, 24, 32, 40, 48].map((p) => (
        <g key={p}>
          {/* top */}
          <polygon points={`${p - 2},4 ${p + 2},4 ${p + 2},10 ${p - 2},10`} fill={C_DARK} />
          {/* bottom */}
          <polygon points={`${p - 2},54 ${p + 2},54 ${p + 2},60 ${p - 2},60`} fill={C_DARK} />
          {/* left */}
          <polygon points={`4,${p - 2} 10,${p - 2} 10,${p + 2} 4,${p + 2}`} fill={C_DARK} />
          {/* right */}
          <polygon points={`54,${p - 2} 60,${p - 2} 60,${p + 2} 54,${p + 2}`} fill={C_DARK} />
        </g>
      ))}
      {/* Chip body — outer face */}
      <polygon points="10,10 54,10 54,54 10,54" fill={C_MID} />
      {/* Top-left highlight facet (3D bevel) */}
      <polygon points="10,10 54,10 50,14 14,14" fill={C_LIGHT} />
      <polygon points="10,10 14,14 14,50 10,54" fill={C_LIGHT} opacity="0.85" />
      {/* Bottom-right shadow facet */}
      <polygon points="54,10 54,54 50,50 50,14" fill={C_SHADOW} />
      <polygon points="14,50 50,50 54,54 10,54" fill={C_SHADOW} opacity="0.75" />
      {/* Inner core — darker square */}
      <polygon points="20,20 44,20 44,44 20,44" fill={C_SHADOW} />
      {/* AI spark — 4-point star at chip center */}
      <polygon
        points="32,22 35,30 43,32 35,34 32,42 29,34 21,32 29,30"
        fill={C_LIGHT}
      />
      <polygon points="32,28 34,32 32,36 30,32" fill="#ffffff" />
    </svg>
  );
}

// ── Icon 3 — Search Growth (magnifier + ascending bars + arrow) ──────
function IconGrowth() {
  return (
    <svg viewBox={ICON_VB} xmlns="http://www.w3.org/2000/svg" className="svv3__icon-svg">
      {/* Handle (faceted thick rectangle, diagonal) */}
      <polygon points="38,38 48,38 60,54 54,60 38,44" fill={C_DARK} />
      <polygon points="48,38 60,54 56,56 44,40" fill={C_SHADOW} />
      {/* Lens outer (faceted ring) */}
      <polygon
        points="24,4 40,8 50,20 50,36 40,48 24,52 12,46 6,32 6,20 12,10"
        fill={C_LIGHT}
      />
      {/* Lens shadow side (right + bottom) */}
      <polygon
        points="40,8 50,20 50,36 40,48 28,28"
        fill={C_MID}
      />
      <polygon
        points="50,36 40,48 24,52 28,28"
        fill={C_DARK}
      />
      {/* Lens inner disc */}
      <polygon
        points="28,12 38,14 44,22 44,34 38,42 28,44 18,40 14,30 14,22 18,16"
        fill={C_SHADOW}
      />
      {/* Bar chart inside (ascending growth) */}
      <polygon points="18,32 22,32 22,38 18,38" fill={C_LIGHT} />
      <polygon points="24,28 28,28 28,38 24,38" fill={C_LIGHT} />
      <polygon points="30,22 34,22 34,38 30,38" fill={C_LIGHT} />
      {/* Trend arrow tip up-right */}
      <polygon points="34,18 40,18 40,24" fill={C_LIGHT} />
    </svg>
  );
}

// ── Icon 4 — Brand Systems (faceted 5-point star badge) ───────────────
function IconBrand() {
  // 5-point star outer + inner verts pre-computed (center 32,32, R=26 r=11)
  // Top (T), top-right (TR), bottom-right (BR), bottom-left (BL), top-left (TL)
  // outer:  T=(32,6)  TR=(57,24)  BR=(47,54)  BL=(17,54)  TL=(7,24)
  // inner around them: it,ir1,ir2,ib1,ib2,il2,il1
  // Approx inner vertices at angle 18, 90, 162, 234, 306 (half-angles between outer):
  // inner_top-right: (32+11*cos(54°), 32-11*sin(54°))? Using clockwise from top.
  // For simplicity using pre-computed reasonable values:
  // i1 (between T and TR): (39, 24)
  // i2 (between TR and BR): (42, 36)
  // i3 (between BR and BL): (32, 42)
  // i4 (between BL and TL): (22, 36)
  // i5 (between TL and T): (25, 24)
  return (
    <svg viewBox={ICON_VB} xmlns="http://www.w3.org/2000/svg" className="svv3__icon-svg">
      {/* Right half — bright */}
      <polygon
        points="32,6 39,24 57,24 42,36 47,54 32,42"
        fill={C_LIGHT}
      />
      {/* Left half — mid */}
      <polygon
        points="32,6 25,24 7,24 22,36 17,54 32,42"
        fill={C_MID}
      />
      {/* Bottom-right shadow arm */}
      <polygon points="42,36 47,54 32,42" fill={C_DARK} />
      {/* Bottom-left shadow arm */}
      <polygon points="22,36 17,54 32,42" fill={C_SHADOW} />
      {/* Top inner facet — depth */}
      <polygon points="32,6 39,24 25,24" fill={C_LIGHT} />
      {/* Sparkle */}
      <polygon points="32,14 34,18 32,22 30,18" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

// Index-aligned with SERVICES.
const SERVICE_ICONS = [IconWeb, IconAI, IconGrowth, IconBrand];
