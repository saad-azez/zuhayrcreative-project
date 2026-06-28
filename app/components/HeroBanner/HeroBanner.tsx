"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import HeroBlinds from "./HeroBlinds";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import "@/app/styles/hero-banner.css";

gsap.registerPlugin(useGSAP);

interface HeroBannerProps {
  title?: string;
  titleAccent?: string;
}

const ROLLING_SENTENCES = [
  "We architect AI automation systems.",
  "We design premium web interfaces.",
  "We optimize organic search rankings.",
  "We build high-converting platforms."
];

// Cycling noun that completes "Zuhayr Creative is a design-led ___".
const HEADLINE_WORDS = ["Collective", "Agency", "House"];

// "design-led" shows in English by default; the logo-cursor lens reveals it in
// another language on each pass. English is intentionally NOT in this cycle
// (it's already the default), and the Spanish is kept short so the lens never
// clips it into a garbled fragment. Verify wording with the client.
const DESIGN_LED_EN = "design-led";
const DESIGN_LED_I18N = [
  { lang: "zh", word: "設計主導" },
  { lang: "ja", word: "デザイン主導" },
  { lang: "ko", word: "디자인 주도" },
  { lang: "es", word: "de diseño" },
];

// Cross-platform CJK + Latin stack for the revealed translations, so JP/KR/ZH
// all render (overrides the Traditional-Chinese-only stack in .lens-reveal).
const I18N_FONT_STACK =
  '"Hiragino Sans", "Yu Gothic", "Meiryo", "Malgun Gothic", "Apple SD Gothic Neo", "Microsoft JhengHei", "Noto Sans CJK", sans-serif';

// Type tokens for the three left-aligned headline lines:
//   1 = "Zuhayr Creative" (large)   2 = "is a design-led" (small, carries the
//   lens)   3 = cycling noun (medium). Line 1 is nowrap-sized to stay on one
//   line down to ~320px so the headline is always exactly three lines.
const LINE2_TYPE =
  "font-mono uppercase font-semibold tracking-[0.14em] text-[clamp(1.05rem,2.7vw,2rem)]";
const LINE3_TYPE =
  "font-anton uppercase font-bold leading-[1.1] text-[clamp(1.85rem,5.5vw,4rem)]";

/**
 * Hero banner with WebGL background, glass logo-cursor lens, animated tagline,
 * and a left-aligned three-line headline.
 *
 * Fully responsive: mobile-first with adjusted sizing and reduced animations.
 */
export default function HeroBanner({
  title = "Zuhayr Creative",
}: HeroBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const rollingRef = useRef<HTMLDivElement>(null);
  const langRevealRef = useRef<HTMLDivElement>(null);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [wordIndex, setWordIndex] = useState(0);
  const [wordTransitioning, setWordTransitioning] = useState(true);
  const [langIndex, setLangIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const displaySentences = [...ROLLING_SENTENCES, ROLLING_SENTENCES[0]];
  const displayWords = [...HEADLINE_WORDS, HEADLINE_WORDS[0]];

  // Shared roll transform for the eyebrow rolling tagline.
  const rollStyle: React.CSSProperties = {
    transform: `translateY(-${(sentenceIndex * 100) / displaySentences.length}%)`,
    transition: isTransitioning
      ? "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)"
      : "none",
  };

  // Roll transform for the cycling headline noun (Collective / Agency / House).
  const wordRollStyle: React.CSSProperties = {
    transform: `translateY(-${(wordIndex * 100) / displayWords.length}%)`,
    transition: wordTransitioning
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

  // Rotation timer for the cycling headline noun
  useEffect(() => {
    const timer = setInterval(() => {
      setWordTransitioning(true);
      setWordIndex((prev) => prev + 1);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  // Advance the revealed language one step each time the logo-cursor lens
  // enters the "design-led" word. The lens toggles [data-lens-on] on the
  // reveal element imperatively; we watch the 0 → 1 transition (it re-asserts
  // "1" every frame while hovered, so we only act on the leading edge).
  useEffect(() => {
    const el = langRevealRef.current;
    if (!el) return;
    let prev = el.getAttribute("data-lens-on");
    const obs = new MutationObserver(() => {
      const now = el.getAttribute("data-lens-on");
      if (now === "1" && prev !== "1") {
        setLangIndex((i) => (i + 1) % DESIGN_LED_I18N.length);
      }
      prev = now;
    });
    obs.observe(el, { attributes: true, attributeFilter: ["data-lens-on"] });
    return () => obs.disconnect();
  }, []);

  const handleWordTransitionEnd = () => {
    if (wordIndex >= HEADLINE_WORDS.length) {
      setWordTransitioning(false);
      setWordIndex(0);
    }
  };

  const handleTransitionEnd = () => {
    if (sentenceIndex >= ROLLING_SENTENCES.length) {
      setIsTransitioning(false);
      setSentenceIndex(0);
    }
  };

  // Language lens (monopo-style): a glass circle follows the pointer and
  // reveals the "design-led" word in another language wherever it overlaps.
  // Driven by mouse on desktop and by touch (finger drag) on phone/tablet.
  useEffect(() => {
    const section = containerRef.current;
    const glass = glassRef.current;
    if (!section || !glass) return;

    const LOGO = "/AI-9-cursor.png"; // brand logo silhouette = lens shape
    const LENS = 260; // on-screen lens size (px) — matches .hero-lens
    const half = LENS / 2;

    // The global cursor-logo follower is hidden over the hero — the glass
    // logo lens replaces it here. It stays visible in every other section.
    const cursorEl = document.querySelector<HTMLElement>(".gallery-cursor");
    const setCursorHidden = (hidden: boolean) =>
      cursorEl?.classList.toggle("hide-cursor", hidden);
    const bases = Array.from(
      section.querySelectorAll<HTMLElement>("[data-lens-base]"),
    );
    const reveals = Array.from(
      section.querySelectorAll<HTMLElement>("[data-lens-reveal]"),
    );

    const LERP = 0.07; // lower = slower, draggier (monopo-style)
    const ZOOM = 1.18; // lens magnification

    // Apply / clear the logo-shaped masks per element.
    const applyHole = (b: HTMLElement, px: number, py: number) => {
      b.style.webkitMaskImage = `url(${LOGO}), linear-gradient(#000, #000)`;
      b.style.maskImage = `url(${LOGO}), linear-gradient(#000, #000)`;
      b.style.webkitMaskRepeat = "no-repeat, no-repeat";
      b.style.maskRepeat = "no-repeat, no-repeat";
      b.style.webkitMaskSize = `${LENS}px ${LENS}px, 100% 100%`;
      b.style.maskSize = `${LENS}px ${LENS}px, 100% 100%`;
      b.style.webkitMaskPosition = `${px}px ${py}px, 0 0`;
      b.style.maskPosition = `${px}px ${py}px, 0 0`;
      b.style.webkitMaskComposite = "xor";
      b.style.maskComposite = "exclude";
    };
    const clearHole = (b: HTMLElement) => {
      if (b.dataset.lensOn === "0") return;
      b.dataset.lensOn = "0";
      b.style.webkitMaskImage = "none";
      b.style.maskImage = "none";
    };
    const applyReveal = (r: HTMLElement, cx: number, cy: number) => {
      const sz = LENS / ZOOM;
      r.style.transformOrigin = `${cx}px ${cy}px`;
      r.style.transform = `scale(${ZOOM})`;
      r.style.webkitMaskImage = `url(${LOGO})`;
      r.style.maskImage = `url(${LOGO})`;
      r.style.webkitMaskRepeat = "no-repeat";
      r.style.maskRepeat = "no-repeat";
      r.style.webkitMaskSize = `${sz}px ${sz}px`;
      r.style.maskSize = `${sz}px ${sz}px`;
      r.style.webkitMaskPosition = `${cx - sz / 2}px ${cy - sz / 2}px`;
      r.style.maskPosition = `${cx - sz / 2}px ${cy - sz / 2}px`;
      r.style.webkitMaskComposite = "source-over";
      r.style.maskComposite = "add";
    };
    const clearReveal = (r: HTMLElement) => {
      if (r.dataset.lensOn === "0") return;
      r.dataset.lensOn = "0";
      r.style.webkitMaskImage = "linear-gradient(transparent, transparent)";
      r.style.maskImage = "linear-gradient(transparent, transparent)";
      r.style.transform = "none";
    };
    let lastX = -9999; // latest cursor position (viewport)
    let lastY = -9999;
    let lx = -9999; // smoothed lens position
    let ly = -9999;
    let active = false;
    let raf = 0;

    const hide = () => {
      bases.forEach((b) => {
        b.dataset.lensOn = "0";
        b.style.webkitMaskImage = "none"; // base fully visible
        b.style.maskImage = "none";
      });
      reveals.forEach((r) => {
        r.dataset.lensOn = "0";
        r.style.webkitMaskImage = "linear-gradient(transparent, transparent)";
        r.style.maskImage = "linear-gradient(transparent, transparent)"; // hidden
        r.style.transform = "none";
      });
      glass.style.opacity = "0";
    };

    const drawLens = (s: DOMRect) => {
      // Only touch an element when the lens box actually overlaps it; every
      // other element is explicitly cleared so no stray logo shape can appear
      // on, say, the tall centred title while the cursor is near the edges.
      const overlaps = (r: DOMRect) =>
        lx + half > r.left &&
        lx - half < r.right &&
        ly + half > r.top &&
        ly - half < r.bottom;

      // Base: punch a logo-shaped hole where the lens overlaps.
      bases.forEach((b) => {
        const r = b.getBoundingClientRect();
        if (!overlaps(r)) return clearHole(b);
        b.dataset.lensOn = "1";
        applyHole(b, lx - r.left - half, ly - r.top - half);
      });

      // Reveal: magnify around the lens centre. Coordinates come from the
      // matching base (unscaled) to avoid transform-feedback jitter.
      reveals.forEach((rev, i) => {
        const ref = bases[i] ?? rev;
        const r = ref.getBoundingClientRect();
        if (!overlaps(r)) return clearReveal(rev);
        rev.dataset.lensOn = "1";
        applyReveal(rev, lx - r.left, ly - r.top);
      });

      glass.style.opacity = "1";
      glass.style.transform = `translate(${lx - s.left - half}px, ${ly - s.top - half}px)`;
    };

    // Is the cursor near the navbar toggle? Near it we hide the big glass
    // lens and show the small cursor logo so you can aim at the menu button.
    let navNode = document.querySelector<HTMLElement>("[data-nav-toggle]");
    const NAV_MARGIN = 48; // px proximity around the navbar toggle
    const nearNavbar = () => {
      if (!navNode || !navNode.isConnected)
        navNode = document.querySelector<HTMLElement>("[data-nav-toggle]");
      if (!navNode) return false;
      const r = navNode.getBoundingClientRect();
      return (
        lastX >= r.left - NAV_MARGIN &&
        lastX <= r.right + NAV_MARGIN &&
        lastY >= r.top - NAV_MARGIN &&
        lastY <= r.bottom + NAV_MARGIN
      );
    };

    // Persistent loop — re-checks every frame, so it reacts to scrolling (the
    // section sliding under a still cursor) as well as mouse movement.
    let cursorHidden = false;
    const tick = () => {
      const s = section.getBoundingClientRect();
      const overHero =
        lastX >= s.left &&
        lastX <= s.right &&
        lastY >= s.top &&
        lastY <= s.bottom;
      const menuOpen = document.body.classList.contains("menu-open");
      // The glass lens runs only over the hero, away from the navbar, with the
      // menu closed. Everywhere else the normal cursor logo is shown instead.
      const lensOn = overHero && !menuOpen && !nearNavbar();

      if (lensOn && !active) {
        active = true;
        lx = lastX; // appear at the cursor, then trail behind it
        ly = lastY;
      } else if (!lensOn && active) {
        active = false;
        hide();
      }

      // Hide the cursor logo only while the glass lens is actually showing.
      if (cursorHidden !== active) {
        cursorHidden = active;
        setCursorHidden(active);
      }

      if (active) {
        lx += (lastX - lx) * LERP;
        ly += (lastY - ly) * LERP;
        drawLens(s);
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
    };
    // Cursor left the window entirely — treat as outside the hero.
    const onLeave = () => {
      lastX = -9999;
      lastY = -9999;
    };
    // Touch: the lens follows the finger while it's down (no hover state on
    // mobile), then hides on release.
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      lastX = t.clientX;
      lastY = t.clientY;
    };
    const onTouchEnd = () => {
      lastX = -9999;
      lastY = -9999;
    };

    hide(); // start hidden
    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      setCursorHidden(false); // never leave it hidden if the hero unmounts
    };
  }, []);

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

  // Entrance load animation — the left headline rises in, the bottom-right
  // tagline drifts in from the right. Plays once revealed.
  useGSAP(
    () => {
      if (!revealed) return;
      const dur = prefersReducedMotion ? 0.01 : isTouch ? 0.45 : 0.8;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        titleRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: dur * 1.2 },
      ).fromTo(
        rollingRef.current,
        { opacity: 0, y: 24, x: 40 },
        { opacity: 1, y: 0, x: 0, duration: dur },
        "-=0.45",
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
      <div className="absolute inset-0 z-10 flex flex-col items-start justify-center text-left px-[clamp(1.25rem,5vw,8rem)] pt-[clamp(5rem,10vh,8rem)] pb-[clamp(2rem,5vh,4rem)] pointer-events-none">
        {/* Headline — left-aligned, three lines:
              1) Zuhayr Creative
              2) is a design-led   ("design-led" carries the logo-cursor lens)
              3) cycling noun (Collective / Agency / House) */}
        <div
          ref={titleRef}
          className="opacity-0 translate-y-8 sm:translate-y-10 pointer-events-auto flex flex-col items-start gap-[clamp(0.4rem,1.4vh,1.1rem)]"
        >
          {/* Line 1 — Zuhayr Creative logo lockup (replaces the text wordmark) */}
          <h1 className="sr-only">{title}</h1>
          <Image
            src="/ZEALTH-11-trimmed.png"
            alt={title}
            width={1318}
            height={342}
            priority
            className="block w-[clamp(15rem,42vw,34rem)] h-auto"
          />
          {/* design-led tagline lines follow */}

          {/* Line 2 — is a design-led */}
          <div className={`${LINE2_TYPE} flex items-baseline gap-[0.5em]`}>
            <span className="text-white/80">is a</span>
            <span className="relative inline-block">
              {/* Base (English) — always visible, sizes the slot */}
              <span data-lens-base className="inline-block whitespace-nowrap">
                {DESIGN_LED_EN}
              </span>
              {/* Reveal — translated word, clipped to the lens */}
              <span
                ref={langRevealRef}
                data-lens-reveal
                aria-hidden
                lang={DESIGN_LED_I18N[langIndex].lang}
                style={{ fontFamily: I18N_FONT_STACK }}
                className="lens-reveal absolute inset-0 whitespace-nowrap"
              >
                {DESIGN_LED_I18N[langIndex].word}
              </span>
            </span>
          </div>

          {/* Line 3 — cycling noun (Collective / Agency / House) */}
          <div className={`${LINE3_TYPE} overflow-hidden h-[1.1em]`}>
            <div
              className="flex flex-col"
              style={wordRollStyle}
              onTransitionEnd={handleWordTransitionEnd}
            >
              {displayWords.map((word, idx) => (
                <span
                  key={idx}
                  className="h-[1.1em] flex items-center whitespace-nowrap"
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Eyebrow — rotating tagline, pinned bottom-right */}
        <div
          ref={rollingRef}
          className="absolute right-[clamp(1.25rem,5vw,8rem)] bottom-[clamp(2rem,5vh,4rem)] opacity-0 translate-y-6 flex items-center gap-3 pointer-events-auto"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-title-red shrink-0" aria-hidden />
          <div className="overflow-hidden h-[1.8em]">
            <div
              className="flex flex-col"
              style={rollStyle}
              onTransitionEnd={handleTransitionEnd}
            >
              {displaySentences.map((text, idx) => (
                <div
                  key={idx}
                  className="h-[1.8em] flex items-center justify-end font-mono text-[clamp(0.65rem,1.1vw,0.85rem)] text-white/80 uppercase font-semibold tracking-[0.25em] whitespace-nowrap"
                >
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Glass lens — liquid glass in the brand logo (Z) silhouette */}
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
