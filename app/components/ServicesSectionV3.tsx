"use client";

import { useRef } from "react";
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
  const { isTouch, prefersReducedMotion } = useDeviceDetect();
  const enableEffects = !isTouch && !prefersReducedMotion;

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
          const blurPx = Math.abs(t) * 18; // 0 on wall → 18px when flat

          // Anchor card center; rotate the entire card as one rigid plane.
          gsap.set(card, {
            xPercent: -50,
            yPercent: -50,
            y: cardCenterY,
            rotateX: t * FOLD_DEG,
            z: -Math.abs(t) * FOLD_Z,
            // Distant cards shrink toward the vanishing point.
            scale: Math.max(0.55, 1 - Math.abs(slot) * 0.12),
            opacity: Math.abs(slot) > 3 ? 0 : 1,
            filter: blurPx > 0.05 ? `blur(${blurPx}px)` : "none",
            transformOrigin: "50% 50%",
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
      </div>
    </section>
  );
}
