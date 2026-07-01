"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import HeroBlinds from "./HeroBlinds";
import HeroBackground from "../HeroBackground";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import "@/app/styles/hero-banner.css";

gsap.registerPlugin(useGSAP);

interface HeroBannerProps {
  title?: string;
  titleAccent?: string;
}

// Cycling noun that completes "Zuhayr Creative is a design-led ___". These
// English strings double as the lookup keys into I18N below.
const HEADLINE_WORDS = ["Collective", "Agency", "House"];

// The headline reads in English by default; the logo-cursor lens reveals both
// "design-led" and the current noun in another language, advancing one step
// each time the lens passes over them: English → Chinese → Japanese → Korean
// → Spanish. Translations are kept short so the logo-shaped lens never clips
// them into a garbled fragment. Verify wording with the client.
const LANGS = ["en", "zh", "ja", "ko", "es"] as const;
type Lang = (typeof LANGS)[number];

// Languages the lens actually reveals. English is deliberately excluded: the
// base text is already English, so revealing it through the lens would look
// like nothing happened. The lens therefore only ever shows a translation.
const REVEAL_LANGS = ["zh", "ja", "ko", "es"] as const;

const I18N: Record<Lang, Record<string, string>> = {
  en: { isA: "is a", designLed: "design-led", Collective: "Collective", Agency: "Agency", House: "House" },
  zh: { isA: "是", designLed: "設計主導", Collective: "集體", Agency: "機構", House: "工作室" },
  ja: { isA: "は", designLed: "デザイン主導", Collective: "コレクティブ", Agency: "エージェンシー", House: "ハウス" },
  ko: { isA: "는", designLed: "디자인 주도", Collective: "컬렉티브", Agency: "에이전시", House: "하우스" },
  es: { isA: "es un", designLed: "de diseño", Collective: "Colectivo", Agency: "Agencia", House: "Casa" },
};

// Cross-platform CJK + Latin stack for the revealed translations, so JP/KR/ZH
// all render (overrides the Traditional-Chinese-only stack in .lens-reveal).
// Only applied to non-English reveals so the English pass keeps the base font.
const I18N_FONT_STACK =
  '"Hiragino Sans", "Yu Gothic", "Meiryo", "Malgun Gothic", "Apple SD Gothic Neo", "Microsoft JhengHei", "Noto Sans CJK", sans-serif';

// Type tokens for the three left-aligned headline lines:
//   1 = "Zuhayr Creative" (large)   2 = "is a design-led" (small, carries the
//   lens)   3 = cycling noun (medium). Line 1 is nowrap-sized to stay on one
//   line down to ~320px so the headline is always exactly three lines.
const LINE2_TYPE =
  "font-mono font-light tracking-[0.1em] text-[clamp(0.72rem,1.5vw,1rem)]";
const LINE3_TYPE =
  "font-mono font-bold uppercase leading-[1.1] text-[clamp(1.65rem,4.8vw,3.6rem)]";

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
  const rollingRef = useRef<HTMLAnchorElement>(null);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();
  const [wordIndex, setWordIndex] = useState(0);
  const [wordTransitioning, setWordTransitioning] = useState(true);
  const [langIndex, setLangIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const displayWords = [...HEADLINE_WORDS, HEADLINE_WORDS[0]];

  // Roll transform for the cycling headline noun (Collective / Agency / House).
  const wordRollStyle: React.CSSProperties = {
    transform: `translateY(-${(wordIndex * 100) / displayWords.length}%)`,
    transition: wordTransitioning
      ? "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)"
      : "none",
  };

  // Rotation timer for the cycling headline noun. Paused while the tab is
  // hidden: a backgrounded tab throttles both setInterval and CSS transitions,
  // so the roller could otherwise advance without its transitionend firing —
  // leaving it parked past the last word (a blank slot) until you return.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return; // don't advance while backgrounded
      setWordTransitioning(true);
      setWordIndex((prev) => prev + 1);
    }, 3200);

    // On return, snap to a clean in-range word instantly (no transition) so a
    // throttled/stuck background transition can't leave a blank slot showing.
    const onVisibility = () => {
      if (document.hidden) return;
      setWordTransitioning(false);
      setWordIndex((prev) => prev % HEADLINE_WORDS.length);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const handleWordTransitionEnd = () => {
    if (wordIndex >= HEADLINE_WORDS.length) {
      setWordTransitioning(false);
      setWordIndex(0);
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
    const setCursorHidden = (hidden: boolean) => {
      console.log(`[HeroBanner] setCursorHidden(${hidden}) — classes before: "${cursorEl?.className}"`);
      cursorEl?.classList.toggle("hide-cursor", hidden);
    };
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
      let anyReveal = false;
      reveals.forEach((rev, i) => {
        const ref = bases[i] ?? rev;
        const r = ref.getBoundingClientRect();
        if (!overlaps(r)) return clearReveal(rev);
        rev.dataset.lensOn = "1";
        anyReveal = true;
        applyReveal(rev, lx - r.left, ly - r.top);
      });

      glass.style.opacity = "1";
      glass.style.transform = `translate(${lx - s.left - half}px, ${ly - s.top - half}px)`;
      return anyReveal;
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

    // Pause the RAF entirely when the hero section is not in the viewport —
    // saves ~60 style-mutation calls/sec while the user is below the fold.
    let heroVisible = true;
    const visIO = new IntersectionObserver(
      ([entry]) => {
        heroVisible = entry.isIntersecting;
        if (heroVisible && raf === 0) raf = requestAnimationFrame(tick);
      },
      { threshold: 0 },
    );
    visIO.observe(section);

    // Persistent loop — re-checks every frame, so it reacts to scrolling (the
    // section sliding under a still cursor) as well as mouse movement.
    let cursorHidden = false;
    let revealActivePrev = false;
    let prevLensOn: boolean | null = null;
    let prevOverHero: boolean | null = null;
    let prevIsIdle: boolean | null = null;
    const tick = () => {
      // Completely stop ticking while hero is off-screen.
      if (!heroVisible) { raf = 0; return; }
      const s = section.getBoundingClientRect();
      const overHero =
        lastX >= s.left &&
        lastX <= s.right &&
        lastY >= s.top &&
        lastY <= s.bottom;
      const menuOpen = document.body.classList.contains("menu-open");
      const isIdle = document.body.classList.contains("is-idle");
      // The glass lens runs only over the hero, away from the navbar, with the
      // menu closed. Everywhere else the normal cursor logo is shown instead.
      const lensOn = overHero && !menuOpen && !nearNavbar() && !isIdle;
      // Only log on state change — avoids 60 lines/sec of noise
      if (lensOn !== prevLensOn || overHero !== prevOverHero || isIdle !== prevIsIdle) {
        console.log(`[HeroBanner/tick] overHero=${overHero} isIdle=${isIdle} lensOn=${lensOn} pos=(${Math.round(lastX)},${Math.round(lastY)})`);
        prevLensOn = lensOn; prevOverHero = overHero; prevIsIdle = isIdle;
      }

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

      let anyReveal = false;
      if (active) {
        lx += (lastX - lx) * LERP;
        ly += (lastY - ly) * LERP;
        anyReveal = drawLens(s);
      }
      // Advance the revealed language one step each time the lens leaves the
      // headline (falling edge): each pass shows the next language, and the
      // first pass still shows English (the resting default).
      if (!anyReveal && revealActivePrev) {
        setLangIndex((i) => (i + 1) % REVEAL_LANGS.length);
      }
      revealActivePrev = anyReveal;
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
    };
    // Cursor left the window entirely — treat as outside the hero.
    // We validate the coordinates because Chrome fires spurious document.mouseleave
    // events when CSS transitions occur on visible elements (e.g. the glass lens
    // appearing/repositioning). If clientX/Y are still inside the viewport the
    // event is bogus and should be ignored — otherwise the cursor flickers.
    const onLeave = (e: MouseEvent) => {
      const inside =
        e.clientX >= 0 &&
        e.clientY >= 0 &&
        e.clientX <= window.innerWidth &&
        e.clientY <= window.innerHeight;
      if (inside) {
        console.log(`[HeroBanner] Ignoring spurious document.mouseleave — cursor still at (${Math.round(e.clientX)},${Math.round(e.clientY)}) inside viewport`);
        return;
      }
      console.log(`[HeroBanner] Real document.mouseleave at (${Math.round(e.clientX)},${Math.round(e.clientY)}) — resetting to -9999`);
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
      visIO.disconnect();
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

      // When we arrive from the loading screen, the logo has already flown into
      // place (the loader Flip-fits its copy onto this one), so the headline
      // simply snaps in at rest — no rise that would fight the hand-off. The
      // eyebrow tagline still drifts in for life.
      const fromLoader = (window as Window & { __fromLoader?: boolean })
        .__fromLoader;
      // Consume the flag so later client navigations keep their rise-in.
      (window as Window & { __fromLoader?: boolean }).__fromLoader = false;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (fromLoader) {
        tl.set(titleRef.current, { opacity: 1, y: 0 });
      } else {
        tl.fromTo(
          titleRef.current,
          { opacity: 0, y: 50 },
          { opacity: 1, y: 0, duration: dur * 1.2 },
        );
      }

      tl.fromTo(
        rollingRef.current,
        { opacity: 0, y: 24, x: 40 },
        { opacity: 1, y: 0, x: 0, duration: dur },
        fromLoader ? "+=0.1" : "-=0.45",
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
      {/* Hero-only experimental WebGL background. Sits behind the content
          (z-0) and cross-fades into the shared page background at the bottom
          seam (services). Every other section keeps the shared background. */}
      <HeroBackground />

      <div className="absolute inset-0 z-10 flex flex-col items-start justify-center text-left px-[clamp(1.25rem,5vw,8rem)] pt-[clamp(5rem,10vh,8rem)] pb-[clamp(2rem,5vh,4rem)] pointer-events-none">
        {/* Headline — left-aligned, three lines:
              1) Zuhayr Creative
              2) is a design-led   ("design-led" carries the logo-cursor lens)
              3) cycling noun (Collective / Agency / House) */}
        <div
          ref={titleRef}
          data-hero-title
          className="opacity-0 translate-y-8 sm:translate-y-10 pointer-events-auto flex flex-col items-start gap-[clamp(0.4rem,1.4vh,1.1rem)]"
        >
          {/* Line 1 — Zuhayr Creative logo lockup (replaces the text wordmark).
              data-hero-logo is the Flip target the loading screen flies into. */}
          <h1 className="sr-only">{title}</h1>
          <Image
            src="/ZEALTH-11-trimmed.png"
            alt={title}
            width={1318}
            height={342}
            priority
            data-hero-logo
            className="block w-[clamp(15rem,42vw,34rem)] h-auto"
          />
          {/* design-led tagline lines follow */}

          {/* Line 2 — is a design-led. Pushed right of the logo's left edge —
              breaks the flush-left stack into an asymmetric stagger. */}
          <div
            className={`${LINE2_TYPE} flex items-baseline gap-[0.5em] ml-0`}
          >
            {/* "is a" — also carries the lens reveal (short forms per language) */}
            <span className="relative inline-block text-white/50">
              {/* Base (English) — always visible, sizes the slot */}
              <span data-lens-base className="inline-block whitespace-nowrap">
                {I18N.en.isA}
              </span>
              {/* Reveal — translated, clipped to the lens */}
              <span
                data-lens-reveal
                aria-hidden
                lang={REVEAL_LANGS[langIndex]}
                style={{
                  fontFamily: I18N_FONT_STACK,
                }}
                className="lens-reveal absolute inset-0 whitespace-nowrap"
              >
                {I18N[REVEAL_LANGS[langIndex]].isA}
              </span>
            </span>
            <span className="relative inline-block">
              {/* Base (English) — always visible, sizes the slot */}
              <span data-lens-base className="inline-block whitespace-nowrap">
                {I18N.en.designLed}
              </span>
              {/* Reveal — translated word, clipped to the lens */}
              <span
                data-lens-reveal
                aria-hidden
                lang={REVEAL_LANGS[langIndex]}
                style={{
                  fontFamily: I18N_FONT_STACK,
                }}
                className="lens-reveal absolute inset-0 whitespace-nowrap"
              >
                {I18N[REVEAL_LANGS[langIndex]].designLed}
              </span>
            </span>
          </div>

          {/* Line 3 — cycling noun. Pulled back to a smaller offset than line 2
              (not flush with the logo either) so the three lines zigzag
              instead of forming a straight left edge. */}
          <div
            className={`${LINE3_TYPE} overflow-hidden h-[1.1em] ml-[clamp(4rem,14vw,11rem)]`}
          >
            <div
              className="flex flex-col"
              style={wordRollStyle}
              onTransitionEnd={handleWordTransitionEnd}
            >
              {displayWords.map((word, idx) => (
                <span
                  key={idx}
                  className="relative h-[1.1em] flex items-center whitespace-nowrap"
                >
                  {/* Base (English) — always visible, sizes the slot */}
                  <span data-lens-base className="inline-block">
                    {word}
                  </span>
                  {/* Reveal — current noun translated, clipped to the lens */}
                  <span
                    data-lens-reveal
                    aria-hidden
                    lang={REVEAL_LANGS[langIndex]}
                    style={{
                      fontFamily: I18N_FONT_STACK,
                    }}
                    className="lens-reveal absolute inset-0 flex items-center whitespace-nowrap"
                  >
                    {I18N[REVEAL_LANGS[langIndex]][word]}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Let's Talk — CTA pinned bottom-right, links to the contact page.
            On hover: the dot grows, the label rolls, the arrow nudges, and a
            line pops out along the bottom. An always-visible "Accepting new
            projects" badge floats above it, bouncing with a flashing dot. */}
        <Link
          ref={rollingRef}
          href="/contact"
          aria-label="Let's talk — we're accepting new projects"
          className="group absolute right-[clamp(1.25rem,5vw,8rem)] bottom-[clamp(2rem,5vh,4rem)] opacity-0 translate-y-6 inline-flex items-center gap-2.5 pointer-events-auto font-tomato font-medium text-[clamp(0.7rem,1.1vw,0.9rem)] uppercase tracking-[0.22em] text-white"
        >
          {/* Accepting new projects badge — always visible, bouncing, above the link */}
          <span
            aria-hidden
            className="pointer-events-none absolute right-0 bottom-full mb-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-[#0e0e0e]/90 px-2.5 py-1.5 text-[0.65rem] font-medium normal-case tracking-normal text-white/85 shadow-[0_4px_16px_rgba(0,0,0,0.45)] backdrop-blur-md animate-bounce"
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#C4010D] opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C4010D] animate-pulse" />
            </span>
            Accepting new projects
          </span>
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-title-red shrink-0 transition-transform duration-300 ease-out group-hover:scale-150"
          />
          <span className="relative inline-block pb-1">
            {/* Rolling label — default slides up & out, hover layer slides up
                from below to take its place. */}
            <span className="relative inline-block h-[1.1em] overflow-hidden align-bottom">
              <span className="block leading-[1.1em] transition-transform duration-[400ms] ease-out group-hover:-translate-y-full">
                Let&apos;s Talk
              </span>
              <span
                aria-hidden
                className="absolute inset-0 block leading-[1.1em] translate-y-full transition-transform duration-[400ms] ease-out group-hover:translate-y-0"
              >
                Let&apos;s Talk
              </span>
            </span>
            {/* Line pops out along the bottom on hover */}
            <span
              aria-hidden
              className="absolute left-0 bottom-0 h-px w-full origin-left scale-x-0 bg-title-red transition-transform duration-300 ease-out group-hover:scale-x-100"
            />
          </span>
          <span
            aria-hidden
            className="transition-transform duration-300 ease-out group-hover:translate-x-1"
          >
            &rarr;
          </span>
        </Link>
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
