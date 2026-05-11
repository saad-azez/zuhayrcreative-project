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

type QuickToFunc = ReturnType<typeof gsap.quickTo>;

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

  // quickTo function refs (initialized once on mount)
  const qxPanel = useRef<QuickToFunc | null>(null);
  const qyPanel = useRef<QuickToFunc | null>(null);

  // ── Mouse tracking + quickTo setup ───────────────────────────────────────
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Center panel on the cursor position via xPercent/yPercent
    // (avoids transform conflict when GSAP also drives scale)
    gsap.set(panel, {
      xPercent: -50,
      yPercent: -50,
      scale: 0,
    });

    // Panel lags the most → creates the classic trailing depth feel
    qxPanel.current = gsap.quickTo(panel, "left", {
      duration: 0.8,
      ease: "power3",
    });
    qyPanel.current = gsap.quickTo(panel, "top", {
      duration: 0.8,
      ease: "power3",
    });

    const onMove = ({ clientX: x, clientY: y }: MouseEvent) => {
      qxPanel.current?.(x);
      qyPanel.current?.(y);
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // ── Entrance scroll animations ────────────────────────────────────────────
  useGSAP(
    () => {
      // Initial desc state — parked below overflow boundary, no opacity fade
      descRefs.current.forEach((d) => {
        if (d) gsap.set(d, { y: "105%", skewY: 4 });
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

  // ── Hover handler ─────────────────────────────────────────────────────────
  const handleHover = useCallback((index: number) => {
    const prev = activeIndexRef.current;

    // 1. Scale in panel on first enter
    if (!panelActiveRef.current) {
      gsap.to(panelRef.current, {
        scale: 1,
        duration: 0.5,
        ease: "power3.out",
        overwrite: "auto",
      });
      panelActiveRef.current = true;
    }

    if (prev === index) return;

    // direction: +1 = going down (larger index), -1 = going up
    const direction = prev === null || index > prev ? 1 : -1;

    // 2. Slide image strip to new index
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

    // 3. Drain previous description — exits full height upward
    if (prev !== null) {
      const pd = descRefs.current[prev];
      if (pd)
        gsap.to(pd, {
          y: direction === 1 ? "-105%" : "105%",
          skewY: direction === 1 ? -4 : 4,
          duration: 0.22,
          ease: "expo.in",
          overwrite: "auto",
        });
    }

    // 4. Reveal new description — enters from below/above, pure slide
    const nd = descRefs.current[index];
    if (nd)
      gsap.fromTo(
        nd,
        {
          y: direction === 1 ? "105%" : "-105%",
          skewY: direction === 1 ? 4 : -4,
        },
        {
          y: "0%",
          skewY: 0,
          duration: 0.5,
          ease: "expo.out",
          overwrite: "auto",
        },
      );

    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  // ── Leave handler ─────────────────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    if (!panelActiveRef.current) return;

    // Scale out panel
    gsap.to(panelRef.current, {
      scale: 0,
      duration: 0.45,
      ease: "power3.inOut",
      overwrite: "auto",
    });

    // Drain active description
    const curr = activeIndexRef.current;
    if (curr !== null) {
      const d = descRefs.current[curr];
      if (d)
        gsap.to(d, {
          y: "-105%",
          skewY: -4,
          duration: 0.22,
          ease: "expo.in",
          overwrite: "auto",
          onComplete: () => gsap.set(d, { y: "105%", skewY: 4 }),
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
            <span>&#169;Services</span>
            <sup className="text-[0.22em] text-title-red/40 font-light align-super ml-2 tracking-normal">
              (07)
            </sup>
          </h2>

          {/* Rows */}
          <div className="w-full" onMouseLeave={handleLeave}>
            {SERVICES.map((service, i) => (
              <div
                key={service.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                className="border-t border-maroon-light/30 last:border-b  opacity-0"
                onMouseEnter={() => handleHover(i)}
              >
                <div className="flex items-center py-5 md:py-6 gap-4 md:gap-8">
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

                  {/* Description — pure slide, NO opacity. overflow-hidden masks movement */}
                  <span className="hidden lg:block flex-1 overflow-hidden">
                    <span
                      ref={(el) => {
                        descRefs.current[i] = el;
                      }}
                      className="block text-[1.05rem] text-foreground-muted leading-relaxed max-w-[28ch]"
                      style={{
                        willChange: "transform",
                        transform: "translateY(105%)",
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
      </section>

      {/* ── Floating image panel — position:fixed, follows cursor via quickTo ── */}
      <div
        ref={panelRef}
        className="fixed top-0 left-0 hidden md:block overflow-hidden pointer-events-none z-50"
        style={{
          width: PANEL_W,
          height: PANEL_H,
          borderRadius: "4px",
          backgroundColor: "#38000E",
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
              className="relative overflow-hidden"
              style={{ width: "100%", height: PANEL_H }}
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
    </>
  );
}
