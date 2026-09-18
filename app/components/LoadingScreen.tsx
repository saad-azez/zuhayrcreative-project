"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useAppReady } from "@/app/animations/useAppReady";
import { isPhoneDevice } from "@/app/lib/device";

interface LoadingScreenProps {
  /** The curtain has begun to lift — reveal the page BEHIND it, now. */
  onReveal: () => void;
  /** The curtain is gone and the loader can be unmounted. */
  onComplete: () => void;
}

/**
 * Loading screen — a dark curtain carrying the Zuhayr Creative logo and a
 * cycle of greetings, which lifts off the page with a curved trailing edge.
 *
 * The curve is the whole trick: the panel is 300px taller than the viewport and
 * its bottom edge is a quadratic that starts bowed downward. As the panel
 * travels up, the bow flattens, so the curtain appears to be peeled off the
 * page rather than slid off it.
 *
 * ── When it lifts ──
 * On a real page load it waits for the page to ACTUALLY be ready — see
 * useAppReady — rather than for a fixed timeout. The old version ran a scripted
 * 1.5s timeline and handed over whether or not anything had loaded, which is
 * why the site could appear and then visibly settle: fonts swapping, images
 * popping in, the WebGL scenes compiling.
 *
 * ── Client-side navigations ──
 * PageTransition already covers the screen with its own animation on a route
 * change, and everything is warm by then. Running the full intro again would
 * put two loaders back to back, so on those the curtain does nothing but fade
 * its backdrop, immediately.
 */

/**
 * One greeting per language the hero's lens reveals, in the hero's own order:
 * English as the base, then Chinese, Japanese, Korean, Spanish.
 *
 * Two things must stay in step with this list. REVEAL_LANGS / I18N in
 * HeroBanner.tsx, so the site greets you in the same languages it later reveals
 * itself in — and GREETINGS in app/fonts/noto-sans-kr/subset.mjs, because the
 * reveal font ships only the characters those tables use. A character added
 * here without regenerating the font silently falls back to a system face,
 * which is the per-language typeface mismatch that font exists to prevent.
 */
const GREETINGS = [
  "Hello",
  "你好",
  "こんにちは",
  "안녕하세요",
  "Hola",
];

/** Hold on the first greeting, then the pace of the rest. */
const FIRST_HOLD = 0.55;
const WORD_STEP = 0.11;

/**
 * Floor for the curtain, in ms.
 *
 * Long enough for the greetings to read as deliberate, short enough that a warm
 * cache does not feel like waiting. The cycle itself takes FIRST_HOLD + 4 steps
 * ≈ 1s, so this is what the intro costs on a fast load — and it overlaps the
 * real loading rather than being added to it.
 */
const MIN_MS = 1350;
/** Hard cap — never hold the site behind the curtain longer than this. */
const MAX_MS = 6000;
const MAX_MS_PHONE = 3500;

/**
 * The curtain's shape before JS has measured the window — a rectangle large
 * enough to cover any viewport. See the note where it is used.
 */
const INITIAL_COVER = "M0 0 H20000 V20000 H0 Z";

export default function LoadingScreen({
  onReveal,
  onComplete,
}: LoadingScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLParagraphElement>(null);
  const wordTextRef = useRef<HTMLSpanElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const exited = useRef(false);

  // Read ONCE, on mount: a route change is already covered by the block
  // transition, so this loader must not play its intro over the top of it.
  const [duringTransition] = useState(
    () =>
      typeof window !== "undefined" &&
      !!(window as Window & { __blockTransition?: boolean }).__blockTransition,
  );

  // Skip the readiness wait entirely on a navigation — everything is cached,
  // and `window.load` has long since fired so it would resolve instantly anyway.
  const ready = useAppReady({
    minMs: duringTransition ? 0 : MIN_MS,
    // A phone's hard cap is lower: past 3.5s a visitor on a phone reads the
    // curtain as the site being slow, not as an intro.
    maxMs: duringTransition ? 0 : isPhoneDevice() ? MAX_MS_PHONE : MAX_MS,
  });

  /** The curtain's bottom edge: bowed down, then flat. */
  const paths = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      from: `M0 0 L${w} 0 L${w} ${h} Q${w / 2} ${h + 300} 0 ${h} L0 0`,
      to: `M0 0 L${w} 0 L${w} ${h} Q${w / 2} ${h} 0 ${h} L0 0`,
    };
  }, []);

  // ── Intro: greetings cycle while the page loads behind the curtain ────────
  useEffect(() => {
    if (duringTransition) return;
    const path = pathRef.current;
    const word = wordRef.current;
    const logo = logoRef.current;
    if (!path || !word || !logo) return;

    path.setAttribute("d", paths().from);

    const calls: gsap.core.Tween[] = [];
    gsap.to([word, logo], { opacity: 1, duration: 0.7, ease: "power2.out" });

    let i = 0;
    const step = () => {
      if (i >= GREETINGS.length - 1) return;
      calls.push(
        gsap.delayedCall(i === 0 ? FIRST_HOLD : WORD_STEP, () => {
          i += 1;
          if (wordTextRef.current) {
            wordTextRef.current.textContent = GREETINGS[i];
          }
          step();
        }),
      );
    };
    step();

    // The curtain is sized to the viewport, so a resize mid-load has to redraw
    // the edge or it detaches from the bottom of the screen.
    const onResize = () => {
      if (!exited.current) path.setAttribute("d", paths().from);
    };
    window.addEventListener("resize", onResize);

    return () => {
      calls.forEach((c) => c.kill());
      window.removeEventListener("resize", onResize);
    };
  }, [duringTransition, paths]);

  // ── Exit: peel the curtain off, once the page is genuinely ready ──────────
  useEffect(() => {
    if (!ready || exited.current) return;
    exited.current = true;

    const root = rootRef.current;
    const panel = panelRef.current;
    if (!root || !panel) {
      onReveal();
      onComplete();
      return;
    }

    // Navigation: no intro to undo, just get out of the way.
    if (duringTransition) {
      onReveal();
      gsap.to(root, {
        opacity: 0,
        duration: 0.45,
        ease: "power2.inOut",
        onComplete,
      });
      return;
    }

    // Reveal the page FIRST. The curtain lifts to show what is behind it, so
    // what is behind it has to be there — revealing on completion instead left
    // the curtain peeling off a blank page.
    onReveal();

    const { from, to } = paths();
    const tl = gsap.timeline({
      defaults: { ease: "power4.inOut" },
      onComplete,
    });

    tl.to([wordRef.current, logoRef.current], { opacity: 0, duration: 0.3 }, 0);
    tl.to(panel, { yPercent: -100, duration: 0.8, delay: 0.2 }, 0);
    // The bow flattens as the panel travels, which is what reads as a peel.
    tl.fromTo(
      pathRef.current,
      { attr: { d: from } },
      { attr: { d: to }, duration: 0.7, delay: 0.3 },
      0,
    );

    return () => {
      tl.kill();
    };
  }, [ready, duringTransition, onReveal, onComplete, paths]);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-9999 overflow-hidden"
      aria-hidden
    >
      {/* The panel is taller than the viewport so the curved edge has somewhere
          to bow into without exposing the page underneath. */}
      <div
        ref={panelRef}
        className="absolute inset-x-0 top-0 h-[calc(100%+300px)] will-change-transform"
      >
        {/* The curve is a CLIP now, not a fill.
            The curtain is the site's frosted glass again — the page-wide
            background showing through, blurred — which a solid path could not
            be: an SVG shape cannot carry a backdrop-filter. Filling the path
            painted a flat block over the page instead. Handing the same path to
            a clipPath and clipping a frosted div with it keeps the peel exactly
            as it was and gives the surface back its blur. */}
        <svg
          aria-hidden
          focusable="false"
          className="pointer-events-none absolute h-0 w-0"
        >
          <defs>
            {/* userSpaceOnUse: the path is built from window px, so the clip has
                to read the same coordinates rather than 0–1 fractions. */}
            <clipPath id="loader-curve" clipPathUnits="userSpaceOnUse">
              {/* A `d` is rendered on the SERVER, and it has to be.
                  The real curve is measured from the window, so it can only be
                  set once JS runs — but `clip-path: url()` pointing at a path
                  with no geometry clips its element to NOTHING. Between first
                  paint and hydration the curtain therefore vanished and the raw,
                  half-loaded page showed through with hard edges. On desktop
                  hydration is quick enough to hide it; on mobile Safari it is a
                  full second of broken page.

                  This covers any viewport (userSpaceOnUse, so these are plain
                  pixels) and is replaced by the measured curve on mount. It has
                  no bow, but the bow lives below the fold anyway. */}
              <path ref={pathRef} d={INITIAL_COVER} />
            </clipPath>
          </defs>
        </svg>
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-2xl"
          style={{
            clipPath: "url(#loader-curve)",
            WebkitClipPath: "url(#loader-curve)",
          }}
        />

        {/* Centred on the VIEWPORT, not the panel — the panel carries 300px of
            overhang below the fold, which would push the lockup off-centre. */}
        <div className="absolute inset-x-0 top-0 flex h-screen flex-col items-center justify-center gap-7 px-6">
          <div
            ref={logoRef}
            className="w-[clamp(14rem,38vw,30rem)] opacity-0"
          >
            <Image
              src="/ZEALTH-11-trimmed.png"
              alt="Zuhayr Creative"
              width={1318}
              height={342}
              priority
              className="block h-auto w-full"
            />
          </div>

          <p
            ref={wordRef}
            className="flex items-center text-[clamp(1rem,2.2vw,1.6rem)] leading-none text-white opacity-0"
            // The reveal face, not the hint mono: three of these greetings are
            // CJK and Geist Mono has none of those glyphs. This is the same
            // subsetted Noto Sans KR the hero's lens uses, so every greeting is
            // drawn by one typeface rather than by whatever each script
            // happens to resolve to.
            style={{ fontFamily: "var(--font-reveal)" }}
          >
            <span className="mr-3 block h-2 w-2 shrink-0 rounded-full bg-[#c4010d]" />
            <span ref={wordTextRef}>{GREETINGS[0]}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
