"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { useAppReady } from "@/app/animations/useAppReady";
import { isPhoneDevice } from "@/app/lib/device";
import SignatureLogo, { LOGO_CLASS } from "./SignatureLogo";

gsap.registerPlugin(ScrambleTextPlugin);

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

/**
 * How each greeting arrives: decoded out of a scramble of dots and colons,
 * the client's reference (AnimationsZuhayr/code (15): GSAP ScrambleText,
 * chars ".:", speed 0.5). It replaced a hard swap of one word for the next.
 *
 * The first greeting decodes out of nothing; each one after it scrambles
 * straight out of the one before. Holds are the beat a word sits resolved.
 */
const SCRAMBLE_CHARS = ".:";
const SCRAMBLE_SPEED = 0.5;
const FIRST_DECODE = 0.7;
const FIRST_HOLD = 0.35;
const WORD_DECODE = 0.42;
const WORD_HOLD = 0.14;
/**
 * And a beat on the last one.
 *
 * The greetings no longer run WHILE the page loads — they run after the
 * signature has finished writing itself, and the curtain waits for them. With
 * nothing held behind them there is no reason for the final greeting to be
 * yanked away the instant it appears, so it gets a moment of its own.
 */
const LAST_HOLD = 0.45;

/**
 * Floor for the curtain, in ms.
 *
 * Short enough that a warm cache does not feel like waiting. It used to be the
 * thing that made the intro read as deliberate, at 1350ms; the signature draw
 * is that now, and it is far longer, so this is only the floor under the
 * READINESS wait that runs alongside it.
 */
const MIN_MS = 800;
/**
 * Hard cap — never hold the site behind the curtain longer than this.
 *
 * Note what this does and does not bound. It caps the wait for the page to be
 * ready; it does not cap the signature, which is a fixed length and is waited
 * for in full — see LOGO_SPEED in SignatureLogo.tsx, which is the knob for how
 * long that is. The two overlap: the draw starts the moment the loader mounts,
 * so on any load slower than the draw the intro costs nothing extra.
 */
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

  // The signature has finished writing itself, and then the greetings have
  // finished cycling. Both are what the curtain waits for, in that order.
  //
  // On a navigation there is neither: the block transition above is already
  // drawing the lockup and this loader is nothing but a backdrop, so both start
  // satisfied and the curtain is free to go as soon as the page is ready.
  const [logoDone, setLogoDone] = useState(duringTransition);
  const [greetingsDone, setGreetingsDone] = useState(duringTransition);

  // Skip the readiness wait entirely on a navigation — everything is cached,
  // and `window.load` has long since fired so it would resolve instantly anyway.
  const ready = useAppReady({
    minMs: duringTransition ? 0 : MIN_MS,
    // A phone's hard cap is lower: past 3.5s a visitor on a phone reads the
    // curtain as the site being slow, not as an intro.
    maxMs: duringTransition ? 0 : isPhoneDevice() ? MAX_MS_PHONE : MAX_MS,
  });

  /** The curtain's bottom edge: bowed down, then flat.
   *  Its height is the curtain's own (h-lvh, the LARGE viewport), not
   *  window.innerHeight: on an iPhone innerHeight is the small viewport, the
   *  screen less Safari's bars, and with the see-through toolbar the page
   *  shows under it — the clip's flat edge stopped above the toolbar and only
   *  the bow's middle reached below, so the hero showed in both bottom
   *  corners (3 Oct). */
  const paths = useCallback(() => {
    const w = window.innerWidth;
    const h = Math.max(rootRef.current?.clientHeight ?? 0, window.innerHeight);
    return {
      from: `M0 0 L${w} 0 L${w} ${h} Q${w / 2} ${h + 300} 0 ${h} L0 0`,
      to: `M0 0 L${w} 0 L${w} ${h} Q${w / 2} ${h} 0 ${h} L0 0`,
    };
  }, []);

  // ── Intro: the signature writes itself while the page loads behind it ─────
  useEffect(() => {
    if (duringTransition) return;
    const path = pathRef.current;
    const logo = logoRef.current;
    if (!path || !logo) return;

    path.setAttribute("d", paths().from);

    // The lockup itself fades up; the signature inside it is already drawing
    // (SignatureLogo autoplays as soon as its data lands).
    const fade = gsap.to(logo, {
      opacity: 1,
      duration: 0.7,
      ease: "power2.out",
    });

    // The curtain is sized to the viewport, so a resize mid-load has to redraw
    // the edge or it detaches from the bottom of the screen.
    const onResize = () => {
      if (!exited.current) path.setAttribute("d", paths().from);
    };
    window.addEventListener("resize", onResize);

    return () => {
      fade.kill();
      window.removeEventListener("resize", onResize);
    };
  }, [duringTransition, paths]);

  // ── Greetings: only once the signature is finished ────────────────────────
  //
  // They used to run from the first frame, alongside the logo. They are the
  // beat AFTER the draw now — the mark finishes writing, and then the site says
  // hello in five languages — so nothing competes with the pen for attention.
  useEffect(() => {
    if (duringTransition || !logoDone) return;
    const word = wordRef.current;
    if (!word) {
      setGreetingsDone(true);
      return;
    }

    const text = wordTextRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // One timeline: decode, hold, decode the next... then the last one's
    // beat before the curtain takes it. Killed whole on cleanup.
    const tl = gsap.timeline({ onComplete: () => setGreetingsDone(true) });
    tl.to(word, { opacity: 1, duration: 0.4, ease: "power2.out" }, 0);

    if (!text || reduced) {
      // No scramble under reduced motion: the words simply change, at the
      // same overall pace, so the intro is no longer for it.
      GREETINGS.forEach((g, i) => {
        if (i === 0) return;
        tl.call(() => {
          if (text) text.textContent = g;
        }, [], FIRST_DECODE + FIRST_HOLD + (i - 1) * (WORD_DECODE + WORD_HOLD) + WORD_DECODE);
      });
    } else {
      text.textContent = "";
      GREETINGS.forEach((g, i) => {
        tl.to(text, {
          duration: i === 0 ? FIRST_DECODE : WORD_DECODE,
          ease: "none",
          scrambleText: { text: g, chars: SCRAMBLE_CHARS, speed: SCRAMBLE_SPEED },
        });
        if (i < GREETINGS.length - 1) tl.to({}, { duration: i === 0 ? FIRST_HOLD : WORD_HOLD });
      });
    }
    // The last greeting gets its own beat before the curtain takes it away.
    tl.to({}, { duration: LAST_HOLD });

    return () => {
      tl.kill();
    };
  }, [duringTransition, logoDone]);

  // ── Exit: peel the curtain off, once the page is genuinely ready ──────────
  //
  // Three conditions, not one. `ready` is the page (fonts, first-viewport
  // images, the WebGL gates); `logoDone` is the signature having finished
  // writing itself; `greetingsDone` is the hello cycle having run. They overlap
  // — the page loads while the pen draws — so the intro costs INTRO_MS, not
  // INTRO_MS plus the load.
  useEffect(() => {
    if (!ready || !logoDone || !greetingsDone || exited.current) return;
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
  }, [
    ready,
    logoDone,
    greetingsDone,
    duringTransition,
    onReveal,
    onComplete,
    paths,
  ]);

  return (
    <div
      ref={rootRef}
      // Tall as the LARGE viewport, not inset-0 — see PixelWipe's layer:
      // on an iPhone a bottom:0 cover stopped short of Safari's toolbar.
      className="fixed inset-x-0 top-0 h-lvh z-9999 overflow-hidden"
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
          {/* The lockup draws itself. On a navigation it is left out entirely:
              PageTransition's cover is already playing the same signature above
              this curtain, and two of them would be drawn at once. */}
          <div ref={logoRef} className={`${LOGO_CLASS} opacity-0`}>
            {!duringTransition && (
              <SignatureLogo autoplay onComplete={() => setLogoDone(true)} />
            )}
          </div>

          <p
            ref={wordRef}
            className="flex items-center text-[clamp(1rem,2.2vw,1.6rem)] leading-none text-white opacity-0"
            // The reveal face, not the hint mono: three of these greetings are
            // CJK and Geist Mono has none of those glyphs. This is the same
            // subsetted Noto Sans KR the hero's lens uses, so every greeting is
            // drawn by one typeface rather than by whatever each script
            // happens to resolve to.
            //
            // Departure Mono next in line: the reveal font is subset to the
            // greetings' own characters, so the scramble's dots and colons
            // fall through to the site's mono face — monospaced, as in the
            // reference.
            style={{ fontFamily: "var(--font-reveal), var(--font-departure)" }}
          >
            <span className="mr-3 block h-2 w-2 shrink-0 rounded-full bg-[#c4010d]" />
            <span ref={wordTextRef}>{GREETINGS[0]}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
