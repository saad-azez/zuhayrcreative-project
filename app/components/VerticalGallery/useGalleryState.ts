import { useState, useRef, useCallback } from "react";
import gsap from "gsap";
import type { GalleryItem } from "./galleryData";
import type { GallerySplits } from "./splitText";
import { animateOpen, animateClose } from "./gallery-animations";

interface GalleryState {
  /** Currently active index, or null if nothing is open */
  activeIndex: number | null;
  /** Whether the custom cursor is visible */
  cursorVisible: boolean;
  /** Whether the cursor is in "open" (cross) state */
  cursorOpen: boolean;
}

interface GalleryActions {
  open: (index: number, imageEl: HTMLElement) => void;
  close: () => void;
  showCursor: () => void;
  hideCursor: () => void;
  registerSplits: (index: number, splits: GallerySplits) => void;
  getSplits: (index: number) => GallerySplits | null;
}

/** Fallback for the modal layout, which has no SplitType targets. */
const EMPTY_SPLITS: GallerySplits = {
  titleTopSplits: [],
  titleBottomSplits: [],
  textLeftSplits: [],
  textRightSplits: [],
};

interface UseGalleryStateParams {
  sectionContentRef: React.RefObject<HTMLDivElement | null>;
  gridRef: React.RefObject<HTMLDivElement | null>;
  galleryItems: GalleryItem[];
  /** When false, skip GSAP Flip and use simple CSS fade instead */
  enableHeavyAnimations: boolean;
}

/**
 * Centralized gallery state — animation lock, active index, cursor,
 * and the open/close animation orchestration.
 */
export function useGalleryState({
  sectionContentRef,
  gridRef,
  galleryItems,
  enableHeavyAnimations,
}: UseGalleryStateParams): [GalleryState, GalleryActions] {
  const [state, setState] = useState<GalleryState>({
    activeIndex: null,
    cursorVisible: false,
    cursorOpen: false,
  });

  // Mutable refs — avoid stale closures in animation callbacks
  const isAnimatingRef = useRef(false);
  const activeIndexRef = useRef<number | null>(null);
  const splitsRef = useRef<(GallerySplits | null)[]>([]);
  const currentTlRef = useRef<gsap.core.Timeline | null>(null);
  const scrollLockYRef = useRef(0);

  // ── Scroll lock ──
  // body{overflow:hidden} is not enough: Lenis drives scroll in JS and ignores
  // it, so stop Lenis via the provider's events as well.
  const lockScroll = useCallback((pinBody: boolean) => {
    scrollLockYRef.current = window.scrollY;
    window.dispatchEvent(new Event("app:scroll-lock")); // lenis.stop()
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    if (pinBody) {
      // No Lenis on touch — pin the body to stop native scroll.
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollLockYRef.current}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }
  }, []);

  const unlockScroll = useCallback(() => {
    const b = document.body;
    b.style.position = "";
    b.style.top = "";
    b.style.left = "";
    b.style.right = "";
    b.style.width = "";
    b.style.overflow = "";
    document.documentElement.style.overflow = "";
    // Restore before Lenis resumes so it doesn't animate from 0.
    window.scrollTo(0, scrollLockYRef.current);
    window.dispatchEvent(new Event("app:scroll-unlock")); // lenis.start()
  }, []);

  const registerSplits = useCallback((index: number, splits: GallerySplits) => {
    splitsRef.current[index] = splits;
  }, []);

  const getSplits = useCallback(
    (index: number): GallerySplits | null => splitsRef.current[index] ?? null,
    [],
  );

  const open = useCallback(
    (index: number, imageEl: HTMLElement) => {
      if (isAnimatingRef.current) return;

      const sectionContent = sectionContentRef.current;
      const gridEl = gridRef.current;
      if (!sectionContent || !gridEl) return;

      const item = galleryItems[index];

      // Both layouts run the same open animation; the modal has no splits.
      const splits = splitsRef.current[index] ?? EMPTY_SPLITS;

      // Kill any in-progress animation
      currentTlRef.current?.kill();
      currentTlRef.current = null;

      isAnimatingRef.current = true;
      activeIndexRef.current = index;

      // Lock on click, not in onComplete — the open timeline runs ~2.25s.
      lockScroll(!enableHeavyAnimations);

      setState((s) => ({ ...s, activeIndex: index }));

      const tl = animateOpen({
        index,
        item,
        imageEl,
        splits,
        sectionContent,
        gridEl,
        onStart: () => {
          /* no-op — animateOpen handles classList */
        },
        onComplete: () => {
          isAnimatingRef.current = false;
          setState((s) => ({
            ...s,
            cursorVisible: true,
            cursorOpen: true,
          }));
        },
      });

      currentTlRef.current = tl;
    },
    [sectionContentRef, gridRef, galleryItems, enableHeavyAnimations, lockScroll],
  );

  const close = useCallback(() => {
    if (isAnimatingRef.current) return;

    const idx = activeIndexRef.current;
    if (idx === null) return;

    const sectionContent = sectionContentRef.current;
    const gridEl = gridRef.current;
    if (!sectionContent || !gridEl) return;

    const item = galleryItems[idx];
    const splits = splitsRef.current[idx] ?? EMPTY_SPLITS;

    // Kill any in-progress animation
    currentTlRef.current?.kill();
    currentTlRef.current = null;

    isAnimatingRef.current = true;
    unlockScroll(); // release Lenis + the document as the close animation runs

    const tl = animateClose({
      item,
      splits,
      sectionContent,
      gridEl,
      onComplete: () => {
        isAnimatingRef.current = false;
        activeIndexRef.current = null;
        setState({
          activeIndex: null,
          cursorVisible: false,
          cursorOpen: false,
        });
      },
    });

    currentTlRef.current = tl;
  }, [
    sectionContentRef,
    gridRef,
    galleryItems,
    enableHeavyAnimations,
    unlockScroll,
  ]);

  const showCursor = useCallback(() => {
    setState((s) => (s.cursorVisible ? s : { ...s, cursorVisible: true }));
  }, []);

  const hideCursor = useCallback(() => {
    // Only hide if nothing is open (don't hide cursor over open content)
    if (activeIndexRef.current === null) {
      setState((s) => (s.cursorVisible ? { ...s, cursorVisible: false } : s));
    }
  }, []);

  return [
    state,
    { open, close, showCursor, hideCursor, registerSplits, getSplits },
  ];
}
