"use client";

import { useRef, useEffect, useState } from "react";

/**
 * One-shot IntersectionObserver hook for contact footer.
 * Triggers fade-up reveal once when the footer scrolls into view.
 *
 * Uses `useState` (not `useRef`) because the observed state must
 * trigger a re-render to swap CSS transition styles from hidden → visible.
 * This is NOT an animation-lock pattern (no stale-closure risk here).
 */
export function useContactFooterState(threshold = 0.1) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { containerRef, inView };
}
