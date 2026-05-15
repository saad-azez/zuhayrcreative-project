"use client";

import { useEffect, useRef } from "react";
import SplitType from "split-type";
import type { GalleryItem } from "./galleryData";

interface ContentPanelProps {
  item: GalleryItem;
  isHidden: boolean;
  onWrapperClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onSplitsReady: (splits: ReturnType<typeof initializeSplitText>) => void;
}

function initializeSplitText(content: HTMLElement) {
  const contentTitleTop = content.querySelectorAll<HTMLElement>(
    '[data-content="text-top"] div',
  );
  const contentTitleBottom = content.querySelectorAll<HTMLElement>(
    '[data-content="text-bottom"] div',
  );
  const contentTextLeft = content.querySelectorAll<HTMLElement>(
    '[data-content="text-left"] div',
  );
  const contentTextRight = content.querySelectorAll<HTMLElement>(
    '[data-content="text-right"] div',
  );

  const titleTopSplits = Array.from(
    contentTitleTop,
    (n) => new SplitType(n, { types: "chars" }),
  );
  const titleBottomSplits = Array.from(
    contentTitleBottom,
    (n) => new SplitType(n, { types: "chars" }),
  );

  titleTopSplits[0]?.chars?.forEach((char) => {
    const wrapper = document.createElement("div");
    wrapper.classList.add("char-wrap");
    char.parentNode?.insertBefore(wrapper, char);
    wrapper.appendChild(char);
  });

  const textLeftSplits = Array.from(
    contentTextLeft,
    (n) => new SplitType(n, { types: "lines" }),
  );
  const textRightSplits = Array.from(
    contentTextRight,
    (n) => new SplitType(n, { types: "lines" }),
  );

  [textLeftSplits, textRightSplits].forEach((splits) => {
    splits.forEach((split) => {
      split.lines?.forEach((line) => {
        const wrapper = document.createElement("div");
        wrapper.classList.add("line-wrap");
        line.parentNode?.insertBefore(wrapper, line);
        wrapper.appendChild(line);
      });
    });
  });

  return { titleTopSplits, titleBottomSplits, textLeftSplits, textRightSplits };
}

export default function ContentPanel({
  item,
  isHidden,
  onWrapperClick,
  onMouseEnter,
  onMouseLeave,
  onSplitsReady,
}: ContentPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!contentRef.current || initialized.current) return;
    const splits = initializeSplitText(contentRef.current);
    initialized.current = true;
    onSplitsReady(splits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        {/* Image container is moved here via GSAP Flip */}
      </div>
    </div>
  );
}
