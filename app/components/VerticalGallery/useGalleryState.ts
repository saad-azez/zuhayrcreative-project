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

      // ── Light mode (mobile): simple CSS toggle ──
      if (!enableHeavyAnimations) {
        activeIndexRef.current = index;
        sectionContent.classList.remove("is-hidden");
        sectionContent.classList.add("is-active");
        gridEl.style.pointerEvents = "none";
        document.body.style.overflow = "hidden";
        setState((s) => ({
          ...s,
          activeIndex: index,
          cursorVisible: true,
          cursorOpen: true,
        }));
        return;
      }

      const splits = splitsRef.current[index];
      if (!splits) return;

      // Kill any in-progress animation
      currentTlRef.current?.kill();
      currentTlRef.current = null;

      isAnimatingRef.current = true;
      activeIndexRef.current = index;

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
    [sectionContentRef, gridRef, galleryItems, enableHeavyAnimations],
  );

  const close = useCallback(() => {
    if (isAnimatingRef.current) return;

    const idx = activeIndexRef.current;
    if (idx === null) return;

    const sectionContent = sectionContentRef.current;
    const gridEl = gridRef.current;
    if (!sectionContent || !gridEl) return;

    // ── Light mode (mobile): simple CSS toggle ──
    if (!enableHeavyAnimations) {
      sectionContent.classList.remove("is-active");
      sectionContent.classList.add("is-hidden");
      gridEl.style.pointerEvents = "auto";
      document.body.style.overflow = "";
      activeIndexRef.current = null;
      setState({
        activeIndex: null,
        cursorVisible: false,
        cursorOpen: false,
      });
      return;
    }

    const item = galleryItems[idx];
    const splits = splitsRef.current[idx];
    if (!splits) return;

    // Kill any in-progress animation
    currentTlRef.current?.kill();
    currentTlRef.current = null;

    isAnimatingRef.current = true;

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
  }, [sectionContentRef, gridRef, galleryItems, enableHeavyAnimations]);

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
