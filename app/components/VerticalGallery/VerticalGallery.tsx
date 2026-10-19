"use client";

import { useRef } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import GalleryGrid from "./GalleryGrid";
import ContentPanel from "./ContentPanel";
import { galleryData } from "./galleryData";
import { useGalleryState } from "./useGalleryState";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import "@/app/styles/gallery.css";

gsap.registerPlugin(Flip);

/**
 * VerticalGallery — cinematic alternating-row gallery with GSAP Flip transitions.
 *
 * On mobile/touch devices: cursor hidden, simplified interactions.
 * On desktop: full cinematic experience with custom cursor and Flip animations.
 */
export default function VerticalGallery() {
  const sectionContentRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { isTouch, isDesktop, prefersReducedMotion } = useDeviceDetect();
  // Must match the modal's breakpoint in gallery.css.
  const enableHeavyAnimations = isDesktop && !isTouch && !prefersReducedMotion;

  const [state, actions] = useGalleryState({
    sectionContentRef,
    gridRef,
    galleryItems: galleryData,
    enableHeavyAnimations,
  });

  const { activeIndex } = state;
  const { open, close, showCursor, hideCursor, registerSplits } = actions;

  return (
    <div className="min-h-screen relative">
      <GalleryGrid
        ref={gridRef}
        items={galleryData}
        onImageClick={open}
        onMouseEnter={isTouch ? () => {} : showCursor}
        onMouseLeave={isTouch ? () => {} : hideCursor}
        isTouch={isTouch}
        /* 1024px and up — the same breakpoint this section already draws for
           its lightbox (enableHeavyAnimations above, and the modal's media
           query in gallery.css). The grid needs it as well as isTouch: the
           pinned headline the process rows fly across is a WIDE-screen
           device, and a window at phone or tablet width is not touch, so on
           that test alone it kept the pin and ran the rows straight through
           the paragraph. One breakpoint for the whole section. */
        isDesktop={isDesktop}
      />

      {/* Content overlay — click background to close */}
      <div
        ref={sectionContentRef}
        className="section_content is-hidden"
        data-content="section"
        onClick={close}
      >
        {/* Shared close button — hidden by CSS unless the overlay is active. */}
        <button
          type="button"
          className="content_close"
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
        >
          <span aria-hidden>×</span>
        </button>
        {galleryData.map((item, index) => (
          <ContentPanel
            key={item.id}
            item={item}
            isHidden={activeIndex !== index}
            onWrapperClick={() => {
              if (activeIndex === index) close();
            }}
            onMouseEnter={isTouch ? () => {} : showCursor}
            onMouseLeave={isTouch ? () => {} : hideCursor}
            onSplitsReady={(splits) => registerSplits(index, splits)}
            isTouch={isTouch}
          />
        ))}
      </div>
    </div>
  );
}
