"use client";

import { useRef, useEffect, useCallback } from "react";
import { TransitionRouter } from "next-transition-router";
import gsap from "gsap";

/**
 * Block-reveal page transition.
 *
 * A fixed grid of opaque brand-maroon squares sits above the whole page. On
 * leaving a route the squares flick on in a random stagger until the screen is
 * covered; the route then swaps and the squares flick back off in another
 * random stagger, revealing the new page.
 *
 * The logo lockup is painted ACROSS the grid — each square that overlaps the
 * logo carries its own slice of the image, aligned so the squares collectively
 * reconstruct it. Because the squares fade in and out individually, the logo
 * assembles itself piece by piece on the way in and shatters apart on the way
 * out; it is never drawn as one element.
 *
 * This is mounted in the ROOT layout, not in `app/template.tsx`. The template
 * re-mounts on every navigation, which would destroy the grid (and the
 * TransitionRouter's own state) halfway through the very transition it is
 * driving. The root layout persists across client-side navigations, so the same
 * grid covers the outgoing page and uncovers the incoming one.
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

// Random-stagger spreads: the whole grid, and the logo's own pieces.
const COVER_STAGGER = 0.4;
const LOGO_STAGGER = 0.35;

// ── Timeline ───────────────────────────────────────────────────────────────
// The logo gets its own beat, and that beat happens while the screen is FULLY
// COVERED. That ordering is the whole point:
//
//   leave   0.00  squares flick on at random until the page is covered
//           0.45  logo assembles, piece by piece, on the solid maroon
//           0.85  → route swaps
//   enter   0.20  logo shatters back into its pieces (still fully covered)
//           0.60  squares flick off at random, revealing the new page
//
// Letting the logo shatter WHILE the blocks cleared was the original mistake:
// LoadingScreen paints the same lockup at the same size and position, so every
// pixel a clearing block uncovered was identical to the one it had been
// hiding. The logo could not be seen to break apart because it was still there
// underneath. Shattering it against flat maroon first is what makes it read.
const LOGO_ASSEMBLE_AT = 0.45; // after the cover completes (0.4 + 0.05)
const LOGO_SHATTER_AT = 0.2; // brief hold at full cover, then break up
const BLOCKS_CLEAR_AT = LOGO_SHATTER_AT + LOGO_STAGGER + BLOCK_FADE;

// The logo, sliced across the grid. Same lockup, size and position as the one
// LoadingScreen centres on screen, so the mark that reassembles behind the
// lifting curtain lands exactly where the shattered one was.
// Keep these in sync with LoadingScreen.tsx if that logo ever changes.
const LOGO_SRC = "/ZEALTH-11-trimmed.png";
const LOGO_ASPECT = 1318 / 342; // intrinsic size of the file
// LoadingScreen's `w-[clamp(18rem,50vw,40rem)]`, in px.
const logoWidthFor = (viewportWidth: number) =>
  Math.min(Math.max(288, viewportWidth * 0.5), 640);

/**
 * Tells LoadingScreen that a block transition is running, so it shows its
 * frosted backdrop WITHOUT its logo lockup.
 *
 * The logo belongs to the blocks alone. The loader mounts on the incoming
 * route while the cover is still up, and it centres the same lockup at the
 * same size — so left alone it re-draws, whole, the mark the blocks just
 * finished shattering. This flag is set for the whole transition and read by
 * the loader when it mounts, which is always inside that window. On a first
 * load or a hard refresh there is no transition, the flag is unset, and the
 * loader keeps its logo and its Flip hand-off into the hero exactly as before.
 */
const setBlockTransitionActive = (active: boolean) => {
  (window as Window & { __blockTransition?: boolean }).__blockTransition =
    active;
};

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<HTMLDivElement[]>([]);
  // The logo slices, one child per block that overlaps the lockup. They are
  // separate elements — not the block's own background — because the block's
  // opacity is the page cover and the slice's opacity is the logo. Painting
  // the slice onto the block itself welds the two together, and the logo can
  // then only ever appear and vanish with the cover.
  const logoPiecesRef = useRef<HTMLDivElement[]>([]);
  // True from the first frame of `leave` until `enter` finishes. A resize
  // mid-transition must not rebuild the grid — that would drop every block back
  // to opacity 0 and flash the outgoing page through the cover.
  const isTransitioningRef = useRef(false);
  const reducedMotionRef = useRef(false);

  const buildGrid = useCallback(() => {
    const container = gridRef.current;
    if (!container) return;

    container.replaceChildren();
    blocksRef.current = [];
    logoPiecesRef.current = [];

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const columns = Math.ceil(vw / BLOCK_SIZE);
    // One spare row so a viewport that is not an exact multiple of BLOCK_SIZE
    // still has the bottom edge covered once the grid is centred.
    const rows = Math.ceil(vh / BLOCK_SIZE) + 1;

    // ── Everything below is rounded to whole pixels, and that is load-bearing ──
    // The logo is reassembled out of 48 independent background layers. At a
    // fractional offset each slice is resampled off the pixel grid, so the
    // seams between neighbouring squares soften and the letterforms no longer
    // line up exactly — the mark comes back together slightly blurred and
    // fringed instead of whole. Integer offsets make every slice land on the
    // same pixel grid, so the reassembled logo is identical to the image.
    //
    // Rounding the two OFFSETS (rather than each block's position) is what
    // keeps the cover gapless: `col * BLOCK_SIZE` is already an integer, so a
    // single rounded offset shifts every block by the same whole pixel and the
    // 60px squares stay exactly 60px apart.
    const offsetX = Math.round((vw - columns * BLOCK_SIZE) / 2);
    const offsetY = Math.round((vh - rows * BLOCK_SIZE) / 2);

    // Where the logo sits in the viewport. Blocks that overlap this rect get a
    // slice of it; the rest stay flat maroon.
    const logoW = Math.round(logoWidthFor(vw));
    const logoH = Math.round(logoW / LOGO_ASPECT);
    const logoLeft = Math.round((vw - logoW) / 2);
    const logoTop = Math.round((vh - logoH) / 2);

    const frag = document.createDocumentFragment();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const left = col * BLOCK_SIZE + offsetX;
        const top = row * BLOCK_SIZE + offsetY;

        const block = document.createElement("div");
        block.className = "transition-block";
        // Size and position inline, both derived from BLOCK_SIZE. The square's
        // geometry is the one thing the whole effect rests on, so it does not
        // depend on a stylesheet rule arriving — and BLOCK_SIZE stops being
        // duplicated as a magic 60px in globals.css.
        block.style.position = "absolute";
        block.style.width = `${BLOCK_SIZE}px`;
        block.style.height = `${BLOCK_SIZE}px`;
        block.style.left = `${left}px`;
        block.style.top = `${top}px`;

        // Paint the logo slice only where the block actually overlaps it —
        // most of a 1440×900 grid never touches the lockup, and giving all
        // ~380 blocks a background layer to composite would be wasted work.
        const overlapsLogo =
          left < logoLeft + logoW &&
          left + BLOCK_SIZE > logoLeft &&
          top < logoTop + logoH &&
          top + BLOCK_SIZE > logoTop;

        if (overlapsLogo) {
          const piece = document.createElement("div");
          piece.className = "transition-logo-piece";
          // Layout is set HERE, not in globals.css. A stylesheet rule is a
          // second thing that has to arrive for this element to exist at all:
          // without `position:absolute; inset:0` the div is a static,
          // zero-height box that paints nothing, however correct its opacity
          // and background are. Keeping it inline means the element that gets
          // created is always the element that gets drawn.
          piece.style.position = "absolute";
          piece.style.inset = "0";
          piece.style.opacity = "0";
          piece.style.backgroundImage = `url(${LOGO_SRC})`;
          piece.style.backgroundSize = `${logoW}px ${logoH}px`;
          // Offset the shared image so this piece shows only its own portion.
          piece.style.backgroundPosition = `${logoLeft - left}px ${logoTop - top}px`;
          // Without this the slice tiles inside its own 60px square and the
          // logo comes out repeated. Set here, next to the other three
          // background longhands, so all four cannot drift apart.
          piece.style.backgroundRepeat = "no-repeat";
          block.appendChild(piece);
          logoPiecesRef.current.push(piece);
        }

        frag.appendChild(block);
        blocksRef.current.push(block);
      }
    }
    // Appended while the blocks are still at opacity 0, so the browser fetches
    // and decodes the logo now rather than on the first navigation.
    container.appendChild(frag);

    gsap.set(blocksRef.current, { opacity: 0 });
    gsap.set(logoPiecesRef.current, { opacity: 0 });
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
    // The old shape-only test — skip unless the row/column count changes — is
    // not enough now that the logo rides on the grid. It is centred on the
    // viewport at build time, so any size change leaves it off-centre even
    // when the block count is identical.
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

  // Cover the outgoing page, then build the logo on top of the cover.
  // `next()` performs the actual route change and runs once both have landed.
  const leave = useCallback((next: () => void) => {
    isTransitioningRef.current = true;
    setBlockTransitionActive(true);

    if (reducedMotionRef.current) {
      const tl = gsap.timeline({ onComplete: next });
      tl.to(blocksRef.current, { opacity: 1, duration: 0.2, ease: "none" }, 0);
      tl.to(logoPiecesRef.current, { opacity: 1, duration: 0.2, ease: "none" }, 0.2);
      return () => tl.kill();
    }

    // onComplete lives on the TIMELINE, not on a tween: if a viewport ever has
    // no logo pieces the tween would have no targets, and `next` — the actual
    // route change — must not depend on that firing.
    const tl = gsap.timeline({ onComplete: next });
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
    tl.to(
      logoPiecesRef.current,
      {
        opacity: 1,
        duration: BLOCK_FADE,
        ease: "power2.inOut",
        stagger: { amount: LOGO_STAGGER, from: "random" },
      },
      LOGO_ASSEMBLE_AT,
    );
    return () => tl.kill();
  }, []);

  // Break the logo apart against the still-solid cover, then lift the cover.
  const enter = useCallback((next: () => void) => {
    const done = () => {
      isTransitioningRef.current = false;
      setBlockTransitionActive(false);
      next();
    };

    // The grid is rebuilt from scratch on resize, so re-assert the covered,
    // logo-assembled state rather than trusting what the leave timeline left.
    gsap.set(blocksRef.current, { opacity: 1 });
    gsap.set(logoPiecesRef.current, { opacity: 1 });

    if (reducedMotionRef.current) {
      const tl = gsap.timeline({ onComplete: done });
      tl.to(logoPiecesRef.current, { opacity: 0, duration: 0.2, ease: "none" }, 0.2);
      tl.to(blocksRef.current, { opacity: 0, duration: 0.25, ease: "none" }, 0.4);
      return () => tl.kill();
    }

    const tl = gsap.timeline({ onComplete: done });
    tl.to(
      logoPiecesRef.current,
      {
        opacity: 0,
        duration: BLOCK_FADE,
        ease: "power2.inOut",
        stagger: { amount: LOGO_STAGGER, from: "random" },
      },
      LOGO_SHATTER_AT,
    );
    tl.to(
      blocksRef.current,
      {
        opacity: 0,
        duration: BLOCK_FADE,
        ease: "power2.inOut",
        stagger: { amount: COVER_STAGGER, from: "random" },
      },
      BLOCKS_CLEAR_AT,
    );
    return () => tl.kill();
  }, []);

  return (
    // `auto` delegates on every same-origin <a href> in the document, so the
    // transition covers the navbar menu, the hero links, the footer and 404
    // without threading a custom <Link> through each one. The delegated handler
    // bails on `event.defaultPrevented`, which is what keeps the navbar's
    // in-page anchor scrolls (Services / Work / Seasons) from triggering it.
    <TransitionRouter auto leave={leave} enter={enter}>
      <div ref={gridRef} className="transition-grid" aria-hidden />
      {children}
    </TransitionRouter>
  );
}
