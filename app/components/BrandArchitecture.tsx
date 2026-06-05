"use client";

import { useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import "@/app/styles/brand-architecture.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

interface Slide {
  image: string;
  eyebrow: string;
  edition: string;
  title: string;
  desc: string;
  cta: string;
  ctaHref: string;
}

const SLIDES: Slide[] = [
  {
    image:
      "https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&w=1200&q=80",
    eyebrow: "About Zuhayr™",
    edition: "Edition 01",
    title: "Brand Architecture",
    desc: "Structured visual identities designed to position, differentiate, and scale with precision and clarity.",
    cta: "Get in touch",
    ctaHref: "#contact",
  },
  {
    image:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=80",
    eyebrow: "About Zuhayr™",
    edition: "Edition 02",
    title: "Digital Products",
    desc: "Interfaces engineered for clarity, motion, and conversion — from first frame to final ship.",
    cta: "See the work",
    ctaHref: "#work",
  },
  {
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
    eyebrow: "About Zuhayr™",
    edition: "Edition 03",
    title: "Creative Direction",
    desc: "Editorial-grade art direction that turns brands into stories your audience repeats out loud.",
    cta: "Start a brief",
    ctaHref: "#contact",
  },
  {
    image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
    eyebrow: "About Zuhayr™",
    edition: "Edition 04",
    title: "Growth Systems",
    desc: "SEO, automation, and performance loops wired into the design so traction compounds quietly.",
    cta: "Book a call",
    ctaHref: "#contact",
  },
];

/**
 * Brand Architecture — pinned split.
 * Left: vertical image stack scroll-tied.
 * Right: copy that swaps per frame (crossfade + lift) in sync with image.
 */
export default function BrandArchitecture() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const copyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();
  const enableEffects = !isTouch && !prefersReducedMotion;

  useGSAP(
    () => {
      if (!enableEffects) return;
      const track = trackRef.current;
      const stage = stageRef.current;
      const pin = pinRef.current;
      const copies = copyRefs.current.filter(Boolean) as HTMLDivElement[];
      if (!track || !stage || !pin || !copies.length) return;

      const n = SLIDES.length;
      if (n <= 1) return;

      // Initial pose — frame 0 active.
      gsap.set(track, { yPercent: 0 });
      copies.forEach((el, i) => {
        gsap.set(el, {
          opacity: i === 0 ? 1 : 0,
          pointerEvents: i === 0 ? "auto" : "none",
        });
      });

      // Image track: scroll-tied linear translation — image moves up as
      // user scrolls (cannot rest mid-frame because the snap below pulls
      // the scroll itself to the nearest whole frame).
      gsap.to(track, {
        yPercent: -((n - 1) / n) * 100,
        ease: "none",
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.3,
        },
      });

      let currentIndex = 0;
      // Switch copy at the moment the next image is fully on stage
      // (progress threshold = (idx + 0.5) / n keeps copy in sync with
      // the image that occupies the visible window).
      const setIndex = (idx: number) => {
        if (idx === currentIndex) return;
        currentIndex = idx;
        copies.forEach((el, i) => {
          gsap.set(el, {
            opacity: i === idx ? 1 : 0,
            pointerEvents: i === idx ? "auto" : "none",
          });
        });
      };

      ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        end: "bottom bottom",
        pin,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        // Snap whole page-scroll to each frame so the image never
        // settles mid-transition. The scroll itself eases into place.
        snap: {
          snapTo: (v) => {
            const step = 1 / (n - 1);
            return Math.round(v / step) * step;
          },
          duration: { min: 0.25, max: 0.7 },
          ease: "power2.inOut",
        },
        onUpdate: (self) => {
          // Use the same step as the snap so the copy flips exactly
          // when the scroll lands on a whole frame.
          const step = 1 / (n - 1);
          const idx = Math.min(n - 1, Math.round(self.progress / step));
          setIndex(idx);
        },
      });
    },
    { scope: sectionRef, dependencies: [enableEffects] },
  );

  return (
    <section ref={sectionRef} id="about" className="ba-section">
      <div
        ref={stageRef}
        className="ba-stage"
        style={{ height: `calc(100vh * ${SLIDES.length})` }}
      >
        <div ref={pinRef} className="ba-pin">
          <div className="ba-card">
            {/* LEFT — image stack */}
            <div className="ba-media">
              <div
                ref={trackRef}
                className="ba-track"
                style={{ height: `${SLIDES.length * 100}%` }}
              >
                {SLIDES.map((s, i) => (
                  <div key={i} className="ba-frame">
                    <Image
                      src={s.image}
                      alt=""
                      fill
                      sizes="(max-width: 980px) 100vw, 50vw"
                      priority={i === 0}
                      className="ba-frame__img"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — stacked copy blocks (crossfade in sync) */}
            <div className="ba-copy">
              <div className="ba-copy__deck">
                {SLIDES.map((s, i) => (
                  <div
                    key={i}
                    ref={(el) => {
                      copyRefs.current[i] = el;
                    }}
                    className="ba-copy__slide"
                  >
                    <div className="ba-copy__top">
                      <span className="ba-copy__eyebrow">
                        <span className="ba-copy__plus" aria-hidden>
                          +
                        </span>
                        {s.eyebrow}
                      </span>
                      <span className="ba-copy__edition">{s.edition}</span>
                    </div>

                    <h2 className="ba-copy__title">{s.title}</h2>

                    <p className="ba-copy__desc">{s.desc}</p>

                    <a className="ba-copy__cta" href={s.ctaHref}>
                      <span className="ba-copy__cta-arrow" aria-hidden>
                        ↳
                      </span>
                      {s.cta}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
