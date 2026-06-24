"use client";

import React, { useRef, useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import HeroBlinds from "./HeroBlinds";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import "@/app/styles/hero-banner.css";

gsap.registerPlugin(useGSAP);

interface HeroBannerProps {
  title?: string;
  /** Wordmark rendered inside the glass lens (Hong Kong / Traditional Chinese). */
  titleTranslated?: string;
  titleAccent?: string;
  subtitle?: string;
  /** Subtitle rendered inside the glass lens (Traditional Chinese). */
  subtitleTranslated?: string;
  ctaText?: string;
  ctaTextHover?: string;
  ctaHref?: string;
}

const ROLLING_SENTENCES = [
  "We architect AI automation systems.",
  "We design premium web interfaces.",
  "We optimize organic search rankings.",
  "We build high-converting platforms."
];

// Traditional-Chinese (Hong Kong) counterparts — verify with client.
const ROLLING_SENTENCES_ZH = [
  "我們建構 AI 自動化系統",
  "我們設計頂級網頁介面",
  "我們優化自然搜尋排名",
  "我們打造高轉換率平台"
];

/**
 * Hero banner with floating logos background, glass panel overlay,
 * animated tagline, title, subtitle, and CTA button.
 *
 * Fully responsive: mobile-first with adjusted sizing and reduced animations.
 */
export default function HeroBanner({
  title = "Zuhayr Creative",
  titleTranslated = "祖海爾 創意",
  subtitle = "We create digital experiences that inspire, engage, and deliver real results for your brand.",
  subtitleTranslated = "我們打造啟發人心、引人入勝的數位體驗，為您的品牌帶來實質成果。",
  ctaText = "Explore Our Work",
  ctaTextHover = "Let's Talk",
  ctaHref = "#contact",
}: HeroBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const rollingRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLSpanElement>(null);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [revealed, setRevealed] = useState(false);

  const displaySentences = [...ROLLING_SENTENCES, ROLLING_SENTENCES[0]];
  const displaySentencesZh = [...ROLLING_SENTENCES_ZH, ROLLING_SENTENCES_ZH[0]];

  // Shared roll transform for the eyebrow English + translated layers.
  const rollStyle: React.CSSProperties = {
    transform: `translateY(-${(sentenceIndex * 100) / displaySentences.length}%)`,
    transition: isTransitioning
      ? "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)"
      : "none",
  };

  // Rotation timer for the rolling sentences
  useEffect(() => {
    const timer = setInterval(() => {
      setIsTransitioning(true);
      setSentenceIndex((prev) => prev + 1);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const handleTransitionEnd = () => {
    if (sentenceIndex >= ROLLING_SENTENCES.length) {
      setIsTransitioning(false);
      setSentenceIndex(0);
    }
  };

  // Language lens (monopo-style): a glass circle follows the cursor and reveals
  // each headline block in another language wherever it overlaps. Works on any
  // number of [data-lens-base] / [data-lens-reveal] pairs.
  useEffect(() => {
    if (isTouch) return;
    const section = containerRef.current;
    const glass = glassRef.current;
    if (!section || !glass) return;

    const R = 130; // lens radius (px)
    const bases = Array.from(
      section.querySelectorAll<HTMLElement>("[data-lens-base]"),
    );
    const reveals = Array.from(
      section.querySelectorAll<HTMLElement>("[data-lens-reveal]"),
    );
    const setMask = (el: HTMLElement, value: string) => {
      el.style.webkitMaskImage = value;
      el.style.maskImage = value;
    };
    const circleMask = (radius: number, cx: number, cy: number, inside: boolean) => {
      const stops = inside
        ? `#000 ${radius - 1}px, transparent ${radius}px` // visible inside
        : `transparent ${radius - 1}px, #000 ${radius}px`; // hole inside
      return `radial-gradient(circle ${radius}px at ${cx}px ${cy}px, ${stops})`;
    };
    const HIDDEN = "radial-gradient(circle, transparent, transparent)";

    const LERP = 0.07; // lower = slower, draggier (monopo-style)
    const ZOOM = 1.18; // lens magnification
    let tx = -9999; // target (cursor)
    let ty = -9999;
    let lx = -9999; // smoothed lens position
    let ly = -9999;
    let active = false;
    let raf = 0;

    const hide = () => {
      bases.forEach((b) => setMask(b, "none")); // base fully visible
      reveals.forEach((r) => {
        setMask(r, HIDDEN); // reveal hidden
        r.style.transform = "none";
      });
      glass.style.opacity = "0";
    };

    const render = () => {
      raf = 0;
      lx += (tx - lx) * LERP;
      ly += (ty - ly) * LERP;
      const s = section.getBoundingClientRect();

      // Base: punch a clean hole at the lens (radius R), relative to itself.
      bases.forEach((b) => {
        const r = b.getBoundingClientRect();
        setMask(b, circleMask(R, lx - r.left, ly - r.top, false));
      });

      // Reveal: magnify around the lens centre and clip to R / ZOOM so the
      // visible (scaled) circle still matches the glass ring. Coordinates come
      // from the matching base (unscaled) to avoid transform feedback jitter.
      reveals.forEach((rev, i) => {
        const ref = bases[i] ?? rev;
        const r = ref.getBoundingClientRect();
        const cx = lx - r.left;
        const cy = ly - r.top;
        rev.style.transformOrigin = `${cx}px ${cy}px`;
        rev.style.transform = `scale(${ZOOM})`;
        setMask(rev, circleMask(R / ZOOM, cx, cy, true));
      });

      glass.style.opacity = "1";
      glass.style.transform = `translate(${lx - s.left - R}px, ${ly - s.top - R}px)`;
      if (active) raf = requestAnimationFrame(render);
    };

    const deactivate = () => {
      active = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      hide();
    };

    const onMove = (e: MouseEvent) => {
      const s = section.getBoundingClientRect();
      const inside =
        e.clientX >= s.left &&
        e.clientX <= s.right &&
        e.clientY >= s.top &&
        e.clientY <= s.bottom;
      if (!inside) {
        if (active) deactivate();
        return;
      }
      tx = e.clientX;
      ty = e.clientY;
      if (!active) {
        active = true;
        lx = tx; // appear at the cursor, then trail behind it
        ly = ty;
        if (!raf) raf = requestAnimationFrame(render);
      }
    };

    hide(); // start hidden
    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", deactivate);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", deactivate);
    };
  }, [isTouch]);

  // Wait for the app:reveal signal (fired when the loading screen finishes)
  // so the hero load animation plays together with the navbar reveal.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window as Window & { __appRevealed?: boolean }).__appRevealed
    ) {
      setRevealed(true);
      return;
    }
    const onReveal = () => setRevealed(true);
    window.addEventListener("app:reveal", onReveal);
    return () => window.removeEventListener("app:reveal", onReveal);
  }, []);

  // Entrance load animation — directional to match the layout (eyebrow from the
  // left, subtitle/CTA from the right). Plays once revealed.
  useGSAP(
    () => {
      if (!revealed) return;
      const dur = prefersReducedMotion ? 0.01 : isTouch ? 0.45 : 0.8;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        rollingRef.current,
        { opacity: 0, y: 24, x: -40 },
        { opacity: 1, y: 0, x: 0, duration: dur },
      )
        .fromTo(
          titleRef.current,
          { opacity: 0, y: 50 },
          { opacity: 1, y: 0, duration: dur * 1.2 },
          "-=0.3",
        )
        .fromTo(
          subtitleRef.current,
          { opacity: 0, y: 24, x: 40 },
          { opacity: 1, y: 0, x: 0, duration: dur },
          "-=0.45",
        )
        .fromTo(
          ctaRef.current,
          { opacity: 0, y: 30, x: 40 },
          { opacity: 1, y: 0, x: 0, duration: dur },
          "-=0.4",
        );
    },
    { scope: containerRef, dependencies: [revealed] },
  );

  return (
    <section
      ref={containerRef}
      id="hero-banner"
      className="relative w-full min-h-svh overflow-hidden bg-transparent"
    >
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-[clamp(1.25rem,5vw,8rem)] pt-[clamp(5rem,10vh,8rem)] pb-8 pointer-events-none">
        {/* Eyebrow — rotating tagline with language lens (top-left) */}
        <div
          ref={rollingRef}
          className="self-start text-left opacity-0 translate-y-6 flex items-center gap-3 mb-6 sm:mb-8 pointer-events-auto"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-title-red shrink-0" aria-hidden />
          <div className="relative h-[1.8em]">
            {/* Base (English) — normal flow, sizes the region */}
            <div data-lens-base className="overflow-hidden h-[1.8em]">
              <div
                className="flex flex-col"
                style={rollStyle}
                onTransitionEnd={handleTransitionEnd}
              >
                {displaySentences.map((text, idx) => (
                  <div
                    key={idx}
                    className="h-[1.8em] flex items-center justify-center font-mono text-[clamp(0.65rem,1.1vw,0.85rem)] text-white/80 uppercase font-semibold tracking-[0.25em] whitespace-nowrap"
                  >
                    {text}
                  </div>
                ))}
              </div>
            </div>
            {/* Reveal (Traditional Chinese) — clipped to the lens */}
            <div
              data-lens-reveal
              aria-hidden
              className="lens-reveal absolute inset-0 overflow-hidden h-[1.8em]"
            >
              <div className="flex flex-col" style={rollStyle}>
                {displaySentencesZh.map((text, idx) => (
                  <div
                    key={idx}
                    className="h-[1.8em] flex items-center justify-center text-[clamp(0.7rem,1.2vw,0.9rem)] text-white font-semibold tracking-[0.15em] whitespace-nowrap"
                  >
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Title — stacked wordmark with monopo-style language lens */}
        <div
          ref={titleRef}
          className="relative opacity-0 translate-y-8 sm:translate-y-10 pointer-events-auto"
        >
          {/* Base wordmark (English) */}
          <h1
            data-lens-base
            className="font-anton uppercase text-[clamp(3rem,12vw,9rem)] font-bold leading-[0.9]"
          >
            {title.split(" ").map((word, idx) => (
              <span key={idx} className="block">
                {word}
              </span>
            ))}
          </h1>

          {/* Revealed wordmark (Traditional Chinese) — clipped to the lens */}
          <h1
            data-lens-reveal
            aria-hidden
            className="lens-reveal absolute inset-0 uppercase text-[clamp(3rem,12vw,9rem)] font-bold leading-[0.9]"
          >
            {titleTranslated.split(" ").map((word, idx) => (
              <span key={idx} className="block">
                {word}
              </span>
            ))}
          </h1>
        </div>

        {/* Hairline divider */}
        <span
          className="self-end mt-8 sm:mt-10 h-px w-12 bg-white/25 pointer-events-none"
          aria-hidden
        />

        {/* Subtitle — with language lens (bottom-right) */}
        <div
          ref={subtitleRef}
          className="self-end text-right relative mt-6 sm:mt-7 max-w-[34ch] sm:max-w-[42ch] opacity-0 translate-y-6 pointer-events-auto"
        >
          <p
            data-lens-base
            className="font-sans text-[clamp(0.95rem,1.5vw,1.15rem)] leading-relaxed text-white/70"
          >
            {subtitle}
          </p>
          <p
            data-lens-reveal
            aria-hidden
            className="lens-reveal absolute inset-0 text-[clamp(0.95rem,1.5vw,1.15rem)] leading-relaxed text-white"
          >
            {subtitleTranslated}
          </p>
        </div>

        {/* CTA Button (bottom-right) */}
        <span
          ref={ctaRef}
          className="self-end mt-9 sm:mt-11 pointer-events-auto opacity-0 translate-y-7.5"
        >
          <a
            href={ctaHref}
            className="cta-pill cta-pill--bubble group relative overflow-visible inline-flex items-center justify-center py-3 px-8 sm:py-3.5 sm:px-10 rounded-full font-sans text-sm font-semibold no-underline bg-white touch-target"
          >
            {/* Hover bubble pop layers — non-blocking, behind text */}
            <span className="cta-bubble cta-bubble--1" aria-hidden />
            <span className="cta-bubble cta-bubble--2" aria-hidden />
            <span className="cta-bubble cta-bubble--3" aria-hidden />
            {/* Default label */}
            <span className="cta-text-default relative z-10">{ctaText}</span>
            <span className="cta-text-hover relative z-10">{ctaTextHover}</span>
          </a>
        </span>
      </div>

      {/* Glass lens circle — frosted mirror with a blurry rainbow edge */}
      <div
        ref={glassRef}
        aria-hidden
        className="hero-lens pointer-events-none absolute top-0 left-0 z-30 opacity-0"
      />

      {/* Scroll-driven horizontal blinds overlay (Altrum-style) */}
      <HeroBlinds />
    </section>
  );
}
