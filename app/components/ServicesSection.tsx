"use client";

import { useRef, useState, useCallback } from "react";
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
    image: "https://picsum.photos/seed/webdesign/800/1000",
  },
  {
    id: "02",
    name: "Social Media",
    description:
      "Strategic content ecosystems that build communities and drive authentic engagement.",
    image: "https://picsum.photos/seed/socialmedia/800/1000",
  },
  {
    id: "03",
    name: "AI Automation",
    description:
      "Intelligent workflow systems that eliminate friction and multiply operational capacity.",
    image: "https://picsum.photos/seed/aiautomation/800/1000",
  },
  {
    id: "04",
    name: "Marketing",
    description:
      "Data-informed campaigns that connect brand narratives with high-intent audiences.",
    image: "https://picsum.photos/seed/marketing/800/1000",
  },
  {
    id: "05",
    name: "SEO Optimization",
    description:
      "Technical and content-driven SEO strategies designed to increase visibility and sustainable traffic.",
    image: "https://picsum.photos/seed/seooptimize/800/1000",
  },
  {
    id: "06",
    name: "Development",
    description:
      "Production-grade engineering with a focus on performance, scalability, and clean architecture.",
    image: "https://picsum.photos/seed/development/800/1000",
  },
  {
    id: "07",
    name: "AI Consulting",
    description:
      "Strategic AI advisory that maps intelligent solutions directly to your business objectives.",
    image: "https://picsum.photos/seed/aiconsult/800/1000",
  },
];

const SLIDE_DUR = 0.72;
// clip-path flood constants
const CLIP_HIDDEN = "inset(100% 0% 0% 0% round 3px)"; // fully hidden (top clips 100% down)
const CLIP_VISIBLE = "inset(0% 0% 0% 0% round 3px)"; // fully revealed
const CLIP_DRAIN = "inset(0% 0% 100% 0% round 3px)"; // draining (bottom clips 100% up)

export default function ServicesSection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null); // the whole image panel
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const innerImgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const activeIndexRef = useRef<number | null>(null);
  const panelVisibleRef = useRef(false); // tracks flood state

  // Entrance scroll animations
  useGSAP(
    () => {
      if (!headingRef.current) return;

      gsap.fromTo(
        headingRef.current,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1.1,
          ease: "power4.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 82%",
          },
        },
      );

      rowRefs.current.forEach((row, i) => {
        if (!row) return;
        gsap.fromTo(
          row,
          { x: -40, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.65,
            ease: "power3.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 78%",
            },
            delay: i * 0.055,
          },
        );
      });
    },
    { scope: sectionRef },
  );

  // Called when cursor enters any service row
  const handleHover = useCallback((index: number) => {
    const prev = activeIndexRef.current;

    // ── 1. Compute vertical target: row centre relative to section ──
    const row = rowRefs.current[index];
    const section = sectionRef.current;
    const panel = panelRef.current;
    if (row && section && panel) {
      const sectionRect = section.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      // row centre in section-local coords
      const rowCentreInSection =
        rowRect.top - sectionRect.top + rowRect.height / 2;
      const panelH = panel.offsetHeight;
      // clamp so panel never overflows section vertically
      const minTop = 0;
      const maxTop = section.offsetHeight - panelH;
      const targetTop = Math.min(
        Math.max(rowCentreInSection - panelH / 2, minTop),
        maxTop,
      );
      gsap.to(panel, {
        top: targetTop,
        duration: 0.75,
        ease: "expo.out",
        overwrite: "auto",
      });
    }

    // ── 2. FLOOD the panel in (only on first enter) ──
    if (!panelVisibleRef.current && panel) {
      gsap.fromTo(
        panel,
        { clipPath: CLIP_HIDDEN },
        { clipPath: CLIP_VISIBLE, duration: 0.9, ease: "power4.out" },
      );
      panelVisibleRef.current = true;
    }

    if (prev === index) return;

    const direction = prev === null || index > prev ? 1 : -1;

    // ── 3. EXIT previous image ──
    if (prev !== null) {
      const prevC = containerRefs.current[prev];
      const prevI = innerImgRefs.current[prev];
      if (prevC)
        gsap.to(prevC, {
          y: direction === 1 ? "-108%" : "108%",
          duration: SLIDE_DUR,
          ease: "expo.inOut",
        });
      if (prevI)
        gsap.to(prevI, {
          y: direction === 1 ? "8%" : "-8%",
          duration: SLIDE_DUR,
          ease: "expo.inOut",
        });
    }

    // ── 4. ENTER new image ──
    const newC = containerRefs.current[index];
    const newI = innerImgRefs.current[index];
    if (newC)
      gsap.fromTo(
        newC,
        { y: direction === 1 ? "108%" : "-108%" },
        { y: "0%", duration: SLIDE_DUR, ease: "expo.inOut" },
      );
    if (newI)
      gsap.fromTo(
        newI,
        { y: direction === 1 ? "-8%" : "8%", scale: 1.06 },
        { y: "0%", scale: 1, duration: SLIDE_DUR, ease: "expo.inOut" },
      );

    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  // Called when cursor leaves the entire list area
  const handleLeave = useCallback(() => {
    if (!panelVisibleRef.current || !panelRef.current) return;

    // ── DRAIN the panel out (bottom clips upward) ──
    gsap.to(panelRef.current, {
      clipPath: CLIP_DRAIN,
      duration: 0.6,
      ease: "power3.inOut",
      onComplete: () => {
        // reset everything for next entry
        panelVisibleRef.current = false;
        containerRefs.current.forEach((c) => {
          if (c) gsap.set(c, { y: "108%" });
        });
        innerImgRefs.current.forEach((img) => {
          if (img) gsap.set(img, { y: "0%", scale: 1 });
        });
      },
    });

    activeIndexRef.current = null;
    setActiveIndex(null);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-[#0a0a0a] py-20 md:py-36"
    >
      {/* Content container — right padding on desktop makes room for the absolute image */}
      <div
        className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16"
        style={{ paddingRight: "clamp(1rem, calc(28vw + 3rem), 460px)" }}
      >
        {/* Heading */}
        <h2
          ref={headingRef}
          className="w-full text-[clamp(3.2rem,8vw,7rem)] font-black text-white leading-none tracking-tighter mb-14 md:mb-20 opacity-0"
        >
          <span>©Services</span>
          <sup className="text-[0.22em] text-zinc-500 font-light align-super ml-2 tracking-normal">
            (07)
          </sup>
        </h2>

        {/* Rows — full width, image is outside this container */}
        <div className="w-full" onMouseLeave={handleLeave}>
          {SERVICES.map((service, i) => (
            <div
              key={service.id}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className="border-t border-zinc-800/60 last:border-b cursor-pointer opacity-0"
              onMouseEnter={() => handleHover(i)}
            >
              <div className="flex items-center py-5 md:py-7 gap-4 md:gap-6">
                <span className="text-zinc-600 text-[0.6rem] font-mono shrink-0 w-7 select-none tabular-nums">
                  ({service.id})
                </span>

                <span
                  className="text-[clamp(1.4rem,2.8vw,2.5rem)] leading-none shrink-0 select-none"
                  style={{
                    color: activeIndex === i ? "#f4f4f5" : "#3f3f46",
                    fontWeight: activeIndex === i ? 700 : 500,
                    transition: "color 0.45s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  {service.name}
                </span>

                <span
                  className="hidden lg:block text-[0.75rem] text-zinc-400 leading-relaxed flex-1 max-w-[22ch]"
                  style={{
                    opacity: activeIndex === i ? 1 : 0,
                    transform:
                      activeIndex === i
                        ? "translateX(0px)"
                        : "translateX(-10px)",
                    transition:
                      "opacity 0.45s cubic-bezier(0.16,1,0.3,1), transform 0.45s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  {service.description}
                </span>

                <span
                  className="ml-auto text-base shrink-0 select-none"
                  style={{
                    transform:
                      activeIndex === i ? "rotate(45deg)" : "rotate(0deg)",
                    color: activeIndex === i ? "#71717a" : "#3f3f46",
                    transition:
                      "transform 0.45s cubic-bezier(0.16,1,0.3,1), color 0.45s ease",
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
                  paddingBottom: activeIndex === i ? "1.1rem" : "0",
                  transition:
                    "max-height 0.45s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease, padding-bottom 0.45s ease",
                }}
              >
                <p className="text-xs text-zinc-500 leading-relaxed pl-11 pr-4">
                  {service.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Image Panel ──
          position: absolute  →  right edge of the section, vertically centred.
          Lives OUTSIDE the max-w container so it bleeds to the viewport edge.
          clip-path flood/drain controlled by GSAP on panelRef.
      */}
      <div
        ref={panelRef}
        className="hidden md:block absolute overflow-hidden bg-zinc-900 pointer-events-none"
        style={{
          width: "clamp(240px, 26vw, 400px)",
          height: "clamp(320px, 34vw, 520px)",
          right: 0,
          top: "10%",
          borderRadius: "3px 0 0 3px",
          clipPath: CLIP_HIDDEN,
        }}
      >
        {SERVICES.map((service, i) => (
          <div
            key={service.id}
            ref={(el) => {
              containerRefs.current[i] = el;
            }}
            className="absolute inset-0 will-change-transform"
            style={{ transform: "translateY(108%)", zIndex: i }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={(el) => {
                innerImgRefs.current[i] = el;
              }}
              src={service.image}
              alt={service.name}
              className="w-full h-full object-cover will-change-transform"
              style={{ filter: "contrast(1.06) saturate(0.88)" }}
              draggable={false}
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
            <div className="absolute bottom-5 left-5">
              <span className="text-white/70 text-[0.58rem] font-mono tracking-[0.2em] uppercase">
                {service.id} — {service.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
