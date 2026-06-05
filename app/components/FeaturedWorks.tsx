"use client";

import { useRef } from "react";
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

/**
 * Featured Works — pinned stage where each card rotates + scales into the
 * viewport center, then rotates + scales out as the next card rotates in.
 * Inspired by the Altrum work showcase.
 */
export default function FeaturedWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();
  const enableEffects = !isTouch && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!enableEffects) return;
      const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
      const stage = stageRef.current;
      const pin = pinRef.current;
      if (!cards.length || !stage || !pin) return;

      const N = cards.length;

      // Initial pose for each card
      cards.forEach((card, i) => {
        gsap.set(card, {
          opacity: i === 0 ? 1 : 0,
          scale: i === 0 ? 1 : 0.45,
          rotate: i === 0 ? 0 : -18,
          yPercent: i === 0 ? 0 : 25,
          xPercent: i === 0 ? 0 : -8,
          zIndex: N - i,
        });
      });

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
          pin,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // Each card "owns" the scroll window [i, i+1].
      // It peaks at unit `i`. Exit happens in [i, i+0.55] while the next card
      // enters in [i+0.05, i+0.6] for an overlap that feels like a handoff.
      cards.forEach((card, i) => {
        // Enter (only for i > 0, since card 0 starts in place)
        if (i > 0) {
          tl.to(
            card,
            {
              opacity: 1,
              scale: 1,
              rotate: 0,
              yPercent: 0,
              xPercent: 0,
              duration: 0.55,
            },
            i - 0.45, // overlap with previous card's exit
          );
        }

        // Exit (only for non-last cards)
        if (i < N - 1) {
          tl.to(
            card,
            {
              opacity: 0,
              scale: 0.45,
              rotate: 18,
              yPercent: -25,
              xPercent: 8,
              duration: 0.55,
            },
            i, // exit starts as card sits at center
          );
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
        ref={stageRef}
        className="featured-works__stage"
        style={{ ["--fw-count" as string]: WORKS.length }}
      >
        <div ref={pinRef} className="featured-works__pin">
          {WORKS.map((work, index) => (
            <div
              key={work.id}
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
          ))}
        </div>
      </div>
    </section>
  );
}
