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

const IMG_DUR = 0.72;
const TXT_DUR = 0.58;

const PANEL_HIDDEN = "inset(100% 0% 0% 0% round 2px)";
const PANEL_VISIBLE = "inset(0% 0% 0% 0% round 2px)";
const PANEL_DRAIN = "inset(0% 0% 100% 0% round 2px)";

// Direction-aware desc clip states:
// TXT_BELOW = entering from below (top-clip=100% → nothing visible → reveals top-to-bottom)
// TXT_ABOVE = entering from above (bottom-clip=100% → nothing visible → reveals bottom-to-top)
const TXT_BELOW = "inset(100% 0% 0% 0%)";
const TXT_ABOVE = "inset(0% 0% 100% 0%)";
const TXT_VISIBLE = "inset(0% 0% 0% 0%)";

export default function ServicesSection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const descRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const innerImgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const activeIndexRef = useRef<number | null>(null);
  const panelVisibleRef = useRef(false);

  useGSAP(
    () => {
      // Set panel initial top in pixels so GSAP never has to convert % on first tween
      if (panelRef.current && sectionRef.current) {
        const ph = panelRef.current.offsetHeight;
        const sh = sectionRef.current.offsetHeight;
        gsap.set(panelRef.current, { top: (sh - ph) / 2 });
      }

      // Set desc initial hidden state via GSAP (avoids inline-style / GSAP conflict)
      descRefs.current.forEach((d) => {
        if (d) gsap.set(d, { clipPath: TXT_BELOW, y: 14, opacity: 0 });
      });

      // Heading entrance
      if (headingRef.current) {
        gsap.fromTo(
          headingRef.current,
          { y: 55, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1.1,
            ease: "power4.out",
            scrollTrigger: { trigger: sectionRef.current, start: "top 82%" },
          },
        );
      }

      // Row stagger entrance — single ScrollTrigger shared across all rows
      const validRows = rowRefs.current.filter(Boolean);
      if (validRows.length) {
        gsap.fromTo(
          validRows,
          { x: -36, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.65,
            ease: "power3.out",
            stagger: 0.055,
            scrollTrigger: { trigger: sectionRef.current, start: "top 78%" },
          },
        );
      }
    },
    { scope: sectionRef },
  );

  const handleHover = useCallback((index: number) => {
    const prev = activeIndexRef.current;
    const panel = panelRef.current;
    const section = sectionRef.current;

    // 1. Track panel to hovered row (pixel top, overwrite prevents stacking)
    const row = rowRefs.current[index];
    if (row && section && panel) {
      const sr = section.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      const rowMid = rr.top - sr.top + rr.height / 2;
      const ph = panel.offsetHeight;
      const targetTop = Math.min(
        Math.max(rowMid - ph / 2, 0),
        section.offsetHeight - ph,
      );
      gsap.to(panel, {
        top: targetTop,
        duration: 0.72,
        ease: "expo.out",
        overwrite: "auto",
      });
    }

    // 2. Flood panel on first enter
    if (!panelVisibleRef.current && panel) {
      gsap.fromTo(
        panel,
        { clipPath: PANEL_HIDDEN },
        {
          clipPath: PANEL_VISIBLE,
          duration: 0.82,
          ease: "power4.out",
          overwrite: "auto",
        },
      );
      panelVisibleRef.current = true;
    }

    if (prev === index) return;

    // direction: +1 = moving DOWN (to larger index), -1 = moving UP
    const direction = prev === null || index > prev ? 1 : -1;

    // 3. Drain previous description (direction-aware)
    if (prev !== null) {
      const prevDesc = descRefs.current[prev];
      if (prevDesc)
        gsap.to(prevDesc, {
          clipPath: direction === 1 ? TXT_ABOVE : TXT_BELOW,
          y: direction === 1 ? -12 : 12,
          opacity: 0,
          duration: TXT_DUR * 0.78,
          ease: "expo.inOut",
          overwrite: "auto",
        });
    }

    // 4. Reveal new description (direction-aware)
    const newDesc = descRefs.current[index];
    if (newDesc)
      gsap.fromTo(
        newDesc,
        {
          clipPath: direction === 1 ? TXT_BELOW : TXT_ABOVE,
          y: direction === 1 ? 14 : -14,
          opacity: 0,
        },
        {
          clipPath: TXT_VISIBLE,
          y: 0,
          opacity: 1,
          duration: TXT_DUR * 1.1,
          ease: "expo.out",
          delay: 0.04,
          overwrite: "auto",
        },
      );

    // 5. Set z-index before exiting prev so new image is always on top
    if (prev !== null) {
      const prevC = containerRefs.current[prev];
      const prevI = innerImgRefs.current[prev];
      if (prevC) {
        gsap.set(prevC, { zIndex: 1 });
        gsap.to(prevC, {
          y: direction === 1 ? "-108%" : "108%",
          duration: IMG_DUR,
          ease: "expo.inOut",
          overwrite: "auto",
        });
      }
      if (prevI)
        gsap.to(prevI, {
          y: direction === 1 ? "8%" : "-8%",
          duration: IMG_DUR,
          ease: "expo.inOut",
          overwrite: "auto",
        });
    }

    // 6. Enter new image on top
    const newC = containerRefs.current[index];
    const newI = innerImgRefs.current[index];
    if (newC) {
      gsap.set(newC, { zIndex: 2 });
      gsap.fromTo(
        newC,
        { y: direction === 1 ? "108%" : "-108%" },
        { y: "0%", duration: IMG_DUR, ease: "expo.inOut", overwrite: "auto" },
      );
    }
    if (newI)
      gsap.fromTo(
        newI,
        { y: direction === 1 ? "-6%" : "6%", scale: 1.06 },
        {
          y: "0%",
          scale: 1,
          duration: IMG_DUR,
          ease: "expo.inOut",
          overwrite: "auto",
        },
      );

    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  const handleLeave = useCallback(() => {
    if (!panelVisibleRef.current || !panelRef.current) return;

    const curr = activeIndexRef.current;
    if (curr !== null) {
      const desc = descRefs.current[curr];
      if (desc)
        gsap.to(desc, {
          clipPath: TXT_ABOVE,
          y: -10,
          opacity: 0,
          duration: 0.38,
          ease: "power3.inOut",
          overwrite: "auto",
        });
    }

    gsap.to(panelRef.current, {
      clipPath: PANEL_DRAIN,
      duration: 0.55,
      ease: "power3.inOut",
      overwrite: "auto",
      onComplete: () => {
        panelVisibleRef.current = false;
        containerRefs.current.forEach((c, i) => {
          if (c) gsap.set(c, { y: "108%", zIndex: i });
        });
        innerImgRefs.current.forEach((img) => {
          if (img) gsap.set(img, { y: "0%", scale: 1 });
        });
        descRefs.current.forEach((d) => {
          if (d) gsap.set(d, { clipPath: TXT_BELOW, y: 14, opacity: 0 });
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
      <div
        className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16"
        style={{ paddingRight: "clamp(1rem, calc(22vw + 2rem), 340px)" }}
      >
        <h2
          ref={headingRef}
          className="w-full text-[clamp(3.2rem,8vw,7rem)] font-black text-white leading-none tracking-tighter mb-14 md:mb-20 opacity-0"
        >
          <span>©Services</span>
          <sup className="text-[0.22em] text-zinc-500 font-light align-super ml-2 tracking-normal">
            (07)
          </sup>
        </h2>

        <div className="w-full" onMouseLeave={handleLeave}>
          {SERVICES.map((service, i) => (
            <div
              key={service.id}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className="border-t border-zinc-800/50 last:border-b cursor-pointer opacity-0"
              onMouseEnter={() => handleHover(i)}
            >
              <div className="flex items-center py-5 md:py-6 gap-4 md:gap-8">
                {/* Index */}
                <span className="text-zinc-700 text-[0.58rem] font-mono shrink-0 w-7 tabular-nums select-none">
                  ({service.id})
                </span>

                {/* Title — color transition only (font-weight cannot be CSS-interpolated) */}
                <span
                  className="shrink-0 leading-none select-none"
                  style={{
                    fontSize: "clamp(1.35rem, 2.6vw, 2.4rem)",
                    fontWeight: 600,
                    color: activeIndex === i ? "#f4f4f5" : "#2d2d31",
                    transition: "color 0.38s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  {service.name}
                </span>

                {/* Description — GSAP owns clip-path + y + opacity */}
                <span className="hidden lg:block flex-1 overflow-hidden">
                  <span
                    ref={(el) => {
                      descRefs.current[i] = el;
                    }}
                    className="block text-[0.73rem] text-zinc-400 leading-relaxed max-w-[28ch]"
                    style={{ willChange: "transform, clip-path, opacity" }}
                  >
                    {service.description}
                  </span>
                </span>

                {/* Plus */}
                <span
                  className="ml-auto text-sm shrink-0 select-none"
                  style={{
                    transform:
                      activeIndex === i ? "rotate(45deg)" : "rotate(0deg)",
                    color: activeIndex === i ? "#52525b" : "#27272a",
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
                <p className="text-xs text-zinc-600 leading-relaxed pl-11 pr-4">
                  {service.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image panel — absolute right edge */}
      <div
        ref={panelRef}
        className="hidden md:block absolute overflow-hidden pointer-events-none"
        style={{
          width: "clamp(180px, 20vw, 280px)",
          height: "clamp(240px, 27vw, 360px)",
          right: 0,
          top: "50%",
          borderRadius: "2px 0 0 2px",
          clipPath: PANEL_HIDDEN,
          backgroundColor: "#111",
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
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover will-change-transform"
              style={{ filter: "contrast(1.08) saturate(0.82)" }}
              draggable={false}
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-3">
              <span className="text-white/60 text-[0.52rem] font-mono tracking-[0.22em] uppercase">
                {service.id} / {service.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
