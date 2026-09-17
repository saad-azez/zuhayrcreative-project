"use client";

/**
 * On-scroll pixelated reveal — the Codrops "Image Pixel Loading" effect.
 *
 * The picture starts as a handful of huge blocks and sharpens in a few discrete
 * steps as it scrolls into view. The demo does this by drawing the image into a
 * canvas at a fraction of its size and blowing that back up with image
 * smoothing off, stepping the fraction up on a timer.
 *
 * Shape of the solution: a HOOK that mounts a canvas over the <img> and never
 * touches the host markup — the same shape as useSplashHover, and for the same
 * reason. The gallery moves its <img> with GSAP Flip when a card is opened and
 * the parallax rewrites the image's position and transform every frame, so
 * wrapping or replacing that element would break both.
 *
 * ── Replaying ─────────────────────────────────────────────────────────────
 * The demo plays once per page load (`once: true`). Here it replays, but the
 * re-arm is deliberately NOT tied to the icon leaving the viewport: the icons
 * sit in tall rows, so nudging the wheel near the section's edge would flick
 * them in and out and re-pixelate constantly, which reads as a glitch rather
 * than an effect.
 *
 * So the two halves are triggered off different elements:
 *
 *   PLAY   — per icon, as it comes into view (either scroll direction).
 *   RE-ARM — off the whole gallery section, and only once the viewport is a
 *            FULL SCREEN clear of it, above or below. That means the visitor is
 *            properly into a neighbouring section, not just peeking over the
 *            edge. Scrolling around at the section's boundary leaves the icons
 *            sharp; going away and coming back replays them.
 *
 * ── Two deliberate departures from the demo ───────────────────────────────
 * 1. The demo's image is a CSS background on a wrapper div it owns outright, so
 *    it can keep the canvas in place forever. Here the <img> is the real
 *    content — it carries the alt text, the lazy loading, and the Flip target —
 *    so the canvas is a temporary stand-in: it covers the image while the blocks
 *    resolve, then removes itself and hands the picture back.
 *
 * 2. The demo pixelates by drawing the image small into the visible canvas and
 *    then sampling that same canvas back onto itself, which samples a fractional
 *    source rect and leaves a gap at the edges — it compensates by drawing 5%
 *    oversized. We downscale into an offscreen canvas of integer size instead,
 *    so there is no fractional sampling and no need for the oversize. That
 *    matters more here than in the demo: an oversized last frame would jump when
 *    the real <img> takes over, and these icons are centred with object-fit,
 *    where a 5% bleed is clipped rather than absorbed.
 */

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Pixelation factors, straight from the demo: the value is a percentage of the
 * final size, so 1 means 1% (a few enormous blocks) and 100 means full size.
 * Deliberately front-loaded — the blockiest steps are held longest, and the last
 * stretch to sharp happens in one jump.
 */
const PX_FACTORS = [1, 2, 4, 9, 100];
/** The first step holds longest, so the big blocks actually register. */
const FIRST_STEP_MS = 300;
const STEP_MS = 80;

export function usePixelReveal(
  ref: React.RefObject<HTMLElement | null>,
  src: string,
  enabled = true,
) {
  useEffect(() => {
    const host = ref.current;
    if (!host || !enabled || !src) return;
    if (typeof window === "undefined") return;
    // Nothing to reveal for reduced motion — leave the plain <img> alone.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const img = host.querySelector("img");
    if (!img) return;

    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d");
    let revealTrigger: ScrollTrigger | null = null;
    let rearmTrigger: ScrollTrigger | null = null;
    let ro: ResizeObserver | null = null;
    let raf = 0;
    // Whether the host is on (or near) the screen — the glue loop below runs
    // only then. Set by the observer created with the canvas.
    let onScreen = false;
    let seen: IntersectionObserver | null = null;
    // Whether ANY of the icon is visible, clipped by any ancestor (see
    // `playSeen` in onload). The resolve keys off this.
    let visible = false;
    let playSeen: IntersectionObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pxIndex = 0;
    // armed  = blocks are up, waiting for the icon to come into view
    // playing = stepping from blocks to sharp right now
    let armed = false;
    let playing = false;
    let destroyed = false;

    const source = new Image();

    /**
     * Is a card currently expanded?
     *
     * While one is, this effect must keep its hands off the picture entirely.
     * Two reasons, and both bit:
     *
     * - The gallery's scroll lock pins the body (`position: fixed; top: -Y`) on
     *   the modal layout, which forces the document's scroll to 0. Every
     *   scroll-derived trigger then reads as "the visitor has left the gallery
     *   for good", so the re-arm fired and dropped pixel blocks over the image
     *   the user was looking at — and it stayed hidden through the whole close
     *   animation, then reappeared sharp a moment later.
     * - The expanded card IS this <img>; the gallery Flips this very element
     *   between the grid and the panel. Hiding it is never right there.
     */
    const galleryOpen = () =>
      !!document.querySelector(".section_content.is-active");
    /** Has this card been physically moved out of the grid into the panel? */
    const inPanel = () =>
      !!host.closest(".content_wrapper, .content_mobile-img");

    /**
     * Park the canvas exactly on the <img>'s own box.
     *
     * Same reasoning as useSplashHover: the LAYOUT box (offsetLeft/Top/…), not
     * getBoundingClientRect, because the canvas is a sibling inside the same
     * ancestor transforms and a BCR-derived size would be scaled twice. The
     * gallery parallax also absolutely-positions the image at height:88%/
     * width:auto and slides it on scroll, so the image is NOT simply filling the
     * container — the canvas has to track the image, not the host.
     */
    const syncTransform = () => {
      if (!canvas) return;
      // COMPUTED, not inline: gallery.css neutralises the parallax with
      // `transform: none !important` once a card is Flipped into a panel, so the
      // inline value is not what is being applied there.
      const cs = getComputedStyle(img);
      canvas.style.transform = cs.transform === "none" ? "" : cs.transform;
      canvas.style.transformOrigin = cs.transformOrigin;
    };

    /** Destination rect for the artwork, reproducing the image's object-fit. */
    const fit = (boxW: number, boxH: number) => {
      const iw = source.naturalWidth || source.width || boxW;
      const ih = source.naturalHeight || source.height || boxH;
      const boxAspect = boxW / boxH;
      const imgAspect = iw / ih;
      const contain = getComputedStyle(img).objectFit !== "cover";
      const wide = boxAspect > imgAspect;
      // contain letterboxes the short axis; cover overflows it.
      const fillHeight = contain ? wide : !wide;
      const w = fillHeight ? boxH * imgAspect : boxW;
      const h = fillHeight ? boxH : boxW / imgAspect;
      return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
    };

    const render = () => {
      if (!canvas || !ctx || !offCtx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const boxW = (img.offsetWidth || img.clientWidth) * dpr;
      const boxH = (img.offsetHeight || img.clientHeight) * dpr;
      if (!boxW || !boxH) return;

      const d = fit(boxW, boxH);
      const size = PX_FACTORS[Math.min(pxIndex, PX_FACTORS.length - 1)] * 0.01;

      // Downscale into an integer-sized offscreen canvas, then blow that up with
      // smoothing off — the blocks are the offscreen canvas's own pixels.
      const sw = Math.max(1, Math.round(d.w * size));
      const sh = Math.max(1, Math.round(d.h * size));
      off.width = sw;
      off.height = sh;
      offCtx.clearRect(0, 0, sw, sh);
      offCtx.imageSmoothingEnabled = true;
      offCtx.drawImage(source, 0, 0, sw, sh);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = size === 1;
      ctx.drawImage(off, 0, 0, sw, sh, d.x, d.y, d.w, d.h);
    };

    const sizeCanvas = () => {
      if (!canvas) return;
      const w = img.offsetWidth || img.clientWidth;
      const h = img.offsetHeight || img.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.left = `${img.offsetLeft}px`;
      canvas.style.top = `${img.offsetTop}px`;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      syncTransform();
    };

    /** Keep the canvas glued to the image while the parallax slides it.

        Only while the host is on screen. Every armed card used to run this
        every frame for as long as it sat waiting — a computed-style read per
        card per frame, for cards two viewports away with nothing to glue to.
        Traced on a throttled phone with the nav menu open over the hero, the
        gallery's cards were a tenth of the main thread. An off-screen canvas
        can drift; nobody sees it, and it is re-glued the frame it comes in. */
    const track = () => {
      if (destroyed || !canvas || !onScreen) {
        raf = 0;
        return;
      }
      syncTransform();
      raf = requestAnimationFrame(track);
    };
    const watch = () => {
      if (seen || typeof IntersectionObserver === "undefined") {
        if (!seen) onScreen = true;
        return;
      }
      seen = new IntersectionObserver(
        ([entry]) => {
          onScreen = entry.isIntersecting;
          if (onScreen && canvas) {
            syncTransform();
            if (!raf) raf = requestAnimationFrame(track);
          }
        },
        { rootMargin: "15%" },
      );
      seen.observe(host);
    };

    /** Put the blocks up over the picture. */
    const mount = () => {
      if (canvas) return true;
      const c = document.createElement("canvas");
      const c2d = c.getContext("2d");
      if (!c2d) return false;
      canvas = c;
      ctx = c2d;
      c.dataset.pixelCanvas = "";
      c.setAttribute("aria-hidden", "true");

      // Match useSplashHover: if the host isn't a containing block yet, make it
      // one rather than letting the overlay escape to some ancestor.
      if (getComputedStyle(host).position === "static") {
        host.style.position = "relative";
      }
      host.appendChild(c);
      sizeCanvas();
      render();

      // Only hide the picture once the blocks are actually painted, so a slow or
      // failed image load can never leave an empty hole where the icon was.
      img.style.visibility = "hidden";
      // Suppresses the hover splash's canvas for the duration — see gallery.css.
      host.dataset.pixelRunning = "";
      watch();
      if (onScreen && !raf) raf = requestAnimationFrame(track);
      return true;
    };

    /** Give the picture back to the <img> and take the canvas away. */
    const settle = () => {
      armed = false;
      playing = false;
      if (timer) clearTimeout(timer);
      timer = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      img.style.visibility = "";
      delete host.dataset.pixelRunning;
      canvas?.remove();
      canvas = null;
      ctx = null;
    };

    /** Back to blocks, ready to resolve again next time the icon is seen. */
    const arm = () => {
      if (destroyed) return;
      // Already sitting on blocks and waiting — nothing to do. A card that is
      // mid-reveal, though, must be RESET rather than left alone: `armed` stays
      // true while it plays, so early-returning on that let a card caught
      // mid-reveal by a fast scroll-away run its pending steps to completion and
      // end up sharp, so it never replayed on the way back.
      if (armed && !playing) return;
      // Never pixelate an open card, or anything while one is open — see
      // galleryOpen() for why the scroll position can't be trusted then.
      if (galleryOpen() || inPanel()) return;
      if (!source.complete || !source.naturalWidth) return;
      if (timer) clearTimeout(timer);
      timer = null;
      playing = false;
      pxIndex = 0;
      if (!mount()) return;
      render();
      armed = true;
      // Armed while already in view (nothing will cross to start it): go now.
      if (visible) play();
    };

    const step = () => {
      if (destroyed) return;
      pxIndex += 1;
      if (pxIndex >= PX_FACTORS.length) {
        settle();
        return;
      }
      render();
      timer = setTimeout(step, STEP_MS);
    };

    /** Resolve the blocks — ignored unless the icon is currently armed. */
    const play = () => {
      if (destroyed || !armed || playing) return;
      playing = true;
      timer = setTimeout(step, FIRST_STEP_MS);
    };

    source.onload = () => {
      if (destroyed) return;

      // ── Resolve on VISIBILITY, not on scroll crossings ──
      // The resolve used to fire only as the icon crossed a scroll position
      // (the ScrollTrigger below). On the phone and tablet layout the five
      // icons sit together in one sticky screen and travel SIDEWAYS, so every
      // icon's crossing is up at the start of the section: come back from
      // below into the middle of the row and the icons on screen stayed as
      // blocks until you scrolled all the way back to the start (measured:
      // icons 4 and 5 visible, canvas up, picture hidden), and a horizontal
      // slide can never cross a vertical line at all. A crossing can also be
      // skipped by a fast jump anywhere.
      //
      // An IntersectionObserver answers the question actually being asked —
      // is this icon on the screen? — in either axis and either direction,
      // clipped by the sticky screen the row slides inside. ANY of it, not a
      // fifth: at 20% an icon stopped at the screen's edge (measured, 14% and
      // 5% of it showing) sat there as a strip of blocks for as long as the
      // reader stayed, which is the stuck look this replaces. The ScrollTrigger
      // stays as the fallback where there is no observer.
      if (typeof IntersectionObserver !== "undefined") {
        playSeen = new IntersectionObserver(
          ([entry]) => {
            visible = entry.isIntersecting && entry.intersectionRatio > 0;
            if (visible) play();
          },
          { threshold: [0, 0.01, 0.2] },
        );
        playSeen.observe(host);
      }

      arm();

      // The demo's trigger: a little way into the element, so the blocks are
      // already on screen when they start resolving. Fires in both directions so
      // a re-armed icon resolves whether it is approached from above or below.
      revealTrigger = ScrollTrigger.create({
        trigger: host,
        start: "top+=20% bottom",
        onEnter: play,
        onEnterBack: play,
      });

      // Re-arm only when the viewport is well clear of the whole section. The
      // band is deliberately generous — it reaches a screen beyond the section
      // on either side — so scrolling around near the section's edges never
      // re-pixelates; only leaving for a neighbouring section does.
      //
      // Both bounds are absolute scroll positions rather than "bottom+=100%"
      // offsets, because the offset form quietly fails at the top of the page.
      // This section starts two viewports down, so "a screen of clearance above
      // it" computes to scroll position 0 — a position you can never scroll
      // PAST, so onLeaveBack could never fire and the effect only ever replayed
      // from below. Where the page can't offer a full screen of clearance, fall
      // back to the most it can: the section simply being off the screen.
      const section =
        host.closest<HTMLElement>('[data-section="gallery"]') ?? host;
      const sectionTop = () =>
        section.getBoundingClientRect().top + window.scrollY;
      const sectionBottom = () =>
        section.getBoundingClientRect().bottom + window.scrollY;

      rearmTrigger = ScrollTrigger.create({
        trigger: section,
        start: () => {
          const vh = window.innerHeight;
          const clear = sectionTop() - vh - vh; // a screen above the section
          return clear > 0 ? clear : Math.max(0, sectionTop() - vh);
        },
        end: () => sectionBottom() + window.innerHeight,
        invalidateOnRefresh: true,
        onLeave: arm, // gone well below the section
        onLeaveBack: arm, // gone well above it
      });

      ro = new ResizeObserver(() => {
        // Opening a card resizes this host from a grid cell to the panel. If the
        // blocks are still up at that moment — the icon was clicked before it
        // had resolved, or the re-arm caught it — hand the picture back at once
        // rather than showing the visitor a pixelated hero image.
        if ((armed || playing) && (galleryOpen() || inPanel())) {
          settle();
          return;
        }
        sizeCanvas();
        render();
      });
      ro.observe(img);
      ro.observe(host);
    };
    source.src = src;

    return () => {
      destroyed = true;
      revealTrigger?.kill();
      rearmTrigger?.kill();
      ro?.disconnect();
      seen?.disconnect();
      playSeen?.disconnect();
      source.onload = null;
      settle();
    };
  }, [ref, src, enabled]);
}
