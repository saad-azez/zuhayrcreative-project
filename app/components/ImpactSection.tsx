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

export default function ImpactSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stat1Ref = useRef<HTMLDivElement>(null);
  const stat2Ref = useRef<HTMLDivElement>(null);
  const stat3Ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!sectionRef.current) return;

    const statRefs = [stat1Ref, stat2Ref, stat3Ref];

    statRefs.forEach((ref, index) => {
      if (!ref.current) return;

      const numberElement = ref.current.querySelector(".stat-number");
      const labelElement = ref.current.querySelector(".stat-label");
      const stat = stats[index];

      const counter = { value: 0 };

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top 80%",
          end: "top 30%",
          toggleActions: "play none none reverse",
        },
      });

      tl.to(counter, {
        value: stat.target,
        duration: 2.5,
        ease: "power2.out",
        delay: index * 0.2,
        onUpdate: () => {
          if (numberElement) {
            numberElement.textContent = Math.ceil(counter.value).toString();
          }
        },
      });

      tl.from(
        labelElement,
        {
          opacity: 0,
          y: 20,
          duration: 0.8,
          ease: "power2.out",
        },
        "-=2"
      );

      tl.from(
        numberElement,
        {
          scale: 0.5,
          opacity: 0,
          duration: 1,
          ease: "back.out(1.7)",
        },
        "-=2.5"
      );
    });

    const heading1 = sectionRef.current.querySelector(".heading-1");
    const heading2 = sectionRef.current.querySelector(".heading-2");
    const desc1 = sectionRef.current.querySelector(".desc-1");
    const desc2 = sectionRef.current.querySelector(".desc-2");

    if (heading1) {
      gsap.from(heading1, {
        x: -100,
        opacity: 0,
        duration: 1.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: heading1,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      });
    }

    if (heading2) {
      gsap.from(heading2, {
        x: 100,
        opacity: 0,
        duration: 1.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: heading2,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      });
    }

    [desc1, desc2].forEach((desc) => {
      if (desc) {
        gsap.from(desc, {
          y: 30,
          opacity: 0,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: desc,
            start: "top 90%",
            toggleActions: "play none none reverse",
          },
        });
      }
    });
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-x-hidden w-full max-w-full py-32 md:py-48 px-6 md:px-12"
    >
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-20 md:mb-32">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-12 lg:gap-24">
            <div className="flex-1">
              <h2 className="heading-1 text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight leading-tight">
                BEYOND INFLUENCE
              </h2>
              <p className="desc-1 text-base md:text-lg text-foreground-muted max-w-md leading-relaxed">
                Influence goes beyond aesthetics; it shifts perceptions,
                inspires conversation, and sets new standards. We help brands
                express clarity and ambition.
              </p>
            </div>

            <div className="flex-1 lg:text-right">
              <h2 className="heading-2 text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight leading-tight">
                AND IMPACT
              </h2>
              <p className="desc-2 text-base md:text-lg text-foreground-muted max-w-md lg:ml-auto leading-relaxed">
                where creativity meets consequence, effectively transforming
                ideas into actionable plans and strategy into sustainable growth
                opportunities.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-12 md:space-y-16">
          <div ref={stat1Ref} className="stat-item">
            <div className="flex items-baseline gap-2">
              <span className="stat-number text-7xl md:text-8xl lg:text-9xl font-bold text-foreground tracking-tighter">
                0
              </span>
              <span className="text-5xl md:text-6xl lg:text-7xl font-bold text-maroon-accent">
                {stats[0].suffix}
              </span>
            </div>
            <p className="stat-label text-sm md:text-base text-foreground-muted mt-3 max-w-xs">
              {stats[0].label}
            </p>
          </div>

          <div ref={stat2Ref} className="stat-item ml-12 md:ml-20">
            <div className="flex items-baseline gap-2">
              <span className="stat-number text-7xl md:text-8xl lg:text-9xl font-bold text-foreground tracking-tighter">
                0
              </span>
              <span className="text-5xl md:text-6xl lg:text-7xl font-bold text-maroon-accent">
                {stats[1].suffix}
              </span>
            </div>
            <p className="stat-label text-sm md:text-base text-foreground-muted mt-3 max-w-xs">
              {stats[1].label}
            </p>
          </div>

          <div ref={stat3Ref} className="stat-item ml-24 md:ml-40">
            <div className="flex items-baseline gap-2">
              <span className="stat-number text-7xl md:text-8xl lg:text-9xl font-bold text-foreground tracking-tighter">
                0
              </span>
              <span className="text-5xl md:text-6xl lg:text-7xl font-bold text-maroon-accent">
                {stats[2].suffix}
              </span>
            </div>
            <p className="stat-label text-sm md:text-base text-foreground-muted mt-3 max-w-xs">
              {stats[2].label}
            </p>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-[800px] h-[800px] rounded-full bg-maroon-dark/10 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-maroon-accent/5 blur-[100px]" />
      </div>
    </section>
  );
}
