"use client";

import { forwardRef, memo, useCallback, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { GalleryItem } from "./galleryData";
import { useRowReveal } from "./useScrollCinematic";

gsap.registerPlugin(ScrollTrigger);

/* ── Types ── */

interface GalleryGridProps {
  items: GalleryItem[];
  onImageClick: (index: number, imageEl: HTMLElement) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
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
      <div className="image_container" data-gallery="image">
        <img
          src={item.src}
          loading="lazy"
          sizes={sizes}
          alt={item.alt}
          srcSet={item.srcSet}
        />
      </div>
    </div>
  );
});

/* ── GalleryGrid ── */

const GalleryGrid = memo(
  forwardRef<HTMLDivElement, GalleryGridProps>(function GalleryGrid(
    { items, onImageClick, onMouseEnter, onMouseLeave },
    ref,
  ) {
    const sectionRef = useRef<HTMLDivElement>(null);

    // Row scroll reveals
    useRowReveal("[data-row]");

    // GSAP ScrollTrigger — pin the background text + fill reveal on scroll
    useEffect(() => {
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

        // ── Scrub: background-clip:text fill reveal ──
        gsap.set(lines, { backgroundSize: "0%" });

        gsap
          .timeline({
            scrollTrigger: {
              id: "gallery-bg-text",
              trigger: section,
              start: "top top",
              end: "bottom+=30% bottom",
              scrub: 0.6,
            },
          })
          .to(lines, {
            backgroundSize: "100%",
            ease: "none",
            stagger: 0.12,
          });
      }, section);

      return () => ctx.revert();
    }, []);

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
      <div ref={mergedRef} className="w-full relative" data-section="gallery">
        {/* ═══════════════════════════════════════════════════════
            Background layer — GSAP ScrollTrigger pin
            Pinned on screen while section scrolls; z-0 behind images
            ═══════════════════════════════════════════════════════ */}
        <div className="gallery-pin-wrap w-full h-screen flex items-center justify-center overflow-hidden pointer-events-none z-0">
          <h1
            aria-hidden="true"
            className="gallery_bg-headline select-none text-center leading-[0.8] tracking-[-0.03em] "
            style={{
              fontSize: "clamp(2rem, 6vw, 8rem)",
              fontWeight: 900,
            }}
          >
            <span className="line">Where design leads</span>
            <br />
            <span className="line">engineering to deliver</span>
            <br />
            <span className="line">precise, structured,</span>
            <br />
            <span className="line">and seamless digital</span>
            <br />
            <span className="line">experiences.</span>
          </h1>
        </div>

        {/* ═══════════════════════════════════════════════════════
            Foreground — alternating image rows
            Scroll normally; pinned text overlays via z-index
            ═══════════════════════════════════════════════════════ */}
        <div className="relative z-10 pb-[15vh]" data-rows-container>
          {items.map((item, i) => {
            const isEven = i % 2 === 0;

            return (
              <div
                key={item.id}
                data-row
                className={`flex items-center min-h-[55vh] px-[5vw] gap-[3vw] py-[8vh]
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
                  <span className="text-[0.6rem] tracking-[0.35em] uppercase text-white/30 font-mono">
                    [{String(i + 1).padStart(2, "0")}]
                  </span>
                  <span className="text-[clamp(0.75rem,1vw,1rem)] font-semibold text-white/70 leading-tight tracking-wide uppercase max-w-[14ch]">
                    {item.titleTop}
                  </span>
                </div>

                {/* ── Image ── */}
                <ImageCard
                  item={item}
                  index={i}
                  className="gallery_hero-image shrink-0 cursor-pointer overflow-hidden pointer-events-auto
                    transition-transform duration-700 ease-out will-change-transform
                    hover:scale-[1.02]
                    w-[clamp(260px,42vw,620px)] aspect-4/5
                    max-md:w-full max-md:aspect-4/5"
                  sizes="(max-width: 767px) 100vw, 45vw"
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
