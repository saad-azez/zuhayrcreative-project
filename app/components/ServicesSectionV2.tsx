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
    image: "https://picsum.photos/seed/webdesign/400/500",
  },
  {
    id: "02",
    name: "Social Media",
    description:
      "Strategic content ecosystems that build communities and drive authentic engagement.",
    image: "https://picsum.photos/seed/socialmedia/400/500",
  },
  {
    id: "03",
    name: "AI Automation",
    description:
      "Intelligent workflow systems that eliminate friction and multiply operational capacity.",
    image: "https://picsum.photos/seed/aiautomation/400/500",
  },
  {
    id: "04",
    name: "Marketing",
    description:
      "Data-informed campaigns that connect brand narratives with high-intent audiences.",
    image: "https://picsum.photos/seed/marketing/400/500",
  },
  {
    id: "05",
    name: "SEO",
    description:
      "Technical and content-driven SEO strategies designed to increase visibility and sustainable traffic.",
    image: "https://picsum.photos/seed/seooptimize/400/500",
  },
  {
    id: "06",
    name: "Development",
    description:
      "Production-grade engineering with a focus on performance, scalability, and clean architecture.",
    image: "https://picsum.photos/seed/development/400/500",
  },
  {
    id: "07",
    name: "AI Consulting",
    description:
      "Strategic AI advisory that maps intelligent solutions directly to your business objectives.",
    image: "https://picsum.photos/seed/aiconsult/400/500",
  },
];

export default function ServicesSectionV2() {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const nameRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const hasHovered = useRef(false);

  // Entrance animation
  useGSAP(
    () => {
      const names = sectionRef.current?.querySelectorAll(".service-name");
      if (!names) return;

      gsap.fromTo(
        names,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.05,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
          },
        },
      );
    },
    { scope: sectionRef },
  );

  // On hover, animate all non-hovered items to gray
  const handleHover = useCallback(
    (index: number) => {
      if (index === activeIndex) return;
      hasHovered.current = true;
      setActiveIndex(index);

      // Animate name colors
      nameRefs.current.forEach((el, i) => {
        if (!el) return;
        gsap.to(el, {
          color: i === index ? "#ffffff" : "rgba(255,255,255,0.2)",
          duration: 0.4,
          ease: "power2.out",
          overwrite: true,
        });
      });

      // Image crossfade
      if (imageRef.current) {
        gsap.to(imageRef.current, {
          opacity: 0,
          duration: 0.2,
          ease: "power2.in",
          overwrite: true,
          onComplete: () => {
            if (imageRef.current) {
              imageRef.current.src = SERVICES[index].image;
              gsap.to(imageRef.current, {
                opacity: 1,
                duration: 0.35,
                ease: "power2.out",
              });
            }
          },
        });
      }

      // Description crossfade
      if (descRef.current) {
        gsap.to(descRef.current, {
          opacity: 0,
          y: 6,
          duration: 0.18,
          ease: "power2.in",
          overwrite: true,
          onComplete: () => {
            if (descRef.current) {
              gsap.to(descRef.current, {
                opacity: 1,
                y: 0,
                duration: 0.3,
                ease: "power2.out",
              });
            }
          },
        });
      }

      // Badge pop
      if (badgeRef.current) {
        gsap.to(badgeRef.current, {
          scale: 0.8,
          opacity: 0,
          duration: 0.12,
          ease: "power2.in",
          overwrite: true,
          onComplete: () => {
            if (badgeRef.current) {
              gsap.to(badgeRef.current, {
                scale: 1,
                opacity: 1,
                duration: 0.25,
                ease: "back.out(2)",
              });
            }
          },
        });
      }
    },
    [activeIndex],
  );

  // When mouse leaves the list, reset all to white
  const handleLeave = useCallback(() => {
    setActiveIndex(null);
    hasHovered.current = false;

    nameRefs.current.forEach((el) => {
      if (!el) return;
      gsap.to(el, {
        color: "#ffffff",
        duration: 0.4,
        ease: "power2.out",
        overwrite: true,
      });
    });
  }, []);

  // Determine display index (show first service details by default)
  const displayIndex = activeIndex ?? 0;

  return (
    <section
      ref={sectionRef}
      className="relative w-full py-24 md:py-36"
    >
      {/* Dark container */}
      <div className="w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-16 bg-[#0d0d0d] rounded-2xl py-16 md:py-24 border border-white/5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-12 md:mb-16 px-4 md:px-8">
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-foreground-muted">
            Our Services
          </span>
          <span className="text-[11px] font-mono text-foreground-subtle">
            {String(displayIndex + 1).padStart(2, "0")}
          </span>
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-foreground-muted">
            What We Do
          </span>
        </div>

        {/* 3-column grid: image | list | details — all bottom-aligned */}
        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr_260px] lg:grid-cols-[160px_1fr_280px] gap-6 md:gap-10 px-4 md:px-8 items-end">
          {/* Column 1 — Image */}
          <div className="hidden md:block">
            <div className="w-full aspect-[4/5] rounded-md overflow-hidden shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={SERVICES[displayIndex].image}
                alt={SERVICES[displayIndex].name}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
          </div>

          {/* Column 2 — Service names, right-aligned */}
          <div className="flex flex-col items-end gap-0" onMouseLeave={handleLeave}>
            {SERVICES.map((service, i) => (
              <div
                key={service.id}
                className="service-name"
                onMouseEnter={() => handleHover(i)}
              >
                <span
                  ref={(el) => { nameRefs.current[i] = el; }}
                  className="block text-[clamp(1.5rem,4vw,3.2rem)] tracking-[-0.02em] leading-[1.3] cursor-pointer select-none text-right"
                  style={{
                    fontFamily: "var(--font-geist-sans)",
                    fontWeight: 400,
                    color: activeIndex === null ? "#ffffff" : (activeIndex === i ? "#ffffff" : "rgba(255,255,255,0.2)"),
                  }}
                >
                  {service.name}
                </span>
              </div>
            ))}
          </div>

          {/* Column 3 — Details, bottom-aligned same as list */}
          <div className="hidden md:block">
            <div ref={descRef} className="flex flex-col gap-3">
              {/* Badge */}
              <div
                ref={badgeRef}
                className="w-9 h-9 rounded-full bg-title-red/20 border border-title-red/30 flex items-center justify-center"
              >
                <span className="text-[10px] font-mono text-title-red">
                  {SERVICES[displayIndex].id}
                </span>
              </div>

              {/* Description */}
              <p className="text-[13px] text-foreground/70 leading-relaxed">
                &ldquo;{SERVICES[displayIndex].description}&rdquo;
              </p>

              {/* Label */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-foreground">
                  {SERVICES[displayIndex].name}
                </span>
                <span className="text-[10px] tracking-wider uppercase text-foreground-subtle">
                  Zuhayr Creative
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile description */}
        <div className="md:hidden mt-8 text-center px-4">
          <p className="text-sm text-foreground-muted leading-relaxed max-w-sm mx-auto">
            {SERVICES[displayIndex].description}
          </p>
        </div>
      </div>
    </section>
  );
}
