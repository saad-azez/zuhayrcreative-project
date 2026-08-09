"use client";

import { forwardRef, memo, useCallback, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { GalleryItem } from "./galleryData";
import { useScrollParallaxImage } from "./useScrollParallaxImage";
import { useSplashHover } from "../useSplashHover";
import { usePixelReveal } from "./usePixelReveal";

gsap.registerPlugin(ScrollTrigger);

/* ── Types ── */

interface GalleryGridProps {
  items: GalleryItem[];
  onImageClick: (index: number, imageEl: HTMLElement) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isTouch: boolean;
}

/* ── Shared image card ── */

interface ImageCardProps {
  item: GalleryItem;
  index: number;
  className: string;
  sizes: string;
  onClick: (index: number, el: HTMLElement) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const ImageCard = memo(function ImageCard({
  item,
  index,
  className,
  sizes,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: ImageCardProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const wrapper = e.currentTarget;
      const imageContainer = wrapper.querySelector<HTMLElement>(
        '[data-gallery="image"]',
      );
      if (imageContainer) onClick(index, imageContainer);
    },
    [index, onClick],
  );

  // Cursor splash, anchored on the image_container so the ripple canvas shares
  // the picture's exact box. Stays live in BOTH places: opening a card does
  // `wrapper.appendChild(imageEl)` on this very element (see
  // gallery-animations.ts), so the host — canvas and all — travels into the
  // content panel and the effect carries on there. The hook re-measures itself
  // whenever that move resizes it, so it is never left drawing at the old
  // grid-card size.
  const splashRef = useRef<HTMLDivElement>(null);
  useSplashHover(splashRef);

  // On-scroll pixelated reveal, mounted on this same parent div — the icon
  // resolves from a few big blocks to sharp as the row scrolls in. Shares the
  // host with the splash above: both lay a canvas over the <img> and leave the
  // markup alone, and the reveal keeps the splash's canvas out of the way while
  // it runs (see gallery.css).
  usePixelReveal(splashRef, item.src);

  return (
    <div
      className={className}
      data-gallery="image-wrapper"
      data-item-id={item.id}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        ref={splashRef}
        className="image_container overflow-hidden"
        data-gallery="image"
      >
        <img
          src={item.src}
          loading="lazy"
          sizes={sizes}
          alt={item.alt}
          srcSet={item.srcSet}
          data-parallax="img"
        />
      </div>
    </div>
  );
});

/* ── GalleryGrid ── */

const GalleryGrid = memo(
  forwardRef<HTMLDivElement, GalleryGridProps>(function GalleryGrid(
    { items, onImageClick, onMouseEnter, onMouseLeave, isTouch },
    ref,
  ) {
    const sectionRef = useRef<HTMLDivElement>(null);

    // ── Scroll-driven image parallax on gallery cards ──
    useScrollParallaxImage('[data-gallery="image"]', isTouch);

    // GSAP ScrollTrigger — scroll-driven highlight of the background text.
    // Desktop: the text is PINNED on screen and the lines fill one-after-another
    // as the section scrolls. Touch/small screens: no pin (mobile pinning is
    // janky and the layout stacks), just scrub the same fill as the headline
    // passes through the viewport — so the text still highlights on scroll.
    useEffect(() => {
      // Reduced-motion users get the statically-filled text via CSS (see
      // gallery.css) — don't run the scroll animation for them.
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }
      const section = sectionRef.current;
      if (!section) return;

      const ctx = gsap.context(() => {
        const pinWrap = section.querySelector<HTMLElement>(".gallery-pin-wrap");
        const headline = section.querySelector<HTMLElement>(
          ".gallery_bg-headline",
        );
        if (!pinWrap || !headline) return;

        const lines = headline.querySelectorAll<HTMLElement>(".line");
        if (lines.length === 0) return;

        // ── Init: dim + pushed down ──
        gsap.set(lines, {
          backgroundSize: "0%",
          y: 30,
        });

        if (isTouch) {
          // Mobile: no pin. Ends at "top 35%" so the reveal finishes while
          // the text is still in view.
          const tl = gsap.timeline({
            scrollTrigger: {
              id: "gallery-bg-reveal",
              trigger: headline,
              start: "top 80%",
              end: "top 35%",
              scrub: 0.8,
            },
          });
          lines.forEach((line, i) => {
            tl.to(
              line,
              { backgroundSize: "100%", y: 0, ease: "none", duration: 1 },
              i,
            );
          });
          return;
        }

        // ── Desktop: pin only long enough to complete the reveal, then
        // release. pinSpacing:true keeps the image rows below the text. ──
        const pinEnd = () =>
          "+=" + Math.round((window.innerHeight || 800) * 1.1);
        ScrollTrigger.create({
          id: "gallery-pin",
          trigger: pinWrap,
          start: "top top",
          end: pinEnd,
          pin: pinWrap,
          pinSpacing: true,
        });

        // ── Sequential reveal: each line fills in its own segment ──
        const tl = gsap.timeline({
          scrollTrigger: {
            id: "gallery-bg-reveal",
            trigger: pinWrap,
            start: "top top",
            end: pinEnd,
            scrub: 0.8,
          },
        });
        lines.forEach((line, i) => {
          tl.to(
            line,
            { backgroundSize: "100%", y: 0, ease: "none", duration: 1 },
            i, // sequential, non-overlapping segments (line 0, then 1, then 2)
          );
        });
        // Hold the lit text for the last stretch of the pin.
        tl.to({}, { duration: 1 });
      }, section);

      return () => ctx.revert();
    }, [isTouch]);

    // Merge forwarded ref + local ref for ScrollTrigger
    const mergedRef = useCallback(
      (node: HTMLDivElement | null) => {
        (sectionRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
        if (typeof ref === "function") ref(node);
        else if (ref)
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    return (
      <div
        ref={mergedRef}
        className="w-full relative pt-[12vh] pb-[12vh]"
        data-section="gallery"
      >
        {/* ═══════════════════════════════════════════════════════
            Background layer — GSAP ScrollTrigger pin
            Pinned on screen while section scrolls; z-0 behind images
            ═══════════════════════════════════════════════════════ */}
        {/* z-20 puts the pinned paragraph IN FRONT of the image rows (z-10) so
            its `mix-blend-mode: difference` glyphs invert against each image
            they overlap (see gallery.css). Stays pointer-events-none, so the
            images underneath remain clickable. */}
        <div className="gallery-pin-wrap w-full h-screen flex items-center justify-center overflow-hidden pointer-events-none z-20">
          <h1
            aria-hidden="true"
            className="gallery_bg-headline select-none text-center leading-[1.15] tracking-[-0.02em] font-light"
            style={{
              fontSize: "clamp(1.5rem, 4vw, 5rem)",
            }}
          >
            <span className="line">Where design leads</span>
            <br />
            <span className="line">engineering to deliver</span>
            <br />
            <span className="line">seamless digital experiences.</span>
          </h1>

          {/* Click-to-expand hint — tells the user the surrounding images open.
              Kept out of the blended <h1> so it stays plainly legible, and
              pinned near the bottom so it holds on screen through the section. */}
          <div className="gallery-hint" aria-hidden="true">
            <span className="gallery-hint__dot" />
            Click any image to expand
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            Foreground — alternating image rows
            Scroll normally; pinned text overlays via z-index
            ═══════════════════════════════════════════════════════ */}
        <div className="relative z-10" data-rows-container>
          {items.map((item, i) => {
            const isEven = i % 2 === 0;

            return (
              <div
                key={item.id}
                data-row
                className={`flex items-center min-h-[35vh] px-[5vw] gap-[2vw] py-[3vh]
                  max-md:min-h-[24vh] max-md:gap-[4vw] max-md:px-[6vw] max-md:py-[4vh]
                  ${isEven ? "flex-row" : "flex-row-reverse"}`}
              >
                {/* ── Label ──
                    Stays a column (number over title) and keeps its alternating
                    edge alignment at every width, so it reads as a pair with the
                    icon beside it rather than a caption stacked above it. */}
                <div
                  data-row-label
                  className={`shrink-0 flex flex-col gap-1
                    ${isEven ? "items-start text-left pr-[2vw] max-md:pr-0" : "items-end text-right pl-[2vw] max-md:pl-0"}`}
                >
                  <span className="text-[0.6rem] tracking-[0.35em] uppercase text-foreground-subtle font-mono">
                    [{String(i + 1).padStart(2, "0")}]
                  </span>
                  <span className="text-[clamp(0.75rem,1vw,1rem)] font-semibold text-foreground-muted leading-tight tracking-wide uppercase max-w-[14ch]">
                    {item.titleTop}
                  </span>
                </div>

                {/* ── Image ── */}
                <ImageCard
                  item={item}
                  index={i}
                  className="gallery_hero-image shrink-0 cursor-pointer overflow-hidden pointer-events-auto
                    w-[clamp(200px,30vw,400px)] aspect-3/2
                    max-md:w-[48vw]"
                  sizes="(max-width: 767px) 48vw, 32vw"
                  onClick={onImageClick}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }),
);

export default GalleryGrid;
