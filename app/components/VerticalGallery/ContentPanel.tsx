"use client";

import { useEffect, useRef } from "react";
import { memo } from "react";
import type { GalleryItem } from "./galleryData";
import { createSplits, type GallerySplits } from "./splitText";

interface ContentPanelProps {
  item: GalleryItem;
  isHidden: boolean;
  onWrapperClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onSplitsReady: (splits: GallerySplits) => void;
  isTouch: boolean;
}

/**
 * Single content panel — renders editorial text and hosts the image
 * (moved here via GSAP Flip from the gallery grid).
 *
 * On mobile: simplified layout with stacked text, smaller wrapper.
 */
const ContentPanel = memo(function ContentPanel({
  item,
  isHidden,
  onWrapperClick,
  onMouseEnter,
  onMouseLeave,
  onSplitsReady,
  isTouch,
}: ContentPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || initializedRef.current) return;

    const splits = createSplits(el);
    initializedRef.current = true;
    onSplitsReady(splits);
  }, [onSplitsReady]);

  return (
    <div
      ref={contentRef}
      className={`content absolute inset-0 flex justify-center items-center w-full h-screen${isHidden ? " is-hidden" : ""}`}
      data-content="details"
      data-content-id={item.id}
    >
      {/* Desktop layout — hosts the SplitType targets + Flip-moved image. */}
      <div
        className={`content_wrapper pointer-events-auto cursor-pointer${isTouch ? " w-[90vw] max-w-lg" : " w-[50vw]"}`}
        data-content="details-wrapper"
        onClick={(e) => {
          e.stopPropagation();
          onWrapperClick();
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Titles sit fully outside the image box so they never cross it. */}
        <div
          className="content_title-top flex justify-start items-center w-[105%] ml-[2em] absolute bottom-[calc(100%+0.6rem)]"
          data-content="text-top"
        >
          <div className="title-big">{item.titleTop}</div>
        </div>
        <div
          className="content_title-bottom flex justify-end items-center w-[105%] ml-[2em] absolute top-[calc(100%+0.6rem)] left-0"
          data-content="text-bottom"
        >
          <div className="title-big">{item.titleBottom}</div>
        </div>
        <div
          className="content_text-left flex flex-col gap-1 text-right justify-end items-end w-[17vw] h-full pt-[2.5em] pb-[2.5em] pr-[1em] absolute right-full"
          data-content="text-left"
        >
          <div className="title-small">{item.textLeftTitle}</div>
          <div className="paragraph">{item.textLeftDesc}</div>
        </div>
        <div
          className="content_text-right flex flex-col gap-2 w-[17vw] h-full pt-[2.5em] pb-[2.5em] pl-[1em] absolute left-full"
          data-content="text-right"
        >
          <div className="title-small">{item.textRightTitle}</div>
          <div className="paragraph">{item.textRightDesc}</div>
        </div>
        {/* Desktop: the grid image is moved here via GSAP Flip on open. */}
      </div>

      {/* Compact modal — image on top, copy below. The image box is a Flip
          target like the desktop wrapper, so both open the same way. */}
      <div className="content_mobile">
        <div
          className="content_mobile-card"
          data-content="mobile-wrapper"
          onClick={(e) => e.stopPropagation()}
        >
          {/* The grid image is moved in here via GSAP Flip on open. */}
          <div className="content_mobile-img" data-content="mobile-image" />
          <div className="content_mobile-copy">
            <span className="content_mobile-eyebrow">{item.textRightTitle}</span>
            <h3 className="content_mobile-heading">{item.titleTop}</h3>
            <p className="content_mobile-desc">{item.textRightDesc}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ContentPanel;
