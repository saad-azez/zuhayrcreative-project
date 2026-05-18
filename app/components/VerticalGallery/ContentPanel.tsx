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
      className={`content${isHidden ? " is-hidden" : ""}`}
      data-content="details"
      data-content-id={item.id}
    >
      <div
        className="content_wrapper"
        data-content="details-wrapper"
        onClick={(e) => {
          e.stopPropagation();
          onWrapperClick();
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="content_title-top" data-content="text-top">
          <div className="title-big">{item.titleTop}</div>
        </div>
        <div className="content_title-bottom" data-content="text-bottom">
          <div className="title-big">{item.titleBottom}</div>
        </div>
        <div className="content_text-left" data-content="text-left">
          <div className="title-small">{item.textLeftTitle}</div>
          <div className="paragraph">{item.textLeftDesc}</div>
        </div>
        <div className="content_text-right" data-content="text-right">
          <div className="title-small">{item.textRightTitle}</div>
          <div className="paragraph">{item.textRightDesc}</div>
        </div>
        {/* Image is moved here via GSAP Flip from gallery grid */}
      </div>
    </div>
  );
});

export default ContentPanel;
