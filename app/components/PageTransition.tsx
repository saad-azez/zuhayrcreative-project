"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { TransitionRouter } from "next-transition-router";
import gsap from "gsap";
import SignatureLogo, {
  LOGO_CLASS,
  logoDurationMs,
  type SignatureLogoHandle,
} from "./SignatureLogo";

/**
 * Block-reveal page transition.
 *
 * A fixed grid of opaque brand-maroon squares sits above the whole page. On
 * leaving a route the squares flick on in a random stagger until the screen is
 * covered; the ZUHAYR Creative signature then writes itself across the cover,
 * and only once the pen has finished do the squares flick back off, revealing
 * the new page.
 *
 * ── The logo used to be part of the grid ──
 * It was a PNG sliced across the squares, so it assembled and shattered piece
 * by piece as they faded. That was the best a still image could do. The lockup
 * is a Lottie now and draws itself, which is a stronger version of the same
 * idea, so the slicing is gone: one mark, centred above the cover, playing
 * once. The blocks are back to being only the cover.
 *
 * ── Ordering ──
 *
 *   leave   0.00  squares flick on at random until the page is covered
 *           0.45  cover complete → the signature starts writing, fast
 *                 → the route swaps HERE, behind the cover
 *           ~1.5  the pen finishes
 *   enter   +0.20 brief hold on the finished mark
 *           +0.45 squares flick off at random, revealing the new page
 *
 * The route swap is deliberately early. The draw is fixed-length and the new
 * route's mounting work is not, so they are overlapped rather than queued —
 * otherwise every navigation would cost the draw PLUS the render.
 *
 * This is mounted in the ROOT layout, not in `app/template.tsx`. The template
 * re-mounts on every navigation, which would destroy the grid (and the
 * TransitionRouter's own state) halfway through the very transition it is
 * driving. The root layout persists across client-side navigations, so the same
 * grid covers the outgoing page, the same Lottie plays across the swap, and the
 * same grid uncovers the incoming page.
 *
 * It chains with the LoadingScreen rather than replacing it: the blocks cover
 * the screen, the route swaps, the new template mounts and starts its loader,
 * and the blocks then clear INTO the loader already in progress. That is why
 * the grid sits above the loader's z-9999 — see `.transition-grid` in
 * globals.css.
 */

// Square edge in px. Smaller = finer reveal but more DOM nodes; at 60px a
// 1920×1080 viewport is ~610 blocks, which GSAP staggers comfortably.
const BLOCK_SIZE = 60;

// How long one square takes to flick on or off. The effect is in the stagger,
// not in the individual fade — keep this short and hard.
const BLOCK_FADE = 0.05;

// Random-stagger spread for the whole grid.
const COVER_STAGGER = 0.4;

/** When the last square has landed and the screen is solid. */
const COVER_DONE = COVER_STAGGER + BLOCK_FADE;

/**
 * How fast the signature is written HERE, as a multiple of the authored rate.
 *
 * Much faster than the loading curtain's (LOGO_SPEED in SignatureLogo.tsx,
 * 1.6). The two are doing different jobs: the loader plays the mark once, as
 * the first thing a visitor sees, and can afford the full four seconds. This
 * one runs on every single click, and a four-second wait between two pages of
 * the same site is not an intro, it is a stall. At 4.5 the pen still reads as
 * a pen and the whole transition is under two seconds.
 */
const TRANSITION_LOGO_SPEED = 4.5;

/** The lockup fading up onto the cover, and away from it again. */
const LOGO_FADE_IN = 0.25;
const LOGO_FADE_OUT = 0.25;
/** A beat on the finished signature before it is taken away. */
const HOLD_AFTER_DRAW = 0.2;

/**
 * Last resort, in ms, if the signature never reports that it finished.
 *
 * SignatureLogo has a watchdog of its own, but it is only armed once `play()`
 * has actually started a draw — a player that never reaches DOMLoaded would
 * never arm it. A page under an opaque grid that never clears is the worst
 * failure this component has, so the cover carries its own deadline too.
 */
const CLEAR_DEADLINE_MS = logoDurationMs(TRANSITION_LOGO_SPEED) + 3000;

/**
 * Tells LoadingScreen that a block transition is running, so it shows its
 * frosted backdrop WITHOUT its logo lockup.
 *
 * The logo belongs to the cover alone. The loader mounts on the incoming route
 * while the cover is still up, and it centres the same lockup at the same size
 * — so left alone there would be two signatures drawing at once, one above the
 * other. This flag is set for the whole transition and read by the loader when
 * it mounts, which is always inside that window. On a first load or a hard
 * refresh there is no transition, the flag is unset, and the loader keeps its
 * own signature and its greetings exactly as before.
 */
const setBlockTransitionActive = (active: boolean) => {
  (window as Window & { __blockTransition?: boolean }).__blockTransition =
    active;
};

/** A promise the `enter` phase can wait on for the `leave` phase's draw. */
type Deferred = { promise: Promise<void>; resolve: () => void };
const deferred = (): Deferred => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<HTMLDivElement[]>([]);
  const logoBoxRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<SignatureLogoHandle>(null);
  // Resolved when the current transition's draw has finished. Replaced at the
  // top of every `leave`, awaited at the top of every `enter`.
  const drawnRef = useRef<Deferred | null>(null);
  // True from the first frame of `leave` until `enter` finishes. A resize
  // mid-transition must not rebuild the grid — that would drop every block back
  // to opacity 0 and flash the outgoing page through the cover.
  const isTransitioningRef = useRef(false);
  const reducedMotionRef = useRef(false);

  // The Lottie is not built on first load.
  //
  // LoadingScreen mounts its own copy and that is the one the visitor is
  // looking at; a second player parsing the same 41KB and building a second SVG
  // tree while the hero's WebGL scenes are compiling is work nobody can see. It
  // is built when the browser next goes quiet instead — and, failing that, at
  // the start of the first navigation, where the chunk and the JSON are both
  // warm from the loader so the wait is a read from cache.
  const [logoMounted, setLogoMounted] = useState(false);

  const buildGrid = useCallback(() => {
    const container = gridRef.current;
    if (!container) return;

    container.replaceChildren();
    blocksRef.current = [];

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const columns = Math.ceil(vw / BLOCK_SIZE);
    // One spare row so a viewport that is not an exact multiple of BLOCK_SIZE
    // still has the bottom edge covered once the grid is centred.
    const rows = Math.ceil(vh / BLOCK_SIZE) + 1;

    // Rounding the two OFFSETS (rather than each block's position) is what
    // keeps the cover gapless: `col * BLOCK_SIZE` is already an integer, so a
    // single rounded offset shifts every block by the same whole pixel and the
    // 60px squares stay exactly 60px apart.
    const offsetX = Math.round((vw - columns * BLOCK_SIZE) / 2);
    const offsetY = Math.round((vh - rows * BLOCK_SIZE) / 2);

    const frag = document.createDocumentFragment();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const block = document.createElement("div");
        block.className = "transition-block";
        // Size and position inline, both derived from BLOCK_SIZE. The square's
        // geometry is the one thing the whole effect rests on, so it does not
        // depend on a stylesheet rule arriving — and BLOCK_SIZE stops being
        // duplicated as a magic 60px in globals.css.
        block.style.position = "absolute";
        block.style.width = `${BLOCK_SIZE}px`;
        block.style.height = `${BLOCK_SIZE}px`;
        block.style.left = `${col * BLOCK_SIZE + offsetX}px`;
        block.style.top = `${row * BLOCK_SIZE + offsetY}px`;

        frag.appendChild(block);
        blocksRef.current.push(block);
      }
    }
    container.appendChild(frag);

    gsap.set(blocksRef.current, { opacity: 0 });
  }, []);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    buildGrid();

    // Mobile browsers fire `resize` on every frame that the URL bar slides in
    // or out. A TRAILING debounce (not rAF) is what matters here: rebuilding
    // ~380 nodes per frame through that animation would be brutal, and the
    // only rebuild anyone can see is the one after the size settles.
    //
    // The logo no longer rides on the grid, so strictly only a change in the
    // block COUNT matters now — but the test stays on the raw size, because a
    // rebuild is cheap and a stale grid is a hole in the cover.
    let lastW = window.innerWidth;
    let lastH = window.innerHeight;
    let timer = 0;

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // Never mid-transition: a rebuild drops every block back to opacity 0
        // and would flash the outgoing page through the cover.
        if (isTransitioningRef.current) return;
        buildGrid();
      }, 150);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, [buildGrid]);

  // Build the Lottie once the browser is quiet — see `logoMounted`. The
  // timeout is the fallback for browsers without requestIdleCallback and for a
  // main thread that never goes idle at all.
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    const mount = () => setLogoMounted(true);
    if (w.requestIdleCallback) {
      const h = w.requestIdleCallback(mount, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(h);
    }
    const t = window.setTimeout(mount, 2000);
    return () => window.clearTimeout(t);
  }, []);

  // ── leave: cover the outgoing page, then write the signature on it ────────
  // `next()` performs the actual route change; it runs the moment the cover is
  // solid, so the new route mounts while the pen is still drawing.
  const leave = useCallback((next: () => void) => {
    isTransitioningRef.current = true;
    setBlockTransitionActive(true);
    setLogoMounted(true);

    const drawn = deferred();
    drawnRef.current = drawn;

    // Whatever the last transition left behind: the mark starts hidden.
    gsap.set(logoBoxRef.current, { opacity: 0 });

    const startLogo = () => {
      // Standalone tweens, not timeline children: the router is free to run
      // this callback's cleanup as soon as `next()` returns, and the fade has
      // to outlive that.
      gsap.to(logoBoxRef.current, {
        opacity: 1,
        duration: reducedMotionRef.current ? 0.15 : LOGO_FADE_IN,
        ease: "power2.out",
      });
      // If the player has not finished loading yet it records the request and
      // draws as soon as it can; either way `drawn` resolves when the pen
      // stops. A player that never arrives at all is caught by the deadline in
      // `enter`.
      logoRef.current?.play();
      next();
    };

    if (reducedMotionRef.current) {
      const tl = gsap.timeline();
      tl.to(blocksRef.current, { opacity: 1, duration: 0.2, ease: "none" }, 0);
      tl.call(startLogo, undefined, 0.2);
      return () => tl.kill();
    }

    const tl = gsap.timeline();
    tl.to(
      blocksRef.current,
      {
        opacity: 1,
        duration: BLOCK_FADE,
        ease: "power2.inOut",
        stagger: { amount: COVER_STAGGER, from: "random" },
      },
      0,
    );
    // The call sits at the END of the cover, so by the time it runs the tween
    // above has already finished and killing the timeline costs nothing.
    tl.call(startLogo, undefined, COVER_DONE);
    return () => tl.kill();
  }, []);

  // ── enter: wait for the pen, then lift the cover off the new page ─────────
  const enter = useCallback((next: () => void) => {
    const done = () => {
      isTransitioningRef.current = false;
      setBlockTransitionActive(false);
      next();
    };

    // The grid is rebuilt from scratch on resize, so re-assert the covered
    // state rather than trusting what the leave timeline left. The LOGO's
    // opacity is deliberately NOT touched: its fade-in is very likely still
    // running — `enter` starts the instant `next()` is called, which is the
    // same frame that fade begins.
    gsap.set(blocksRef.current, { opacity: 1 });

    let settled = false;
    let tl: gsap.core.Timeline | null = null;
    let deadline = 0;

    const clear = () => {
      if (settled) return;
      settled = true; // whichever of the draw and the deadline gets here first
      window.clearTimeout(deadline);

      const reduced = reducedMotionRef.current;
      tl = gsap.timeline({ onComplete: done });
      tl.to(
        logoBoxRef.current,
        {
          opacity: 0,
          duration: reduced ? 0.15 : LOGO_FADE_OUT,
          ease: "power2.in",
        },
        reduced ? 0 : HOLD_AFTER_DRAW,
      );
      tl.to(
        blocksRef.current,
        reduced
          ? { opacity: 0, duration: 0.25, ease: "none" }
          : {
              opacity: 0,
              duration: BLOCK_FADE,
              ease: "power2.inOut",
              stagger: { amount: COVER_STAGGER, from: "random" },
            },
        reduced ? 0.15 : HOLD_AFTER_DRAW + LOGO_FADE_OUT,
      );
    };

    const drawn = drawnRef.current;
    if (drawn) {
      deadline = window.setTimeout(clear, CLEAR_DEADLINE_MS);
      drawn.promise.then(clear);
    } else {
      clear();
    }

    return () => {
      settled = true;
      window.clearTimeout(deadline);
      tl?.kill();
    };
  }, []);

  const onDrawn = useCallback(() => drawnRef.current?.resolve(), []);

  return (
    // `auto` delegates on every same-origin <a href> in the document, so the
    // transition covers the navbar menu, the hero links, the footer and 404
    // without threading a custom <Link> through each one. The delegated handler
    // bails on `event.defaultPrevented`, which is what keeps the navbar's
    // in-page anchor scrolls (Services / Work / Seasons) from triggering it.
    <TransitionRouter auto leave={leave} enter={enter}>
      <div ref={gridRef} className="transition-grid" aria-hidden />
      {/* Above the grid, so the signature is drawn ON the cover rather than
          under it — see `.transition-logo` in globals.css. */}
      <div ref={logoBoxRef} className="transition-logo" aria-hidden>
        {logoMounted && (
          <SignatureLogo
            ref={logoRef}
            className={LOGO_CLASS}
            speed={TRANSITION_LOGO_SPEED}
            onComplete={onDrawn}
          />
        )}
      </div>
      {children}
    </TransitionRouter>
  );
}
