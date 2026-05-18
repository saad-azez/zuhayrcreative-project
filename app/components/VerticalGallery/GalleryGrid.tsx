"use client";

import { forwardRef, memo, useCallback } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { GalleryItem } from "./galleryData";
import { useScrollRevealText } from "./useScrollRevealText";
import { useScrollParallaxImage } from "./useScrollParallaxImage";
import { useCardFloat } from "./useCardFloat";

gsap.registerPlugin(useGSAP);

/* ── Types ── */

interface GalleryGridProps {
  items: GalleryItem[];
  onImageClick: (index: number, imageEl: HTMLElement) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/* ── Slot presets ── */

const SLOTS = [
  "top-left",
  "bottom-left",
  "right-top",
  "right-bottom",
  "mid-left",
  "mid-right",
] as const;

/** Tailwind classes for each hero image slot position */
const SLOT_CLASSES: Record<string, string> = {
  "top-left":
    "top-[12%] left-[6%] w-[13vw] aspect-[3/4] max-md:top-auto max-md:left-auto max-md:w-[40vw] max-md:aspect-[3/4]",
  "bottom-left":
    "bottom-[10%] left-[8%] w-[12vw] aspect-[3/4] max-md:bottom-auto max-md:left-auto max-md:w-[40vw] max-md:aspect-[3/4]",
  "right-top":
    "top-[8%] right-[6%] w-[18vw] aspect-[4/3] max-md:top-auto max-md:right-auto max-md:w-[40vw] max-md:aspect-[3/4]",
  "right-bottom":
    "bottom-[12%] right-[8%] w-[14vw] aspect-square max-md:bottom-auto max-md:right-auto max-md:w-[40vw] max-md:aspect-[3/4]",
  "mid-left":
    "top-[45%] left-[3%] w-[10vw] aspect-[3/4] max-md:top-auto max-md:left-auto max-md:w-[40vw] max-md:aspect-[3/4]",
  "mid-right":
    "top-[42%] right-[3%] w-[11vw] aspect-[3/4] max-md:top-auto max-md:right-auto max-md:w-[40vw] max-md:aspect-[3/4]",
};

function getSlotClass(index: number): string {
  const slot = SLOTS[index];
  return slot ? SLOT_CLASSES[slot] : "";
}

/* ── Shared image element ── */

interface ImageCardProps {
  item: GalleryItem;
  index: number;
  className: string;
  sizes: string;
  /** If true, adds data-float="card" for the floating animation */
  float?: boolean;
  onClick: (index: number, el: HTMLElement) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const ImageCard = memo(function ImageCard({
  item,
  index,
  className,
  sizes,
  float = false,
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
      data-float={float ? "card" : undefined}
      data-gallery="image-wrapper"
      data-item-id={item.id}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="image_container"
        data-gallery="image"
        data-parallax="container"
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
    { items, onImageClick, onMouseEnter, onMouseLeave },
    ref,
  ) {
    const heroItems = items.slice(0, SLOTS.length);
    const extraItems = items.slice(SLOTS.length);
    const floatRef = useCardFloat('[data-float="card"]');

    // Scroll-driven effects
    useScrollRevealText(".gallery_hero-headline");
    useScrollParallaxImage('[data-parallax="container"]');

    return (
      <div ref={ref} className="w-full">
        {/* ── Hero editorial block ── */}
        <div
          ref={floatRef}
          className="relative min-h-screen flex items-center justify-center overflow-hidden isolate max-md:flex-col max-md:justify-start max-md:pt-[15vh]"
        >
          <p className="absolute top-[clamp(2rem,5vh,4rem)] left-1/2 -translate-x-1/2 z-3 font-['Generalsans','Tahoma',sans-serif] text-[clamp(0.7rem,0.9vw,1.1rem)] font-semibold tracking-[0.25em] uppercase text-white/55 max-md:top-[clamp(1rem,3vh,2rem)]">
            WE ARE HANA STUDIO
          </p>

          <div className="relative z-2 text-center max-w-[55vw] pointer-events-none max-md:max-w-[90vw]">
            <h1 className="gallery_hero-headline font-['Generalsans','Tahoma',sans-serif] text-[clamp(2.2rem,4.5vw,5.5rem)] font-bold leading-[1.05] m-0 flex flex-col max-md:text-[clamp(1.8rem,6vw,2.6rem)]">
              <span className="line">Where design leads</span>
              <span className="line">engineering to deliver</span>
              <span className="line">precise, structured,</span>
              <span className="line">and seamless digital</span>
              <span className="line">experiences</span>
            </h1>
          </div>

          <div className="absolute inset-0 z-2 pointer-events-none max-md:relative max-md:flex max-md:flex-wrap max-md:justify-center max-md:gap-[2vw] max-md:py-[4vh] max-md:px-[4vw] max-md:pb-[8vh] max-md:inset-auto">
            {heroItems.map((item, index) => (
              <ImageCard
                key={item.id}
                item={item}
                index={index}
                className={`gallery_hero-image absolute z-2 cursor-pointer overflow-hidden transition-transform duration-500 pointer-events-auto hover:scale-[1.04] hover:z-10 ${getSlotClass(index)}`}
                sizes="(max-width: 767px) 100vw, 33vw"
                float
                onClick={onImageClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
              />
            ))}
          </div>
        </div>

        {/* ── Extra grid below hero ── */}
        {extraItems.length > 0 && (
          <div className="grid grid-cols-2 gap-[7.5vw] w-full max-w-350 mx-auto px-[5vw] pb-[20vh]">
            {extraItems.map((item, index) => {
              const realIndex = SLOTS.length + index;
              return (
                <ImageCard
                  key={item.id}
                  item={item}
                  index={realIndex}
                  className="aspect-square cursor-pointer w-full h-auto overflow-hidden relative odd:translate-y-[10%] even:translate-y-[-10%]"
                  sizes="(max-width: 767px) 100vw, 50vw"
                  onClick={onImageClick}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }),
);

export default GalleryGrid;
