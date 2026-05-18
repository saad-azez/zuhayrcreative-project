"use client";

import { useRef } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import GalleryGrid from "./GalleryGrid";
import ContentPanel from "./ContentPanel";
import CustomCursor from "./CustomCursor";
import { galleryData } from "./galleryData";
import { useGalleryState } from "./useGalleryState";
import "./gallery.css";

gsap.registerPlugin(Flip);

/**
 * VerticalGallery — editorial image grid with GSAP Flip transitions.
 *
 * Architecture:
 * - State & animation orchestration → useGalleryState
 * - Pure GSAP animation functions → gallery-animations.ts
 * - SplitType utility → splitText.ts
 * - Scroll effects → useScrollParallaxImage / useScrollRevealText (in GalleryGrid)
 * - Cursor tracking → useCursorPosition (in CustomCursor)
 */
export default function VerticalGallery() {
  const sectionContentRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [state, actions] = useGalleryState({
    sectionContentRef,
    gridRef,
    galleryItems: galleryData,
  });

  const { activeIndex, cursorVisible, cursorOpen } = state;
  const { open, close, showCursor, hideCursor, registerSplits } = actions;

  return (
    <div
      className="vertical-gallery"
      style={{ minHeight: "100vh", position: "relative" }}
    >
      <CustomCursor isVisible={cursorVisible} isOpen={cursorOpen} />

      <GalleryGrid
        ref={gridRef}
        items={galleryData}
        onImageClick={open}
        onMouseEnter={showCursor}
        onMouseLeave={hideCursor}
      />

      {/* Content overlay — click background to close */}
      <div
        ref={sectionContentRef}
        className="section_content is-hidden"
        data-content="section"
        onClick={close}
      >
        {galleryData.map((item, index) => (
          <ContentPanel
            key={item.id}
            item={item}
            isHidden={activeIndex !== index}
            onWrapperClick={() => {
              if (activeIndex === index) close();
            }}
            onMouseEnter={showCursor}
            onMouseLeave={hideCursor}
            onSplitsReady={(splits) => registerSplits(index, splits)}
          />
        ))}
      </div>
    </div>
  );
}
