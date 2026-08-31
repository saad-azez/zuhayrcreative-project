"use client";

import { useEffect, useRef } from "react";

/**
 * The Club — an endless horizontal strip of images that grows exponentially
 * from left to right, dragged or swiped rather than scrolled.
 *
 * Each slide's left edge sits at `minSize * (ratio^n − 1) / (ratio − 1)` of the
 * strip's width, so every slide is a fixed multiple wider than the one before
 * it. That single curve does all the work: slides enter as slivers at the left,
 * swell as they travel, and leave at full width on the right. A slide that
 * falls off either end is re-indexed to the other and re-pointed at whichever
 * image belongs there, so a handful of elements covers an infinite run.
 */

const CONFIG = {
  /** How many distinct images the strip cycles through. */
  totalSlides: 10,
  /** Follow rate toward the scroll target — lower is heavier. */
  lerp: 0.075,
  scrollSpeed: 3.5,
  /** Width of the narrowest slide, as a fraction of the strip. */
  minSize: 0.1,
  /** Exponential growth per slide. */
  growth: 0.25,
  /** Slide aspect (portrait). */
  aspect: 1 / 1.25,
};

const GROWTH_RATIO = Math.exp(CONFIG.growth);

/**
 * Enough slides to span the strip plus a margin either side, so one is always
 * ready to enter and none pops in mid-view. Derived rather than guessed: the
 * log is how many growth steps it takes to get from `minSize` to full width.
 */
const SLIDE_COUNT =
  Math.ceil(
    Math.log(1 + (GROWTH_RATIO - 1) / CONFIG.minSize) / CONFIG.growth,
  ) + 4;

const wrap = (value: number, max: number) => ((value % max) + max) % max;

/** Left edge of the slide at stream position `n`, in px. */
const edgeX = (position: number, width: number) =>
  (width * CONFIG.minSize * (Math.pow(GROWTH_RATIO, position) - 1)) /
  (GROWTH_RATIO - 1);

const srcFor = (streamIndex: number) =>
  `/club/slide-${wrap(streamIndex, CONFIG.totalSlides) + 1}.jpg`;

export default function ClubSlider() {
  const sliderRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    const streamIndex = Array.from({ length: SLIDE_COUNT }, (_, i) => i);
    let scroll = 0;
    let scrollTarget = 0;
    let raf = 0;
    let lastScroll = NaN;
    let lastW = 0;
    let lastH = 0;

    // ── Input ────────────────────────────────────────────────────────────────
    // Pointer events only: they cover mouse, pen and touch in one path, and
    // `touch-action: pan-y` on the strip (see the JSX) leaves vertical gestures
    // to the browser, so a phone can still scroll down to the footer.
    let lastPointerX: number | null = null;

    const onPointerDown = (e: PointerEvent) => {
      lastPointerX = e.clientX;
      slider.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (lastPointerX === null) return;
      scrollTarget += (lastPointerX - e.clientX) * CONFIG.scrollSpeed * -0.005;
      lastPointerX = e.clientX;
    };
    const releasePointer = (e: PointerEvent) => {
      lastPointerX = null;
      if (slider.hasPointerCapture?.(e.pointerId)) {
        slider.releasePointerCapture(e.pointerId);
      }
    };

    /**
     * Only the HORIZONTAL axis of the wheel drives the strip.
     *
     * The reference swallows the wheel outright, which it can afford — it is
     * the whole page. Here the shared footer sits below this section, and a
     * strip that ate every wheel event would make it unreachable. Taking only
     * the dominant-horizontal gesture means a trackpad swipe moves the strip
     * while a plain scroll still travels down the page; a mouse drags instead.
     */
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      scrollTarget += e.deltaX * CONFIG.scrollSpeed * 0.0014;
    };

    slider.addEventListener("pointerdown", onPointerDown);
    slider.addEventListener("pointermove", onPointerMove);
    slider.addEventListener("pointerup", releasePointer);
    slider.addEventListener("pointercancel", releasePointer);
    slider.addEventListener("wheel", onWheel, { passive: false });

    // ── Layout ───────────────────────────────────────────────────────────────
    const render = () => {
      raf = requestAnimationFrame(render);

      scroll += (scrollTarget - scroll) * CONFIG.lerp;
      // Snap once the gap is sub-perceptual, so the loop can go genuinely idle
      // instead of chasing an asymptote and rewriting identical styles forever.
      if (Math.abs(scrollTarget - scroll) < 0.0001) scroll = scrollTarget;

      const width = slider.clientWidth;
      const height = slider.clientHeight;
      if (scroll === lastScroll && width === lastW && height === lastH) return;
      lastScroll = scroll;
      lastW = width;
      lastH = height;

      for (let i = 0; i < SLIDE_COUNT; i++) {
        const slide = slideRefs.current[i];
        if (!slide) continue;

        let n = streamIndex[i];
        // Re-index a slide that has run off either end to the far side, so the
        // same few elements cover an endless strip.
        while (edgeX(n + scroll, width) > width) n -= SLIDE_COUNT;
        while (edgeX(n + scroll + 1, width) < 0) n += SLIDE_COUNT;
        streamIndex[i] = n;

        const left = Math.round(edgeX(n + scroll, width));
        const right = Math.round(edgeX(n + scroll + 1, width));
        const w = right - left;

        const img = slide.firstElementChild as HTMLImageElement | null;
        const src = srcFor(n);
        // Guarded: assigning the same src still restarts a decode in some
        // engines, and this runs every frame.
        if (img && img.getAttribute("src") !== src) img.setAttribute("src", src);

        slide.style.width = `${w}px`;
        slide.style.height = `${w / CONFIG.aspect}px`;
        // Wider slides are nearer, so they stack on top.
        slide.style.zIndex = `${Math.round(right)}`;
        slide.style.transform = `translate(${left}px, 0px)`;
      }
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      slider.removeEventListener("pointerdown", onPointerDown);
      slider.removeEventListener("pointermove", onPointerMove);
      slider.removeEventListener("pointerup", releasePointer);
      slider.removeEventListener("pointercancel", releasePointer);
      slider.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <section
      ref={sliderRef}
      aria-label="The Club"
      className="relative isolate h-dvh w-full cursor-grab overflow-hidden active:cursor-grabbing"
      // pan-y, not none: the browser keeps vertical gestures so the page can
      // still be scrolled down to the footer on a touch device.
      //
      // `isolate` is load-bearing, not tidiness. The slides below are given a
      // z-index derived from their PIXEL position (see the render loop) and the
      // heading sits at z-[999]; `relative` alone does not open a stacking
      // context, so all of those competed directly with the rest of the page.
      // They outranked the nav's fullscreen menu at z-90, and opening the menu
      // on this route left the slider images and the "The Club" heading painted
      // straight over it. Isolating the section keeps its private numbering
      // private and lets it sit, as one layer, wherever the page puts it.
      style={{ touchAction: "pan-y" }}
    >
      {Array.from({ length: SLIDE_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            slideRefs.current[i] = el;
          }}
          className="absolute bottom-0 left-0 overflow-hidden will-change-transform"
        >
          {/* A plain <img>: the src is re-pointed every time a slide wraps to
              the other end of the strip, which next/image is not built for.
              Rendered with the slide's starting image so nothing is blank on
              the first frame. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={srcFor(i)}
            alt=""
            draggable={false}
            className="pointer-events-none block h-full w-full object-cover"
          />
        </div>
      ))}

      <div className="pointer-events-none absolute left-6 top-24 z-[999] md:left-12 md:top-28">
        <h1
          className="max-w-[12ch] text-[clamp(2.5rem,5vw,6rem)] font-medium uppercase leading-[0.95] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Club
        </h1>
        <p
          className="mt-4 max-w-[28ch] text-[0.7rem] uppercase tracking-[0.28em] text-white/70"
          style={{ fontFamily: "var(--font-hint)" }}
        >
          Drag to explore
        </p>
      </div>
    </section>
  );
}
