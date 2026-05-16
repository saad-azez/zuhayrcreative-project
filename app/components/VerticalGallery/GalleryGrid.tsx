"use client";

import { forwardRef, memo, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { GalleryItem } from "./galleryData";
import { useScrollRevealText } from "./useScrollRevealText";
import { useScrollParallaxImage } from "./useScrollParallaxImage";

gsap.registerPlugin(useGSAP);

interface GalleryGridProps {
  items: GalleryItem[];
  onImageClick: (index: number, imageEl: HTMLElement) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * Editorial position presets — images frame the headline from the sides.
 * Images beyond slot count spill into a simple grid below.
 */
const SLOTS = [
  "top-left",
  "bottom-left",
  "right-top",
  "right-bottom",
  "mid-left",
  "mid-right",
] as const;

function getSlot(index: number): string {
  return SLOTS[index] || `extra-${index}`;
}

/** Per-card GSAP float — gentle y-axis drift with staggered phase */
function useCardFloat(selector: string) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const cards =
        containerRef.current?.querySelectorAll<HTMLElement>(selector);
      if (!cards || cards.length === 0) return;

      cards.forEach((card, i) => {
        gsap.to(card, {
          y: `${8 + (i % 3) * 6}px`,
          duration: 3.5 + (i % 4) * 0.7,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: i * 0.35,
        });
      });
    },
    { scope: containerRef },
  );

  return containerRef;
}

const GalleryGrid = memo(
  forwardRef<HTMLDivElement, GalleryGridProps>(function GalleryGrid(
    { items, onImageClick, onMouseEnter, onMouseLeave },
    ref,
  ) {
    const heroItems = items.slice(0, SLOTS.length);
    const extraItems = items.slice(SLOTS.length);
    const floatRef = useCardFloat('[data-float="card"]');

    // Scroll-driven text reveal on headline
    useScrollRevealText(".gallery_hero-headline");

    // Scroll-driven image parallax on all gallery images
    useScrollParallaxImage('[data-parallax="container"]');

    return (
      <div ref={ref} className="gallery_grid">
        {/* ── Hero editorial block ── */}
        <div ref={floatRef} className="gallery_hero">
          {/* Atmospheric gradient background */}
          <div className="gallery_hero-bg" />

          {/* Decorative blurred overlays */}
          <div className="gallery_hero-overlay gallery_hero-overlay--tl" />
          <div className="gallery_hero-overlay gallery_hero-overlay--br" />

          {/* Label */}
          <p className="gallery_hero-label">WE ARE HANA STUDIO</p>

          {/* Headline */}
          <div className="gallery_hero-text">
            <h1 className="gallery_hero-headline">
              Where design leads
              <br />
              engineering to deliver
              <br />
              precise, structured,
              <br />
              and seamless digital
              <br />
              experiences
            </h1>
          </div>

          {/* Images frame the headline from the sides */}
          <div className="gallery_hero-images-row">
            {heroItems.map((item, index) => {
              const slot = getSlot(index);
              return (
                <div
                  key={item.id}
                  className={`gallery_hero-image gallery_hero-image--${slot}`}
                  data-float="card"
                  data-gallery="image-wrapper"
                  data-item-id={item.id}
                  onClick={(e) => {
                    const wrapper = e.currentTarget;
                    const imageContainer = wrapper.querySelector<HTMLElement>(
                      '[data-gallery="image"]',
                    );
                    if (imageContainer) {
                      onImageClick(index, imageContainer);
                    }
                  }}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                >
                  {/* Blur overlay on faces for left-side images */}
                  {(slot === "top-left" || slot === "bottom-left") && (
                    <div className="gallery_hero-blur" />
                  )}
                  <div
                    className="image_container"
                    data-gallery="image"
                    data-parallax="container"
                  >
                    <img
                      src={item.src}
                      loading="lazy"
                      sizes="(max-width: 767px) 100vw, 33vw"
                      alt={item.alt}
                      srcSet={item.srcSet}
                      data-parallax="img"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Remaining images grid below ── */}
        {extraItems.length > 0 && (
          <div className="gallery_grid-extra">
            {extraItems.map((item, index) => {
              const realIndex = SLOTS.length + index;
              return (
                <div
                  key={item.id}
                  className="gallery_grid-item"
                  data-gallery="image-wrapper"
                  data-item-id={item.id}
                  onClick={(e) => {
                    const wrapper = e.currentTarget;
                    const imageContainer = wrapper.querySelector<HTMLElement>(
                      '[data-gallery="image"]',
                    );
                    if (imageContainer) {
                      onImageClick(realIndex, imageContainer);
                    }
                  }}
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
                      sizes="(max-width: 767px) 100vw, 50vw"
                      alt={item.alt}
                      srcSet={item.srcSet}
                      data-parallax="img"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }),
);

export default GalleryGrid;
