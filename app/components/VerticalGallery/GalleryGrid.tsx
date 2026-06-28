"use client";

import { forwardRef, memo, useCallback, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { GalleryItem } from "./galleryData";
import { useScrollParallaxImage } from "./useScrollParallaxImage";

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

  return (
    <div
      className={className}
      data-gallery="image-wrapper"
      data-item-id={item.id}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="image_container overflow-hidden" data-gallery="image">
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

    // GSAP ScrollTrigger — pin the background text + fill reveal on scroll (desktop only)
    useEffect(() => {
      if (isTouch) return;
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

        // ── Pin: text stays locked on screen while section scrolls ──
        ScrollTrigger.create({
          id: "gallery-pin",
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          pin: pinWrap,
          pinSpacing: false,
        });

        // ── Init: dim + pushed down ──
        gsap.set(lines, {
          backgroundSize: "0%",
          y: 30,
        });

        // ── Sequential reveal: ONE scrubbed timeline tied to the pinned
        // scroll. Each line fully fills (and lifts) in its own segment before
        // the next begins, so the lines highlight one-after-another in sync
        // with scroll — not all at once. The reveal finishes a little before
        // the section unpins so the full text holds for a beat. ──
        const tl = gsap.timeline({
          scrollTrigger: {
            id: "gallery-bg-reveal",
            trigger: section,
            start: "top top",
            end: "bottom-=20% bottom",
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
        <div className="gallery-pin-wrap w-full h-screen flex items-center justify-center overflow-hidden pointer-events-none z-0">
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
                  max-md:flex-col max-md:min-h-0 max-md:gap-[3vh] max-md:px-[6vw] max-md:py-[5vh]
                  ${isEven ? "flex-row" : "flex-row-reverse"}`}
              >
                {/* ── Label ── */}
                <div
                  data-row-label
                  className={`shrink-0 flex flex-col gap-1
                    max-md:flex-row max-md:items-baseline max-md:gap-3 max-md:w-full
                    ${isEven ? "items-start text-left pr-[2vw]" : "items-end text-right pl-[2vw] max-md:items-start max-md:text-left max-md:pl-0"}`}
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
                    max-md:w-full max-md:aspect-3/2"
                  sizes="(max-width: 767px) 100vw, 32vw"
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
