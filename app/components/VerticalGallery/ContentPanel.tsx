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
}

/**
 * Single content panel — renders editorial text and hosts the image
 * (moved here via GSAP Flip from the gallery grid).
 *
 * SplitType initialization runs once per panel via useEffect.
 */
const ContentPanel = memo(function ContentPanel({
  item,
  isHidden,
  onWrapperClick,
  onMouseEnter,
  onMouseLeave,
  onSplitsReady,
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
      <div
        className="content_wrapper pointer-events-auto cursor-pointer"
        data-content="details-wrapper"
        onClick={(e) => {
          e.stopPropagation();
          onWrapperClick();
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div
          className="content_title-top flex justify-start items-center w-[105%] ml-[2em] absolute bottom-[calc(100%-1.5vw)]"
          data-content="text-top"
        >
          <div className="title-big">{item.titleTop}</div>
        </div>
        <div
          className="content_title-bottom flex justify-end items-center w-[105%] ml-[2em] absolute top-[calc(100%-1.75vw)] left-0"
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
        {/* Image is moved here via GSAP Flip from gallery grid */}
      </div>
    </div>
  );
});

export default ContentPanel;
