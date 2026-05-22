"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const SERVICES = [
  {
    id: "01",
    name: "Web Design",
    description:
      "Bespoke digital interfaces engineered for conversion and crafted for lasting impressions.",
    image: "https://picsum.photos/seed/webdesign/600/800",
  },
  {
    id: "02",
    name: "Social Media",
    description:
      "Strategic content ecosystems that build communities and drive authentic engagement.",
    image: "https://picsum.photos/seed/socialmedia/600/800",
  },
  {
    id: "03",
    name: "AI Automation",
    description:
      "Intelligent workflow systems that eliminate friction and multiply operational capacity.",
    image: "https://picsum.photos/seed/aiautomation/600/800",
  },
  {
    id: "04",
    name: "Marketing",
    description:
      "Data-informed campaigns that connect brand narratives with high-intent audiences.",
    image: "https://picsum.photos/seed/marketing/600/800",
  },
  {
    id: "05",
    name: "SEO Optimization",
    description:
      "Technical and content-driven SEO strategies designed to increase visibility and sustainable traffic.",
    image: "https://picsum.photos/seed/seooptimize/600/800",
  },
  {
    id: "06",
    name: "Development",
    description:
      "Production-grade engineering with a focus on performance, scalability, and clean architecture.",
    image: "https://picsum.photos/seed/development/600/800",
  },
  {
    id: "07",
    name: "AI Consulting",
    description:
      "Strategic AI advisory that maps intelligent solutions directly to your business objectives.",
    image: "https://picsum.photos/seed/aiconsult/600/800",
  },
];

// clamp value used for both panel height and each slider child height
const PANEL_H = "clamp(260px, 30vw, 400px)";
const PANEL_W = "clamp(200px, 22vw, 300px)";

export default function ServicesSection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeIndexRef = useRef<number | null>(null);
  const panelActiveRef = useRef(false);

  // DOM refs
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const descRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  // ── Panel initial state (hidden via clip-path, no cursor tracking) ────────
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    gsap.set(panel, {
      clipPath: "inset(0% 100% 0% 0%)",
    });
  }, []);

  // ── Entrance scroll animations ────────────────────────────────────────────
  useGSAP(
    () => {
      // Initial desc state — clipped to zero height at bottom edge
      descRefs.current.forEach((d) => {
        if (d) gsap.set(d, { clipPath: "inset(100% 0% 0% 0%)" });
      });

      // Heading — fires immediately on mount
      if (headingRef.current)
        gsap.fromTo(
          headingRef.current,
          { y: 55, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1.1,
            ease: "power4.out",
            scrollTrigger: { trigger: sectionRef.current, start: "top bottom" },
          },
        );

      // Rows — fires immediately on mount, stagger via GSAP
      const rows = rowRefs.current.filter(Boolean);
      if (rows.length)
        gsap.fromTo(
          rows,
          { x: -36, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.65,
            ease: "power3.out",
            stagger: 0.055,
            scrollTrigger: { trigger: sectionRef.current, start: "top bottom" },
          },
        );
    },
    { scope: sectionRef },
  );

  // ── Calculate Y offset for a row relative to the section ──────────────────
  const getRowY = useCallback((index: number): number => {
    const row = rowRefs.current[index];
    const section = sectionRef.current;
    if (!row || !section) return 0;
    return (
      row.getBoundingClientRect().top -
      section.getBoundingClientRect().top +
      section.scrollTop
    );
  }, []);

  // ── Hover handler ─────────────────────────────────────────────────────────
  const handleHover = useCallback((index: number) => {
    const prev = activeIndexRef.current;

    // 1. On first hover: snap panel Y to the row instantly, then reveal
    if (!panelActiveRef.current) {
      const targetY = getRowY(index);
      gsap.set(panelRef.current, { y: targetY });
      gsap.to(panelRef.current, {
        clipPath: "inset(0% 0% 0% 0%)",
        duration: 0.7,
        ease: "power4.out",
        overwrite: "auto",
      });
      panelActiveRef.current = true;
    }

    if (prev === index) return;

    // 2. Smooth GPU slide panel Y to hovered row
    const targetY = getRowY(index);
    gsap.to(panelRef.current, {
      y: targetY,
      duration: 0.6,
      ease: "power3.inOut",
      overwrite: "auto",
    });

    // 3. Slide image strip to new index
    const panel = panelRef.current;
    const slider = sliderRef.current;
    if (panel && slider) {
      gsap.to(slider, {
        y: -index * panel.offsetHeight,
        duration: 0.72,
        ease: "power3.inOut",
        overwrite: "auto",
      });
    }

    // 4. Drain previous description — clip upward offscreen
    if (prev !== null) {
      const pd = descRefs.current[prev];
      if (pd)
        gsap.to(pd, {
          clipPath: "inset(100% 0% 0% 0%)",
          duration: 0.25,
          ease: "power3.in",
          overwrite: "auto",
        });
    }

    // 5. Reveal new description — inset wipes from bottom → top
    const nd = descRefs.current[index];
    if (nd)
      gsap.fromTo(
        nd,
        { clipPath: "inset(100% 0% 0% 0%)" },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          duration: 0.55,
          ease: "power4.out",
          overwrite: "auto",
        },
      );

    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  // ── Leave handler ─────────────────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    if (!panelActiveRef.current) return;

    // Clip-path wipe panel out (sweep left → collapse to right edge)
    gsap.to(panelRef.current, {
      clipPath: "inset(0% 0% 0% 100%)",
      duration: 0.4,
      ease: "power4.in",
      overwrite: "auto",
    });

    // Drain active description — clip upward
    const curr = activeIndexRef.current;
    if (curr !== null) {
      const d = descRefs.current[curr];
      if (d)
        gsap.to(d, {
          clipPath: "inset(100% 0% 0% 0%)",
          duration: 0.25,
          ease: "power3.in",
          overwrite: "auto",
          onComplete: () => gsap.set(d, { clipPath: "inset(100% 0% 0% 0%)" }),
        });
    }

    panelActiveRef.current = false;
    activeIndexRef.current = null;
    setActiveIndex(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <section ref={sectionRef} className="relative w-full py-20 md:py-36">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          {/* Heading */}
          <h2
            ref={headingRef}
            className="w-full text-[clamp(4rem,10vw,9rem)] font-black text-title-red leading-none tracking-tighter mb-14 md:mb-20 opacity-0"
          >
            <span>Services</span>
          </h2>

          {/* Rows */}
          <div className="w-full" onMouseLeave={handleLeave}>
            {SERVICES.map((service, i) => (
              <div
                key={service.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                className="border-t border-maroon-light/30 last:border-b opacity-0"
                onMouseEnter={() => handleHover(i)}
              >
                <div className="flex items-center py-5 md:py-6 gap-4 md:gap-8 px-4 md:px-6 -mx-4 md:-mx-6 rounded-xl bg-background-secondary/20 backdrop-blur-md transition-all duration-300 hover:bg-background-secondary/30 hover:shadow-[0_0_30px_-8px_rgba(220,20,60,0.15)]">
                  {/* Index */}
                  <span className="text-maroon-light/60 text-[0.72rem] font-mono shrink-0 w-8 tabular-nums select-none">
                    ({service.id})
                  </span>

                  {/* Title */}
                  <span
                    className="shrink-0 leading-none select-none"
                    style={{
                      fontSize: "clamp(1.7rem, 3.2vw, 3.2rem)",
                      fontWeight: 600,
                      color: activeIndex === i ? "#FFFFFF" : "#800020",
                      transition: "color 0.38s cubic-bezier(0.16,1,0.3,1)",
                    }}
                  >
                    {service.name}
                  </span>

                  {/* Description — clip-path reveal, no overflow wrapper needed */}
                  <span className="hidden lg:block flex-1">
                    <span
                      ref={(el) => {
                        descRefs.current[i] = el;
                      }}
                      className="block text-[1.05rem] text-foreground-muted leading-relaxed max-w-[28ch]"
                      style={{
                        willChange: "clip-path",
                        clipPath: "inset(100% 0% 0% 0%)",
                      }}
                    >
                      {service.description}
                    </span>
                  </span>

                  {/* Plus */}
                  <span
                    className="ml-auto text-2xl shrink-0 select-none"
                    style={{
                      transform:
                        activeIndex === i ? "rotate(45deg)" : "rotate(0deg)",
                      color: activeIndex === i ? "#DC143C" : "#800020",
                      transition:
                        "transform 0.4s cubic-bezier(0.16,1,0.3,1), color 0.4s ease",
                    }}
                  >
                    +
                  </span>
                </div>

                {/* Mobile expand */}
                <div
                  className="lg:hidden overflow-hidden"
                  style={{
                    maxHeight: activeIndex === i ? "5rem" : "0px",
                    opacity: activeIndex === i ? 1 : 0,
                    paddingBottom: activeIndex === i ? "1rem" : "0",
                    transition:
                      "max-height 0.45s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease, padding-bottom 0.45s ease",
                  }}
                >
                  <p className="text-xs text-foreground-subtle leading-relaxed pl-11 pr-4">
                    {service.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Image panel — absolute, aligned to hovered row ── */}
        <div
          ref={panelRef}
          className="absolute hidden md:block overflow-hidden pointer-events-none z-50"
          style={{
            width: PANEL_W,
            height: PANEL_H,
            borderRadius: "4px",
            left: "clamp(52%, 58%, 64%)",
            top: 0,
          }}
        >
          {/* Image strip — single GSAP y tween slides to active index */}
          <div
            ref={sliderRef}
            className="absolute inset-x-0 top-0 will-change-transform"
          >
            {SERVICES.map((service) => (
              <div
                key={service.id}
                className="relative"
                style={{
                  width: "100%",
                  height: PANEL_H,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={service.image}
                  alt={service.name}
                  loading="eager"
                  decoding="async"
                  className="w-full h-full object-cover block"
                  style={{ filter: "contrast(1.08) saturate(0.82)" }}
                  draggable={false}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3">
                  <span className="text-white/60 text-[0.52rem] font-mono tracking-[0.22em] uppercase">
                    {service.id} / {service.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
