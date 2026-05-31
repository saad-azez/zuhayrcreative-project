"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import "@/app/styles/featured-works.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const WORKS = [
  {
    id: "forma-digital",
    year: "26",
    title: "Forma Digital",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80",
  },
  {
    id: "nero-vision",
    year: "25",
    title: "Nero Vision",
    image:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1800&q=80",
  },
];

export default function FeaturedWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const wrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();
  const enableEffects = !isTouch && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!enableEffects) return;

      cardRefs.current.forEach((card, index) => {
        const wrap = wrapRefs.current[index];
        if (!card || !wrap) return;

        gsap.set(card, { rotateX: 0, rotateZ: 0, scale: 1, y: 0 });

        gsap.fromTo(
          card,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.65,
            ease: "power3.out",
            scrollTrigger: {
              trigger: wrap,
              start: "top 80%",
            },
          },
        );

        if (index < cardRefs.current.length - 1) {
          gsap.to(card, {
            rotateZ: -10,
            rotateX: 6,
            y: -80,
            scale: 0.84,
            ease: "none",
            scrollTrigger: {
              trigger: wrap,
              start: "top top+=10%",
              end: "bottom top+=10%",
              scrub: true,
            },
          });
        }
      });
    },
    { scope: sectionRef, dependencies: [enableEffects] },
  );

  return (
    <section ref={sectionRef} className="featured-works" id="work">
      <div className="featured-works__header">
        <p className="featured-works__eyebrow">Featured Works</p>
        <h2 className="featured-works__title">Projects in Motion</h2>
        <p className="featured-works__subtext">
          Scroll through full-bleed case visuals that pivot, scale, and hand off
          to the next story.
        </p>
      </div>

      <div
        className="featured-works__stack"
        style={{ "--fw-count": WORKS.length } as CSSProperties}
      >
        {WORKS.map((work, index) => (
          <div
            key={work.id}
            ref={(el) => {
              wrapRefs.current[index] = el;
            }}
            className="featured-card-wrap"
          >
            <div
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              className="featured-card"
              style={{ backgroundImage: `url(${work.image})` }}
            >
              <div className="featured-card__overlay" />
              <div className="featured-card__content">
                <span className="featured-card__year">©{work.year}</span>
                <h3 className="featured-card__name">{work.title}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
