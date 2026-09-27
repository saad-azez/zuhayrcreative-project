"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import HeroBlinds from "./HeroBlinds";
import HeroBackground from "../HeroBackground";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import "@/app/styles/hero-banner.css";

gsap.registerPlugin(useGSAP, SplitText);

/**
 * Hero entrance, after the text-reveal sketch: every character starts pushed
 * right, transparent and skewed, then slides back to rest — staggered by its
 * position IN ITS OWN LINE, so each line wipes in left-to-right in parallel
 * rather than the whole block running as one long queue.
 */
const REVEAL = { x: 100, skewX: 20, duration: 0.65, stagger: 0.035 };

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

// Every reveal, in every language, is set in this one face — a subsetted Noto
// Sans KR shipped with the site (registered in layout.tsx, files and rationale
// in app/fonts/noto-sans-kr). It covers Han, kana, Hangul AND Latin, which no
// system font does: left to system fonts the lens changed typeface depending on
// the language, Chinese was drawn by a Japanese face, and one Korean string was
// split across two fonts. It also overrides the Traditional-Chinese-only stack
// in .lens-reveal.
//
// NOTE the font is cut down to exactly the characters the strings below use —
// adding a character to I18N means regenerating it, or that character falls
// back to a system font. The README has the command.
const REVEAL_FONT = "var(--font-reveal)";

// Type tokens for the three left-aligned headline lines:
//   1 = "Zuhayr Creative" (large)   2 = "is a design-led" (small, carries the
//   lens)   3 = cycling noun (medium). Line 1 is nowrap-sized to stay on one
//   line down to ~320px so the headline is always exactly three lines.
//
// Lines 2 + 3 are set in Helvetica Neue per client direction (reference:
// Swiss-style sans, sentence case, near-normal tracking). Helvetica Neue is
// a system font on Apple devices; Helvetica/Arial cover the rest.
// Façade, the site display face. (Was Helvetica Neue per an earlier client
// direction.) The CJK glyphs on line 1 keep their own stack in hero-banner.css —
// Façade is Latin-only and would tofu them.
const HERO_SANS = "var(--font-display)";

const LINE2_TYPE =
  "font-normal tracking-[0.01em] text-white text-[clamp(1.2rem,2.9vw,2rem)]";
const LINE3_TYPE =
  "font-bold uppercase leading-[1.25] text-[clamp(1.65rem,4.8vw,3.6rem)]";

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
  // The character split of line 2, kept so it can be reverted — the cursor lens
  // measures these spans and must get plain text back.
  const splitRef = useRef<SplitText | null>(null);
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
      cursorEl?.classList.toggle("hide-cursor", hidden);
    };

    // The water cursor is silenced over the hero for the same reason the
    // cursor logo is: this section already has a pointer effect. The glass
    // lens IS the hero's cursor — a logo-shaped hole that drags the brand
    // silhouette across the headline — and a ripple wake tracking the same
    // pointer underneath it put two cursor-followers on one section, both
    // pulling at the mask's edge.
    //
    // Published as a body class rather than wired component-to-component:
    // FluidCursor is a fixed, full-page layer mounted from the template and
    // has no idea what is under it, and this tick already owns the one
    // correct answer to "is the pointer over the hero" — it re-derives it
    // every frame, so it stays right when the SECTION moves under a still
    // cursor, which a pointerenter/leave pair would miss entirely. Body
    // classes are how `menu-open` and `is-idle` already reach this file.
    const setFluidQuiet = (quiet: boolean) => {
      document.body.classList.toggle("fluid-quiet", quiet);
    };
    const bases = Array.from(
      section.querySelectorAll<HTMLElement>("[data-lens-base]"),
    );
    const reveals = Array.from(
      section.querySelectorAll<HTMLElement>("[data-lens-reveal]"),
    );

    const LERP = 0.07; // lower = slower, draggier (monopo-style)
    const ZOOM = 1.18; // lens magnification

    // Sit each revealed word on the baseline of the English word it covers.
    // The two are set in different faces (Façade vs REVEAL_FONT) and a font's
    // baseline position inside a given line box depends on its own ascent and
    // descent — the reveal font's taller ascent put the translation ~3px low on
    // line 2 and ~6px low on line 3, so the lens showed the base word with the
    // translation peeking out below it. Derive the difference from the fonts'
    // metrics rather than hard-coding it, so it stays correct if either face or
    // the type scale changes. `.lens-reveal__ink` applies it to the glyphs only,
    // leaving the masked element (and therefore the lens hole) where it is.
    const alignBaselines = () => {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return;
      // Baseline offset within a line box = half-leading + ascent.
      const baselineIn = (font: string, lineBox: number) => {
        ctx.font = font;
        const m = ctx.measureText("Hxg");
        const ascent = m.fontBoundingBoxAscent;
        const descent = m.fontBoundingBoxDescent;
        return (lineBox - (ascent + descent)) / 2 + ascent;
      };
      bases.forEach((base, i) => {
        const rev = reveals[i];
        if (!rev) return;
        const cb = getComputedStyle(base);
        const cr = getComputedStyle(rev);
        const lineBox = parseFloat(cb.lineHeight);
        if (!Number.isFinite(lineBox)) return;
        const shift =
          baselineIn(`${cb.fontSize} ${cb.fontFamily}`, lineBox) -
          baselineIn(`${cr.fontSize} ${cr.fontFamily}`, lineBox);
        rev.style.setProperty("--reveal-baseline-shift", `${shift.toFixed(2)}px`);
      });
    };
    alignBaselines();
    // Re-measure once the webfonts are in (metrics come from the fallback until
    // then) and whenever the viewport resizes the clamp()-driven type.
    document.fonts?.ready.then(alignBaselines);
    window.addEventListener("resize", alignBaselines);

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
    // The toggle is fixed: its box only moves on resize. Read once, not
    // every frame — every read here was a forced layout while the page was
    // being restyled by animations, and on a phone that was most of a frame.
    let navRect: DOMRect | null = null;
    const nearNavbar = () => {
      if (!navNode || !navNode.isConnected) {
        navNode = document.querySelector<HTMLElement>("[data-nav-toggle]");
        navRect = null;
      }
      if (!navNode) return false;
      if (!navRect) navRect = navNode.getBoundingClientRect();
      const r = navRect;
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
        // Scrolled past the hero: the tick is about to stop, so release the
        // water here. Leaving the flag set would silence the cursor for the
        // rest of the page — the tick that would have cleared it is the very
        // thing that just shut down.
        if (!heroVisible) setFluidQuiet(false);
        if (heroVisible && raf === 0) raf = requestAnimationFrame(tick);
      },
      { threshold: 0 },
    );
    visIO.observe(section);

    // Persistent loop — re-checks every frame, so it reacts to scrolling (the
    // section sliding under a still cursor) as well as mouse movement.
    let cursorHidden = false;
    let fluidQuiet = false;
    let revealActivePrev = false;
    // The section's box, re-read only when the page has scrolled or resized
    // since — the two things that move it. The lens's own rects are read
    // only while the lens is drawing.
    let sectionRect: DOMRect | null = null;
    let rectScrollY = -1;
    let rectW = 0;
    let rectH = 0;
    const sectionBox = () => {
      const sy = window.scrollY;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!sectionRect || sy !== rectScrollY || w !== rectW || h !== rectH) {
        sectionRect = section.getBoundingClientRect();
        rectScrollY = sy;
        rectW = w;
        rectH = h;
        navRect = null;
      }
      return sectionRect;
    };
    const tick = () => {
      // Completely stop ticking while hero is off-screen.
      if (!heroVisible) {
        raf = 0;
        if (fluidQuiet) {
          fluidQuiet = false;
          setFluidQuiet(false);
        }
        return;
      }
      const menuOpen = document.body.classList.contains("menu-open");
      const isIdle = document.body.classList.contains("is-idle");
      // Under the menu or the idle screen the lens is off and the water is
      // quiet, and nothing here needs a measurement: a layout read on every
      // frame of the menu's own animation was a forced layout each time.
      if (menuOpen || isIdle) {
        if (active) {
          active = false;
          hide();
        }
        if (cursorHidden) {
          cursorHidden = false;
          setCursorHidden(false);
        }
        if (!fluidQuiet) {
          fluidQuiet = true;
          setFluidQuiet(true);
        }
        revealActivePrev = false;
        raf = requestAnimationFrame(tick);
        return;
      }
      const s = sectionBox();
      const overHero =
        lastX >= s.left &&
        lastX <= s.right &&
        lastY >= s.top &&
        lastY <= s.bottom;
      // The glass lens runs only over the hero, away from the navbar, with the
      // menu closed. Everywhere else the normal cursor logo is shown instead.
      const lensOn = overHero && !nearNavbar();

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

      // The water goes quiet across the WHOLE hero, not just where the lens
      // is drawing. `lensOn` above also switches off near the navbar, with
      // the menu open and when idle — moments where the cursor logo comes
      // back, but where a ripple wake would still be washing over the
      // headline and the brush mask. `overHero` is the section, and the
      // section is what the effect does not belong in.
      if (fluidQuiet !== overHero) {
        fluidQuiet = overHero;
        setFluidQuiet(overHero);
      }

      if (active) {
        lx += (lastX - lx) * LERP;
        ly += (lastY - ly) * LERP;
        drawLens(s);
      }
      // Advance the revealed language once per pass over the WHOLE headline
      // block (falling edge of its bounding box). Testing per reveal element
      // fired several falling edges in a single sweep — crossing the gaps
      // between "is a" / "design-led" / the noun (whose roller rows also have
      // rects while clipped) — advancing 4× per pass and often landing back
      // on the same language repeatedly.
      let overTitle = false;
      const titleEl = titleRef.current;
      if (active && titleEl) {
        const tr = titleEl.getBoundingClientRect();
        overTitle =
          lx + half > tr.left &&
          lx - half < tr.right &&
          ly + half > tr.top &&
          ly - half < tr.bottom;
      }
      if (!overTitle && revealActivePrev) {
        setLangIndex((i) => (i + 1) % REVEAL_LANGS.length);
      }
      revealActivePrev = overTitle;
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
      if (inside) return;
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
      window.removeEventListener("resize", alignBaselines);
      setCursorHidden(false); // never leave it hidden if the hero unmounts
      setFluidQuiet(false); // …and never leave the water silenced either
    };
  }, []);

  // Wait for `app:uncovered` — the loader's curtain fully OFF — not for
  // `app:reveal`, which fires the moment it starts lifting.
  //
  // The two are a second apart, and the difference is the whole animation. The
  // page has to exist behind the curtain before it peels, which is what
  // `app:reveal` is for; but an entrance started then plays out underneath the
  // curtain and the viewer sees only its tail. The headline is the one thing on
  // this page that must be watched from its first frame.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window as Window & { __appUncovered?: boolean }).__appUncovered
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot sync with the loader's external reveal flag on mount
      setRevealed(true);
      return;
    }
    const onUncovered = () => setRevealed(true);
    window.addEventListener("app:uncovered", onUncovered);
    return () => window.removeEventListener("app:uncovered", onUncovered);
  }, []);

  // Entrance load animation — the left headline rises in, the bottom-right
  // tagline drifts in from the right. Plays once revealed.
  useGSAP(
    () => {
      if (!revealed) return;
      const dur = prefersReducedMotion ? 0.01 : isTouch ? 0.45 : 0.8;

      const title = titleRef.current;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // The block itself is at rest from the first frame — it is the logo and
      // the lines INSIDE it that animate now, so a fade on the container would
      // only wash over the top of them.
      tl.set(title, { opacity: 1, y: 0 });

      const logo = title?.querySelector<HTMLElement>("[data-hero-logo]");
      const line2 = title?.querySelector<HTMLElement>('[data-hero-line="2"]');
      const line3 = title?.querySelector<HTMLElement>('[data-hero-line="3"]');

      // Reduced motion gets the arrangement without the travel.
      if (prefersReducedMotion) {
        tl.set([logo, line2, line3].filter(Boolean), {
          opacity: 1,
          x: 0,
          skewX: 0,
        });
      } else {
        const from = { x: REVEAL.x, opacity: 0, skewX: REVEAL.skewX };
        const to = { x: 0, opacity: 1, skewX: 0, duration: REVEAL.duration };

        // The logo is an image, so it travels as one piece — there are no
        // characters in it to stagger.
        if (logo) tl.fromTo(logo, from, to, 0);

        /**
         * Line 2 splits into characters; line 3 does not, and cannot.
         *
         * Line 3 is the cycling-noun roller: a column of words moved by a
         * transform on its track, inside a 1.25em window. Splitting it would
         * rewrite the very nodes that transform drives. Line 2's words are
         * static, so they take the per-character reveal the sketch is built on.
         */
        if (line2) {
          // Split the two lens BASE spans individually. Splitting the line as a
          // whole would sweep up the absolutely-positioned translation overlays
          // sitting on top of them and split those too, which is what aligns to
          // the cursor lens — it must stay one intact run of text.
          const bases = Array.from(
            line2.querySelectorAll<HTMLElement>("[data-lens-base]"),
          );
          const split = SplitText.create(bases, {
            type: "chars",
            charsClass: "hero-char",
          });
          splitRef.current = split;
          tl.fromTo(
            split.chars,
            from,
            { ...to, stagger: REVEAL.stagger },
            0.12,
          );
        }

        if (line3) tl.fromTo(line3, from, to, 0.3);
      }

      tl.fromTo(
        rollingRef.current,
        { opacity: 0, y: 24, x: 40 },
        { opacity: 1, y: 0, x: 0, duration: dur },
        "-=0.35",
      );

      return () => {
        // Put the characters back into plain text nodes — the lens measures
        // these spans, and leaving them split would hand it a different shape
        // than it was set up against.
        splitRef.current?.revert();
        splitRef.current = null;
      };
    },
    { scope: containerRef, dependencies: [revealed] },
  );

  return (
    // As tall as the LARGE viewport (lvh), not the small one. iOS 26 Safari
    // now draws the page under its floating bottom toolbar (the bars are
    // see-through since the 23 Sep fixes), so at load the screen runs past
    // the small viewport by the toolbar's height — and a min-h-svh hero ended
    // above the screen's bottom edge, with the top of the services section
    // showing through the toolbar (client, 26 Sep). The CONTENT layer below
    // stays the small viewport's height, so the headline keeps its place and
    // the Let's Talk CTA pinned to its foot stays clear of the toolbar; only
    // the background runs on under it. On desktop the two units are equal.
    <section
      ref={containerRef}
      id="hero-banner"
      className="relative w-full min-h-lvh overflow-hidden bg-transparent"
    >
      {/* Hero-only experimental WebGL background. Sits behind the content
          (z-0) and cross-fades into the shared page background at the bottom
          seam (services). Every other section keeps the shared background. */}
      <HeroBackground />

      <div className="absolute inset-x-0 top-0 h-svh z-10 flex flex-col items-start justify-center text-left px-[clamp(1.25rem,5vw,8rem)] pt-[clamp(5rem,10vh,8rem)] pb-[clamp(2rem,5vh,4rem)] pointer-events-none">
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
              breaks the flush-left stack into an asymmetric stagger (the
              cycling noun below stays flush-left, per client). */}
          <div
            data-hero-line="2"
            className={`${LINE2_TYPE} flex items-baseline gap-[0.5em] ml-[clamp(2.5rem,9vw,8rem)]`}
            style={{ fontFamily: HERO_SANS }}
          >
            {/* "is a" — also carries the lens reveal (short forms per language) */}
            <span className="relative inline-block">
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
                  fontFamily: REVEAL_FONT,
                }}
                className="lens-reveal absolute inset-0 whitespace-nowrap"
              >
                <span className="lens-reveal__ink">
                  {I18N[REVEAL_LANGS[langIndex]].isA}
                </span>
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
                  fontFamily: REVEAL_FONT,
                }}
                className="lens-reveal absolute inset-0 whitespace-nowrap"
              >
                <span className="lens-reveal__ink">
                  {I18N[REVEAL_LANGS[langIndex]].designLed}
                </span>
              </span>
            </span>
          </div>

          {/* Line 3 — cycling noun. Pulled back to a smaller offset than line 2
              (not flush with the logo either) so the three lines zigzag
              instead of forming a straight left edge. */}
          {/* This window's height, each row's height below, and LINE3_TYPE's
              leading-[1.25] must all be the SAME 1.25em — change one and you
              must change all three. They had drifted: the rows were 1.1em while
              the leading made every word's line box 1.25em, so each word
              overflowed its own row by 0.15em and the neighbouring word bled
              ~4px into this window at the top and bottom. Two words showed at
              once, which the lens reveal made obvious. (The "Let's Talk" roller
              below pairs h-[1.1em] with leading-[1.1em] — matched, as here.) */}
          <div
            data-hero-line="3"
            className={`${LINE3_TYPE} overflow-hidden h-[1.25em] ml-[clamp(4rem,14vw,11rem)]`}
            style={{ fontFamily: HERO_SANS }}
          >
            <div
              className="flex flex-col"
              style={wordRollStyle}
              onTransitionEnd={handleWordTransitionEnd}
            >
              {displayWords.map((word, idx) => (
                <span
                  key={idx}
                  className="relative h-[1.25em] flex items-center whitespace-nowrap"
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
                      fontFamily: REVEAL_FONT,
                    }}
                    className="lens-reveal absolute inset-0 flex items-center whitespace-nowrap"
                  >
                    <span className="lens-reveal__ink">
                      {I18N[REVEAL_LANGS[langIndex]][word]}
                    </span>
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
          data-corner-dock-avoid
          className="group absolute right-[clamp(1.25rem,5vw,8rem)] bottom-[clamp(2rem,5vh,4rem)] opacity-0 translate-y-6 inline-flex items-center gap-2.5 pointer-events-auto font-medium text-[clamp(0.7rem,1.1vw,0.9rem)] uppercase tracking-[0.22em] text-white"
        >
          {/* Accepting new projects badge — revealed on hover of the CTA,
              bouncing in above the link on a liquid-glass pill. */}
          <span
            aria-hidden
            className="liquid-glass lg-drop-hover pointer-events-none absolute right-0 bottom-full mb-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[0.65rem] font-medium normal-case tracking-normal text-white opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
            /* A low box: a thinner chrome rim, in proportion. */
            style={{ "--glass-rim": "3px" } as React.CSSProperties}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#ff2a45] opacity-90 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff2a45] shadow-[0_0_10px_2px_rgba(255,42,69,0.9)] animate-pulse" />
            </span>
            {/* An element, not a bare text node, so the bud's content
                blur-in (which addresses the badge's children) takes it. */}
            <span>Accepting new projects</span>
          </span>
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
            {/* Line pops out along the bottom on hover — white so it reads
                against the red hero background. */}
            <span
              aria-hidden
              className="absolute left-0 bottom-0 h-px w-full origin-left scale-x-0 bg-white transition-transform duration-300 ease-out group-hover:scale-x-100"
            />
          </span>
          {/* Arrow nudges continuously (not just on hover). */}
          <span
            aria-hidden
            className="inline-block motion-safe:animate-[heroArrowNudge_0.8s_ease-in-out_infinite]"
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
