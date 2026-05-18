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

function getSlotClass(index: number): string {
  const slot = SLOTS[index];
  return slot
    ? `gallery_hero-image--${slot}`
    : `gallery_hero-image--extra-${index}`;
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
      <div ref={ref} className="gallery_grid">
        {/* ── Hero editorial block ── */}
        <div ref={floatRef} className="gallery_hero">
          <p className="gallery_hero-label">WE ARE HANA STUDIO</p>

          <div className="gallery_hero-text">
            <h1 className="gallery_hero-headline">
              <span className="line">Where design leads</span>
              <span className="line">engineering to deliver</span>
              <span className="line">precise, structured,</span>
              <span className="line">and seamless digital</span>
              <span className="line">experiences</span>
            </h1>
          </div>

          <div className="gallery_hero-images-row">
            {heroItems.map((item, index) => (
              <ImageCard
                key={item.id}
                item={item}
                index={index}
                className={`gallery_hero-image ${getSlotClass(index)}`}
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
          <div className="gallery_grid-extra">
            {extraItems.map((item, index) => {
              const realIndex = SLOTS.length + index;
              return (
                <ImageCard
                  key={item.id}
                  item={item}
                  index={realIndex}
                  className="gallery_grid-item"
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
