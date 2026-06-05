"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import "@/app/styles/testimonials.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

interface Testimonial {
  id: string;
  brand: string;
  brandMark: string; // emoji / short text used as fallback mark
  quote: string;
  name: string;
  role: string;
  avatar: string;
  bg?: string;
}

const FEATURED: Testimonial = {
  id: "featured",
  brand: "Zuhayr™",
  brandMark: "Z",
  quote:
    "The collaboration was smooth from start to finish. Zuhayr Creative combines strong visual design with strategic thinking, delivering work that feels both premium and purposeful.",
  name: "Daniel Whitmore",
  role: "Marketing, VK Group",
  avatar:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
  bg: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1600&q=80",
};

const ITEMS: Testimonial[] = [
  {
    id: "nova-systems",
    brand: "Nova Systems",
    brandMark: "◎",
    quote:
      "The collaboration was smooth from start to finish. Zuhayr combines strong visual design with strategic thinking, delivering work that feels both premium and purposeful.",
    name: "Lucas Bennett",
    role: "Product Director, Nova Systems",
    avatar:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "aure-labs",
    brand: "Aure Labs",
    brandMark: "⌬",
    quote:
      "Zuhayr brought clarity and structure to our digital strategy. Their design thinking and execution transformed complex ideas into a seamless and elegant experience.",
    name: "Emma Laurent",
    role: "Head of Marketing, Aure Labs",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "forma-co",
    brand: "Forma Co.",
    brandMark: "✦",
    quote:
      "From kickoff to launch, the team was sharp, fast, and ruthlessly focused on outcomes. They shipped a brand system that genuinely shifted how our market sees us.",
    name: "Idris Kapoor",
    role: "Founder, Forma Co.",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80",
  },
];

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const featuredRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [openId, setOpenId] = useState<string | null>(ITEMS[0]?.id ?? null);
  const { prefersReducedMotion } = useDeviceDetect();

  useGSAP(
    () => {
      if (prefersReducedMotion) return;

      gsap.from(featuredRef.current, {
        opacity: 0,
        y: 40,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
        },
      });

      const items = listRef.current?.querySelectorAll(".tst-item");
      if (items?.length) {
        gsap.from(items, {
          opacity: 0,
          y: 30,
          duration: 0.6,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: listRef.current,
            start: "top 80%",
          },
        });
      }
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] },
  );

  const toggle = (id: string) =>
    setOpenId((curr) => (curr === id ? null : id));

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className="tst-section"
      aria-labelledby="tst-title"
    >
      <div className="tst-header">
        <p className="tst-eyebrow">Testimonials</p>
        <h2 id="tst-title" className="tst-title">
          Words from the people we ship with.
        </h2>
      </div>

      <div className="tst-grid">
        {/* ── LEFT: featured card ── */}
        <article
          ref={featuredRef}
          className="tst-featured"
          style={
            FEATURED.bg
              ? ({ backgroundImage: `url(${FEATURED.bg})` } as React.CSSProperties)
              : undefined
          }
        >
          <div className="tst-featured__overlay" />

          <div className="tst-featured__brand">{FEATURED.brand}</div>

          <div className="tst-featured__quote-card">
            <p className="tst-featured__quote">&ldquo;{FEATURED.quote}&rdquo;</p>
            <div className="tst-featured__divider" />
            <div className="tst-featured__author">
              <span className="tst-avatar">
                <Image
                  src={FEATURED.avatar}
                  alt=""
                  width={48}
                  height={48}
                  className="tst-avatar__img"
                />
              </span>
              <span className="tst-author__meta">
                <span className="tst-author__name">{FEATURED.name}</span>
                <span className="tst-author__role">{FEATURED.role}</span>
              </span>
            </div>
          </div>

          <a className="tst-featured__cta" href="#contact">
            <span className="tst-featured__cta-arrow" aria-hidden>
              ↳
            </span>
            Leave a review
          </a>
        </article>

        {/* ── RIGHT: expandable list ── */}
        <ul ref={listRef} className="tst-list">
          {ITEMS.map((t) => {
            const open = openId === t.id;
            return (
              <li
                key={t.id}
                className={`tst-item ${open ? "is-open" : ""}`}
              >
                <button
                  type="button"
                  className="tst-item__toggle"
                  aria-expanded={open}
                  aria-controls={`tst-body-${t.id}`}
                  onClick={() => toggle(t.id)}
                >
                  <span className="tst-item__mark" aria-hidden>
                    {t.brandMark}
                  </span>
                  <span className="tst-item__brand">{t.brand}</span>
                  <span
                    className={`tst-item__plus ${open ? "is-open" : ""}`}
                    aria-hidden
                  >
                    +
                  </span>
                </button>

                <div
                  id={`tst-body-${t.id}`}
                  className="tst-item__body"
                  role="region"
                  aria-hidden={!open}
                >
                  <div className="tst-item__body-inner">
                    <p className="tst-item__quote">&ldquo;{t.quote}&rdquo;</p>
                  </div>
                </div>

                <div className="tst-item__author">
                  <span className="tst-avatar">
                    <Image
                      src={t.avatar}
                      alt=""
                      width={40}
                      height={40}
                      className="tst-avatar__img"
                    />
                  </span>
                  <span className="tst-author__meta">
                    <span className="tst-author__name">{t.name}</span>
                    <span className="tst-author__role">{t.role}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
