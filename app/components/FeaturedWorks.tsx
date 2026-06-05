"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import "@/app/styles/featured-works.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/* ─── Data ──────────────────────────────────────────────────────── */
const WORKS = [
  {
    id: "forma-digital",
    year: "2026",
    category: "Brand Identity",
    title: "Forma Digital",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80",
  },
  {
    id: "nero-vision",
    year: "2025",
    category: "Motion Design",
    title: "Nero Vision",
    image:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1800&q=80",
  },
  {
    id: "lumina-arc",
    year: "2024",
    category: "Web Experience",
    title: "Lumina Arc",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1800&q=80",
  },
];



export default function FeaturedWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const imgRefs    = useRef<(HTMLDivElement | null)[]>([]);

  const { isTouch, prefersReducedMotion } = useDeviceDetect();
  const enableEffects = !isTouch && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!enableEffects) return;

      const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
      const imgs  = imgRefs.current.filter(Boolean)  as HTMLDivElement[];
      if (!cards.length) return;

      cards.forEach((card, i) => {
        const img = imgs[i];

        // Initial state — small + tilted (enter from below)
        gsap.set(card, {
          scale : 0.75,
          rotate: -8,
          transformOrigin: "center center",
          opacity: 1,
        });
        if (img) gsap.set(img, { scale: 1.1 });

        // Per-card scrubbed ScrollTrigger
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger : card,
            start   : "top 50%",
            end     : "bottom 12%",
            scrub   : 1.4,
            invalidateOnRefresh: true,
          },
        });

        // ENTER: scale up + rotate to upright
        tl.fromTo(
          card,
          { scale: 0.75, rotate: -8 },
          { scale: 1,    rotate: 0,  duration: 0.35, ease: "power2.out" },
          0,
        );
        if (img) {
          tl.fromTo(
            img,
            { scale: 1.1 },
            { scale: 1,   duration: 0.35, ease: "power2.out" },
            0,
          );
        }

        // HOLD — full size, no movement

        // EXIT: mirror — scale down + rotate other way
        tl.to(
          card,
          { scale: 0.75, rotate: 8, duration: 0.35, ease: "power2.in" },
          0.65,
        );
        if (img) {
          tl.to(img, { scale: 1.1, duration: 0.35, ease: "power2.in" }, 0.65);
        }
      });
    },
    { scope: sectionRef, dependencies: [enableEffects] },
  );

  return (
    <section ref={sectionRef} className="fw" id="work">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="fw__header">
        <p className="fw__eyebrow">Featured Works</p>
        <h2 className="fw__title">Projects in Motion</h2>
        <p className="fw__sub">
          Full-bleed case studies that open, breathe, and hand off.
        </p>
      </div>

      {/* ── Card list — normal flow, no stacking ─────────────────── */}
      <div className="fw__list">
        {WORKS.map((work, index) => (
          <div
            key={work.id}
            ref={(el) => { cardRefs.current[index] = el; }}
            className="fw-card"
          >
            {/* Image layer */}
            <div
              ref={(el) => { imgRefs.current[index] = el; }}
              className="fw-card__img"
              style={{ backgroundImage: `url(${work.image})` }}
            />

            {/* Gradient overlay */}
            <div className="fw-card__overlay" />

            {/* Text */}
            <div className="fw-card__body">
              <div className="fw-card__meta">
                <span className="fw-card__cat">{work.category}</span>
                <span className="fw-card__yr">{work.year}</span>
              </div>
              <h3 className="fw-card__title">{work.title}</h3>
            </div>

            {/* Index counter */}
            <span className="fw-card__num">
              {String(index + 1).padStart(2, "0")} /{" "}
              {String(WORKS.length).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>

    </section>
  );
}
