"use client";

import { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";

interface UseCursorPositionOptions {
  /** Lerp factor — lower = more lag, higher = more snappy. Default 0.15 */
  lerp?: number;
  /** Offset multiplier for cursor width. Default 0.75 */
  offsetFactor?: number;
}

interface CursorPosition {
  /** Ref to attach to the cursor DOM element */
  cursorRef: React.RefObject<HTMLDivElement | null>;
  /** Current smoothed x position */
  x: React.RefObject<number>;
  /** Current smoothed y position */
  y: React.RefObject<number>;
}

/**
 * Smooth cursor tracking via GSAP quickTo — avoids manual RAF loops.
 * Uses GSAP's ticker-based interpolation for GPU-friendly performance.
 */
export function useCursorPosition(
  options: UseCursorPositionOptions = {},
): CursorPosition {
  const { lerp = 0.15, offsetFactor = 0.75 } = options;

  const cursorRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const yRef = useRef(0);
  const quickToXRef = useRef<((val: number) => void) | null>(null);
  const quickToYRef = useRef<((val: number) => void) | null>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const el = cursorRef.current;
      if (!el || !quickToXRef.current || !quickToYRef.current) return;

      const bounds = el.getBoundingClientRect();
      const tx = e.clientX - bounds.width * offsetFactor;
      const ty = e.clientY - bounds.height * offsetFactor;

      quickToXRef.current(tx);
      quickToYRef.current(ty);
    },
    [offsetFactor],
  );

  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;

    // Initialize GSAP quickTo — binds to the element's transform
    gsap.set(el, { x: 0, y: 0 });
    quickToXRef.current = gsap.quickTo(el, "x", {
      duration: lerp,
      ease: "power3.out",
    });
    quickToYRef.current = gsap.quickTo(el, "y", {
      duration: lerp,
      ease: "power3.out",
    });

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      quickToXRef.current = null;
      quickToYRef.current = null;
    };
  }, [handleMouseMove, lerp]);

  return { cursorRef, x: xRef, y: yRef };
}
