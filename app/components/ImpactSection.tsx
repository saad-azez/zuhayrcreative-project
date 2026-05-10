"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface StatItem {
  target: number;
  suffix: string;
  label: string;
}

const stats: StatItem[] = [
  {
    target: 200,
    suffix: "+",
    label: "projects redefining visual experiences",
  },
  {
    target: 30,
    suffix: "+",
    label: "industries impacted through innovative design",
  },
  {
    target: 12,
    suffix: "",
    label: "years of design excellence and creative innovation",
  },
];

// Diagonal step per stat: ~130px horizontal + 130px vertical = 45deg staircase
const DIAGONAL_STEP = 130;

export default function ImpactSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stat1Ref = useRef<HTMLDivElement>(null);
  const stat2Ref = useRef<HTMLDivElement>(null);
  const stat3Ref = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!sectionRef.current) return;

    // ── Diagonal divider line draw ───────────────────────────────────────────
    if (dividerRef.current) {
      gsap.from(dividerRef.current, {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 1.4,
        ease: "expo.out",
        scrollTrigger: {
          trigger: dividerRef.current,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      });
    }

    // ── Heading animations ───────────────────────────────────────────────────
    const heading1 = sectionRef.current.querySelector(".heading-1");
    const heading2 = sectionRef.current.querySelector(".heading-2");
    const desc1 = sectionRef.current.querySelector(".desc-1");
    const desc2 = sectionRef.current.querySelector(".desc-2");

    if (heading1) {
      gsap.from(heading1, {
        x: -120,
        skewX: -6,
        opacity: 0,
        duration: 1.3,
        ease: "expo.out",
        scrollTrigger: {
          trigger: heading1,
          start: "top 88%",
          toggleActions: "play none none reverse",
        },
      });
    }

    if (heading2) {
      gsap.from(heading2, {
        x: 120,
        skewX: 6,
        opacity: 0,
        duration: 1.3,
        ease: "expo.out",
        scrollTrigger: {
          trigger: heading2,
          start: "top 88%",
          toggleActions: "play none none reverse",
        },
      });
    }

    [desc1, desc2].forEach((desc) => {
      if (!desc) return;
      gsap.from(desc, {
        y: 24,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: desc,
          start: "top 92%",
          toggleActions: "play none none reverse",
        },
      });
    });

    // ── Stats: 45-degree diagonal slide-in + counter ─────────────────────────
    const statRefs = [stat1Ref, stat2Ref, stat3Ref];

    statRefs.forEach((ref, index) => {
      if (!ref.current) return;

      const numberEl = ref.current.querySelector(".stat-number");
      const labelEl = ref.current.querySelector(".stat-label");
      const suffixEl = ref.current.querySelector(".stat-suffix");
      const stat = stats[index];

      // Each stat slides in from bottom-left (45 deg) with stagger
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 60%",
          toggleActions: "play none none reverse",
        },
        delay: index * 0.18,
      });

      // Initial state: offset diagonally (x = -y = negative)
      gsap.set(ref.current, { opacity: 0, x: -80, y: 80, skewX: -8 });

      tl.to(ref.current, {
        opacity: 1,
        x: 0,
        y: 0,
        skewX: 0,
        duration: 1.1,
        ease: "expo.out",
      });

      // Suffix pop
      if (suffixEl) {
        gsap.set(suffixEl, { opacity: 0, scale: 0.4, y: 20 });
        tl.to(
          suffixEl,
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.7,
            ease: "back.out(2)",
          },
          "-=0.5",
        );
      }

      // Counter roll-up
      if (numberEl) {
        const counter = { value: 0 };
        tl.to(
          counter,
          {
            value: stat.target,
            duration: 2.2,
            ease: "power3.out",
            onUpdate: () => {
              numberEl.textContent = Math.ceil(counter.value).toString();
            },
          },
          "-=0.9",
        );
      }

      // Label fade up
      if (labelEl) {
        gsap.set(labelEl, { opacity: 0, y: 16 });
        tl.to(
          labelEl,
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power2.out",
          },
          "-=1.8",
        );
      }
    });
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-x-hidden w-full max-w-full py-32 md:py-48 px-6 md:px-12"
    >
      <div className="max-w-[1600px] mx-auto">
        {/* ── Header block ─────────────────────────────────────────────────── */}
        <div className="mb-20 md:mb-36">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-12 lg:gap-24">
            <div className="flex-1">
              <h2 className="heading-1 text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 tracking-tighter leading-none">
                BEYOND INFLUENCE
              </h2>
              <p className="desc-1 text-base md:text-lg text-foreground-muted max-w-md leading-relaxed">
                Influence goes beyond aesthetics — it shifts perceptions,
                inspires conversation, and sets new standards. We help brands
                express clarity and ambition.
              </p>
            </div>

            <div className="flex-1 lg:text-right">
              <h2 className="heading-2 text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 tracking-tighter leading-none">
                AND IMPACT
              </h2>
              <p className="desc-2 text-base md:text-lg text-foreground-muted max-w-md lg:ml-auto leading-relaxed">
                Where creativity meets consequence — transforming ideas into
                actionable plans and strategy into sustainable growth.
              </p>
            </div>
          </div>

          {/* Horizontal rule with skew accent */}
          <div
            ref={dividerRef}
            className="mt-16 h-px w-full bg-gradient-to-r from-transparent via-maroon-accent/40 to-transparent"
          />
        </div>

        {/* ── Stats: true 45-degree diagonal staircase ─────────────────────── */}
        <div className="relative">
          {/* Stat 1 — left anchor */}
          <div
            ref={stat1Ref}
            className="stat-item relative"
            style={{ marginLeft: 0, marginBottom: `${DIAGONAL_STEP * 0.55}px` }}
          >
            <div className="flex items-baseline gap-3">
              <span className="stat-number text-[clamp(5rem,14vw,11rem)] font-bold text-foreground tracking-tighter leading-none tabular-nums">
                0
              </span>
              <span className="stat-suffix text-[clamp(3rem,8vw,6.5rem)] font-bold text-maroon-accent leading-none">
                {stats[0].suffix}
              </span>
            </div>
            <p className="stat-label text-sm md:text-base text-foreground-muted mt-4 max-w-[22ch] leading-snug">
              {stats[0].label}
            </p>
          </div>

          {/* Stat 2 — shifted right + down (45 deg step) */}
          <div
            ref={stat2Ref}
            className="stat-item relative"
            style={{
              marginLeft: `${DIAGONAL_STEP}px`,
              marginBottom: `${DIAGONAL_STEP * 0.55}px`,
            }}
          >
            <div className="flex items-baseline gap-3">
              <span className="stat-number text-[clamp(5rem,14vw,11rem)] font-bold text-foreground tracking-tighter leading-none tabular-nums">
                0
              </span>
              <span className="stat-suffix text-[clamp(3rem,8vw,6.5rem)] font-bold text-maroon-accent leading-none">
                {stats[1].suffix}
              </span>
            </div>
            <p className="stat-label text-sm md:text-base text-foreground-muted mt-4 max-w-[22ch] leading-snug">
              {stats[1].label}
            </p>
          </div>

          {/* Stat 3 — another 45 deg step further */}
          <div
            ref={stat3Ref}
            className="stat-item relative"
            style={{ marginLeft: `${DIAGONAL_STEP * 2}px` }}
          >
            <div className="flex items-baseline gap-3">
              <span className="stat-number text-[clamp(5rem,14vw,11rem)] font-bold text-foreground tracking-tighter leading-none tabular-nums">
                0
              </span>
              <span className="stat-suffix text-[clamp(3rem,8vw,6.5rem)] font-bold text-maroon-accent leading-none">
                {stats[2].suffix}
              </span>
            </div>
            <p className="stat-label text-sm md:text-base text-foreground-muted mt-4 max-w-[22ch] leading-snug">
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

      {/* Background ambient glows */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-[800px] h-[800px] rounded-full bg-maroon-dark/10 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-maroon-accent/5 blur-[100px]" />
      </div>
    </section>
  );
}
