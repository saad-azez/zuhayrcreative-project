"use client";

import { useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import SplitType from "split-type";
import GalleryGrid from "./GalleryGrid";
import ContentPanel from "./ContentPanel";
import CustomCursor from "./CustomCursor";
import { galleryData, type GalleryItem } from "./galleryData";
import "./gallery.css";

gsap.registerPlugin(Flip);

type SplitsObject = {
  titleTopSplits: SplitType[];
  titleBottomSplits: SplitType[];
  textLeftSplits: SplitType[];
  textRightSplits: SplitType[];
};

function initializeSplitText(content: HTMLElement): SplitsObject {
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

export default function VerticalGallery() {
  const [cursorOpen, setCursorOpen] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionContentRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const splittListRef = useRef<(SplitsObject | null)[]>([]);
  const currentAnimationRef = useRef<gsap.core.Timeline | null>(null);
  const isOpeningRef = useRef(false);
  const activeIndexRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);

  // ── Open content ──
  const openContent = useCallback((index: number, imageEl: HTMLElement) => {
    if (isAnimating) return;

    setIsAnimating(true);
    isAnimatingRef.current = true;
    isOpeningRef.current = true;
    activeIndexRef.current = index;
    setActiveIndex(index);

    const sectionContent = sectionContentRef.current;
    if (!sectionContent) return;

    const item = galleryData[index];
    const targetContent = sectionContent.querySelector<HTMLElement>(
      `[data-content-id="${item.id}"]`,
    );
    if (!targetContent) return;

    const splits = splittListRef.current[index];
    if (!splits) return;

    sectionContent.classList.add("is-active");

    const wrapper = targetContent.querySelector<HTMLElement>(
      '[data-content="details-wrapper"]',
    );
    if (!wrapper) return;

    // Get all gallery image wrappers
    const allWrappers = document.querySelectorAll<HTMLElement>(
      '[data-gallery="image-wrapper"]',
    );
    const otherWrappers = Array.from(allWrappers).filter((w) => {
      const wid = (w as HTMLElement).dataset.itemId;
      return wid !== String(item.id);
    });

    const tl = gsap.timeline({
      defaults: { duration: 1.25, ease: "power4.inOut" },
      onStart: () => {
        sectionContent.classList.remove("is-hidden");
      },
      onComplete: () => {
        setIsAnimating(false);
        isAnimatingRef.current = false;
        isOpeningRef.current = false;
        setCursorVisible(true);
        setCursorOpen(true);
        document.body.style.overflow = "hidden";
        const grid = gridRef.current;
        if (grid) grid.style.pointerEvents = "none";
      },
    });

    // Add will-change for perf
    (splits.titleTopSplits[0] as any)?.chars?.forEach((char: HTMLElement) => {
      char.style.willChange = "transform, clip-path";
    });

    tl.addLabel("start", 0)
      .addLabel("texts", 0.5)
      .add(() => {
        // ── GSAP Flip: animate image from grid → content wrapper ──
        const flipState = Flip.getState(imageEl);
        wrapper.prepend(imageEl);
        Flip.from(flipState, {
          duration: 1.25,
          ease: "power4.inOut",
        });
      }, "start")
      .to(
        otherWrappers,
        {
          clipPath: "inset(100% 0 0 0)",
          duration: 0.75,
          ease: "power3.inOut",
        },
        0,
      )
      .fromTo(
        [
          (splits.titleTopSplits[0] as any)?.elements,
          (splits.titleBottomSplits[0] as any)?.elements,
        ],
        { xPercent: 15 },
        {
          xPercent: 0,
          duration: 1,
          ease: "power3.out",
        },
        "start+=1.25",
      )
      .fromTo(
        [
          ...((splits.titleTopSplits[0] as any)?.chars || []),
          ...((splits.titleBottomSplits[0] as any)?.chars || []),
        ],
        {
          clipPath: "inset(0 100% 0 0)",
          xPercent: 10,
        },
        {
          clipPath: "inset(0 0% 0 0)",
          xPercent: 0,
          duration: 0.75,
          ease: "power3.out",
        },
        "start+=1.25",
      )
      .fromTo(
        [
          ...((splits.textLeftSplits as any[])?.flatMap(
            (s: { lines?: HTMLElement[] }) => s.lines || [],
          ) || []),
          ...((splits.textRightSplits as any[])?.flatMap(
            (s: { lines?: HTMLElement[] }) => s.lines || [],
          ) || []),
        ],
        { yPercent: 100, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          stagger: 0.025,
        },
        "start+=1.2",
      );

    currentAnimationRef.current = tl;
  }, []);

  // ── Hide content ──
  const hideContent = useCallback((index: number) => {
    if (isAnimatingRef.current || activeIndexRef.current === null) return;

    setIsAnimating(true);
    isAnimatingRef.current = true;

    const sectionContent = sectionContentRef.current;
    if (!sectionContent) return;

    const item = galleryData[index];
    const targetContent = sectionContent.querySelector<HTMLElement>(
      `[data-content-id="${item.id}"]`,
    );
    if (!targetContent) return;

    const splits = splittListRef.current[index];
    if (!splits) return;

    const wrapper = targetContent.querySelector<HTMLElement>(
      '[data-content="details-wrapper"]',
    );
    if (!wrapper) return;

    document.body.style.overflow = "";
    const grid = gridRef.current;
    if (grid) grid.style.pointerEvents = "";

    // Get all wrappers except the one being closed (for animate-back)
    const allWrappers = document.querySelectorAll<HTMLElement>(
      '[data-gallery="image-wrapper"]',
    );
    const otherWrappers = Array.from(allWrappers).filter((w) => {
      const wid = (w as HTMLElement).dataset.itemId;
      return wid !== String(item.id);
    });

    const tl = gsap.timeline({
      defaults: { duration: 1.25, ease: "power4.inOut" },
      onComplete: () => {
        setIsAnimating(false);
        isAnimatingRef.current = false;
        activeIndexRef.current = null;
        setActiveIndex(null);
        setCursorVisible(false);
        setCursorOpen(false);
        sectionContent.classList.add("is-hidden");
        sectionContent.classList.remove("is-active");
      },
    });

    tl.addLabel("start", 0)
      .fromTo(
        [
          (splits.titleTopSplits[0] as any)?.elements,
          (splits.titleBottomSplits[0] as any)?.elements,
        ],
        { xPercent: 0 },
        { xPercent: 10, ease: "power3.out", duration: 1 },
        "start",
      )
      .fromTo(
        [
          ...((splits.titleTopSplits[0] as any)?.chars || []),
          ...((splits.titleBottomSplits[0] as any)?.chars || []),
        ],
        { clipPath: "inset(0 0% 0 0)", xPercent: 0 },
        {
          clipPath: "inset(0 100% 0 0)",
          xPercent: 10,
          ease: "power3.out",
          duration: 0.75,
        },
        "start",
      )
      .to(
        [
          ...((splits.textLeftSplits as any[])?.flatMap(
            (s: { lines?: HTMLElement[] }) => s.lines || [],
          ) || []),
          ...((splits.textRightSplits as any[])?.flatMap(
            (s: { lines?: HTMLElement[] }) => s.lines || [],
          ) || []),
        ],
        { yPercent: 100, stagger: 0.025, duration: 0.75 },
        "start",
      )
      .add(() => {
        // ── Hide content panel before Flip so image not behind overlay ──
        targetContent.classList.add("is-hidden");
        sectionContent.classList.remove("is-active");
        // ── GSAP Flip: animate image back from content → grid ──
        const imageContainer = wrapper.querySelector<HTMLElement>(
          '[data-gallery="image"]',
        );
        if (!imageContainer) return;
        const gridWrapper = document.querySelector<HTMLElement>(
          `[data-item-id="${String(item.id)}"]`,
        );
        if (!gridWrapper) return;
        const flipState = Flip.getState(imageContainer);
        gridWrapper.prepend(imageContainer);
        Flip.from(flipState, {
          duration: 1.25,
          ease: "power3.inOut",
        });
      }, "start+=0.25")
      .to(
        otherWrappers,
        { clipPath: "inset(0% 0 0 0)" },
        "start+=0.25",
      )
      .set(allWrappers, { clipPath: "none" }, "start+=1.5");

    currentAnimationRef.current = tl;
  }, []);

  // Keep refs for stable callbacks
  const openContentRef = useRef(openContent);
  const hideContentRef = useRef(hideContent);
  openContentRef.current = openContent;
  hideContentRef.current = hideContent;

  // ── Image click handler (stable reference) ──
  const handleImageClick = useCallback(
    (index: number, imageEl: HTMLElement) => {
      if (activeIndexRef.current === null) {
        openContentRef.current(index, imageEl);
      }
    },
    [],
  );

  // ── Wrapper click handler (stable reference) ──
  const handleWrapperClick = useCallback((index: number) => {
    if (activeIndexRef.current === index) {
      hideContentRef.current(index);
    }
  }, []);

  // ── Splits ready handler ──
  const handleSplitsReady = useCallback(
    (index: number, splits: SplitsObject) => {
      splittListRef.current[index] = splits;
    },
    [],
  );

  // ── Section background click → close active ──
  const handleSectionClick = useCallback(() => {
    const idx = activeIndexRef.current;
    if (idx !== null) {
      hideContentRef.current(idx);
    }
  }, []);

  // ── Cursor visibility ──
  const showCursor = useCallback(() => setCursorVisible(true), []);
  const hideCursor = useCallback(() => {
    if (activeIndexRef.current === null) setCursorVisible(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className="vertical-gallery"
      style={{ minHeight: "100vh", position: "relative" }}
    >
      {/* Custom Cursor */}
      <CustomCursor isVisible={cursorVisible} isOpen={cursorOpen} />

      {/* Gallery Grid */}
      <GalleryGrid
        ref={gridRef}
        items={galleryData}
        onImageClick={handleImageClick}
        onMouseEnter={showCursor}
        onMouseLeave={hideCursor}
      />

      {/* Content Overlay — click background to close */}
      <div
        ref={sectionContentRef}
        className="section_content is-hidden"
        data-content="section"
        onClick={handleSectionClick}
      >
        {galleryData.map((item: GalleryItem, index: number) => (
          <ContentPanel
            key={item.id}
            item={item}
            isHidden={activeIndex !== index}
            onWrapperClick={() => handleWrapperClick(index)}
            onMouseEnter={showCursor}
            onMouseLeave={hideCursor}
            onSplitsReady={(splits) => handleSplitsReady(index, splits)}
          />
        ))}
      </div>
    </div>
  );
}
