"use client";

import { forwardRef, memo } from "react";
import type { GalleryItem } from "./galleryData";

interface GalleryGridProps {
  items: GalleryItem[];
  onImageClick: (index: number, imageEl: HTMLElement) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const GalleryGrid = memo(
  forwardRef<HTMLDivElement, GalleryGridProps>(function GalleryGrid(
    { items, onImageClick, onMouseEnter, onMouseLeave },
    ref,
  ) {
    return (
      <div ref={ref} className="gallery_grid">
        {items.map((item, index) => (
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
                onImageClick(index, imageContainer);
              }
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            <div className="image_container" data-gallery="image">
              <img
                src={item.src}
                loading="lazy"
                sizes="(max-width: 767px) 100vw, 50vw"
                alt={item.alt}
                srcSet={item.srcSet}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }),
);

export default GalleryGrid;
