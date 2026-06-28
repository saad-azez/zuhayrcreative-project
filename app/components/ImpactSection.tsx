"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AuroraBackground } from "./AuroraBackground";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";

gsap.registerPlugin(ScrollTrigger);

interface StatItem {
  target: number;
  suffix: string;
  label: string;
}

const stats: StatItem[] = [
  {
    target: 250,
    suffix: "+",
    label: "Projects Completed",
  },
  {
    target: 24,
    suffix: "/7",
    label: "Customer Service",
  },
  {
    target: 4,
    suffix: "",
    label: "Continents Operational In",
  },
];

// Diagonal step per stat: ~60px horizontal + 60px vertical = 45deg staircase
const DIAGONAL_STEP = 360;
const VERTICAL_GAP = 80;
// Mobile: stack vertically with no diagonal shift
const MOBILE_STEP = 0;
const MOBILE_GAP = 48;
export default function ImpactSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stat1Ref = useRef<HTMLDivElement>(null);
  const stat2Ref = useRef<HTMLDivElement>(null);
  const stat3Ref = useRef<HTMLDivElement>(null);
  const { isTouch, isMobile, prefersReducedMotion } = useDeviceDetect();

  useGSAP(() => {
    if (!sectionRef.current) return;

    const dur = prefersReducedMotion ? 0.01 : isTouch ? 0.5 : 1.0;

    const statEls = [stat1Ref, stat2Ref, stat3Ref];

    // ── Set initial hidden states immediately — prevents flash before trigger ─
    const heading1 =
      sectionRef.current.querySelector<HTMLElement>(".heading-1");
    const heading2 =
      sectionRef.current.querySelector<HTMLElement>(".heading-2");
    const desc1 = sectionRef.current.querySelector<HTMLElement>(".desc-1");
    if (heading1) gsap.set(heading1, { autoAlpha: 0, x: -120, skewX: -6 });
    if (heading2) gsap.set(heading2, { autoAlpha: 0, x: 120, skewX: 6 });
    if (desc1) gsap.set(desc1, { autoAlpha: 0, y: 24 });
    // .desc-2 is the same DOM node as .heading-2 — skip duplicate set

    statEls.forEach((ref) => {
      if (!ref.current) return;
      gsap.set(ref.current, {
        autoAlpha: 0,
        x: -80,
        y: 80,
        skewX: -8,
        force3D: true,
      });
      const suffixEl = ref.current.querySelector<HTMLElement>(".stat-suffix");
      const labelEl = ref.current.querySelector<HTMLElement>(".stat-label");
      if (suffixEl) gsap.set(suffixEl, { autoAlpha: 0, scale: 0.4, y: 20 });
      if (labelEl) gsap.set(labelEl, { autoAlpha: 0, y: 16 });
    });

    // ── Heading animations ───────────────────────────────────────────────────
    if (heading1) {
      gsap.to(heading1, {
        autoAlpha: 1,
        x: 0,
        skewX: 0,
        duration: dur * 1.3,
        ease: "expo.out",
        scrollTrigger: {
          trigger: heading1,
          start: "top 88%",
          once: true,
        },
      });
    }

    if (heading2) {
      gsap.to(heading2, {
        autoAlpha: 1,
        x: 0,
        skewX: 0,
        duration: dur * 1.3,
        ease: "expo.out",
        scrollTrigger: {
          trigger: heading2,
          start: "top 88%",
          once: true,
        },
      });
    }

    if (desc1) {
      gsap.to(desc1, {
        autoAlpha: 1,
        y: 0,
        duration: dur * 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: desc1,
          start: "top 92%",
          once: true,
        },
      });
    }

    // ── Stats: single master timeline, staggered via absolute positions ───────
    const masterTl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top 60%",
        once: true,
        invalidateOnRefresh: true,
      },
    });

    statEls.forEach((ref, index) => {
      if (!ref.current) return;

      const numberEl = ref.current.querySelector<HTMLElement>(".stat-number");
      const labelEl = ref.current.querySelector<HTMLElement>(".stat-label");
      const suffixEl = ref.current.querySelector<HTMLElement>(".stat-suffix");
      const stat = stats[index];
      const o = prefersReducedMotion ? 0 : index * 0.2; // stagger offset in seconds

      // Slide in from diagonal (or simple fade on mobile)
      masterTl.to(
        ref.current,
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          skewX: 0,
          duration: dur * 1.1,
          ease: "expo.out",
          force3D: true,
        },
        o,
      );

      // Counter roll-up — loops forever: count 0 → target, hold a few seconds
      // at the target, then count again. Pauses while the section is off-screen.
      if (numberEl) {
        if (prefersReducedMotion) {
          numberEl.textContent = stat.target.toString();
        } else {
          const counter = { value: 0 };
          gsap.to(counter, {
            value: stat.target,
            duration: 2.2,
            ease: "power3.out",
            repeat: -1,
            repeatDelay: 3, // hold at the target before counting again
            onUpdate() {
              numberEl.textContent = Math.ceil(counter.value).toString();
            },
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 60%",
              end: "bottom top",
              toggleActions: "play pause resume pause",
            },
          });
        }
      }

      // Label fade up
      if (labelEl) {
        masterTl.to(
          labelEl,
          { autoAlpha: 1, y: 0, duration: dur * 0.7, ease: "power2.out" },
          o + 0.25,
        );
      }

      // Suffix pop
      if (suffixEl) {
        masterTl.to(
          suffixEl,
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: dur * 0.7,
            ease: "back.out(2)",
          },
          o + 0.55,
        );
      }
    });

    // ── Diagonal scroll — the stat staircase drifts along its 45° diagonal as
    // the section scrolls. Uses xPercent/yPercent so it layers on top of the
    // entrance x/y without fighting it. Later stats drift a touch more
    // (parallax depth). Desktop only. ──
    if (!isMobile && !prefersReducedMotion) {
      statEls.forEach((ref, i) => {
        if (!ref.current) return;
        const depth = 1 + i * 0.45;
        gsap.fromTo(
          ref.current,
          { xPercent: -9 * depth, yPercent: -9 * depth },
          {
            xPercent: 9 * depth,
            yPercent: 9 * depth,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          },
        );
      });
    }
  }, []);

  return (
    <section
      className="relative h-auto py-32 md:py-48 px-6 md:px-12 overflow-x-hidden w-full max-w-full"
    >
      {/* ── Ambient glows ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-200 h-200 rounded-full bg-maroon-dark/10 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-1/4 w-150 h-150 rounded-full bg-maroon-accent/5 blur-[100px]" />
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div ref={sectionRef} className="max-w-400 mx-auto relative z-10 w-full">
        {/* ── Header block ─────────────────────────────────────────────────── */}
        <div className="mb-20 md:mb-36">
          <div className="flex flex-col lg:flex-row lg:items-start gap-12">
            <div className="flex-1">
              <h2
                className="heading-1 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 tracking-tighter leading-none"
                style={{ fontFamily: "var(--font-geist-sans)" }}
              >
                BEYOND INFLUENCE
              </h2>
              <p className="desc-1 text-base md:text-lg text-foreground-muted max-w-md leading-relaxed">
                Influence goes beyond aesthetics — it shifts perceptions,
                inspires conversation, and sets new standards. We help brands
                express clarity and ambition.
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats: true 45-degree diagonal staircase ─────────────────────── */}
        <div className="relative">
          {/* ── AND IMPACT — floated right, hidden on mobile ── */}
          <div className="heading-2 desc-2 hidden lg:flex flex-col justify-center absolute right-0 -top-40 w-[42%] h-auto pointer-events-none">
            <h2
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground tracking-tighter leading-none mb-4"
              style={{ fontFamily: "var(--font-geist-sans)" }}
            >
              AND IMPACT
            </h2>
            <p className="text-base md:text-lg text-foreground-muted max-w-xs leading-relaxed">
              Where creativity meets consequence — transforming ideas into
              actionable plans and strategy into sustainable growth.
            </p>
          </div>
          {/* Stat 1 — left anchor */}
          <div
            ref={stat1Ref}
            className="stat-item relative"
            style={{
              marginLeft: 0,
              marginBottom: `${isMobile ? MOBILE_GAP : VERTICAL_GAP}px`,
            }}
          >
            <div className="flex items-baseline gap-3">
              <span className="stat-number text-[clamp(5rem,12vw,11rem)] font-bold text-foreground tracking-tighter leading-none tabular-nums">
                0
              </span>
              <span className="stat-suffix text-[clamp(3rem,7vw,7rem)] font-bold text-maroon-accent leading-none">
                {stats[0].suffix}
              </span>
            </div>
            <p className="stat-label text-lg md:text-xl text-foreground-muted mt-3 max-w-[28ch] leading-snug">
              {stats[0].label}
            </p>
          </div>

          {/* Stat 2 — shifted right + down (45 deg step), centered on mobile */}
          <div
            ref={stat2Ref}
            className="stat-item relative"
            style={{
              marginLeft: `${isMobile ? MOBILE_STEP : DIAGONAL_STEP}px`,
              marginBottom: `${isMobile ? MOBILE_GAP : VERTICAL_GAP}px`,
            }}
          >
            <div className="flex items-baseline gap-3">
              <span className="stat-number text-[clamp(5rem,12vw,11rem)] font-bold text-foreground tracking-tighter leading-none tabular-nums">
                0
              </span>
              <span className="stat-suffix text-[clamp(3rem,7vw,7rem)] font-bold text-maroon-accent leading-none">
                {stats[1].suffix}
              </span>
            </div>
            <p className="stat-label text-lg md:text-xl text-foreground-muted mt-3 max-w-[28ch] leading-snug">
              {stats[1].label}
            </p>
          </div>

          {/* Stat 3 — another step, centered on mobile */}
          <div
            ref={stat3Ref}
            className="stat-item relative"
            style={{
              marginLeft: `${isMobile ? MOBILE_STEP : DIAGONAL_STEP * 2}px`,
            }}
          >
            <div className="flex items-baseline gap-3">
              <span className="stat-number text-[clamp(5rem,12vw,11rem)] font-bold text-foreground tracking-tighter leading-none tabular-nums">
                0
              </span>
              <span className="stat-suffix text-[clamp(3rem,7vw,7rem)] font-bold text-maroon-accent leading-none">
                {stats[2].suffix}
              </span>
            </div>
            <p className="stat-label text-lg md:text-xl text-foreground-muted mt-3 max-w-[28ch] leading-snug">
              {stats[2].label}
            </p>
          </div>

          {/* Ghost diagonal guide line — purely decorative */}
          <div
            className="absolute inset-0 pointer-events-none -z-10"
            aria-hidden
          >
            <svg
              className="absolute top-0 left-0 w-full h-full overflow-visible opacity-[0.06]"
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="0"
                x2="100%"
                y2="100%"
                stroke="currentColor"
                strokeWidth="1"
                className="text-maroon-accent"
                strokeDasharray="6 10"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
