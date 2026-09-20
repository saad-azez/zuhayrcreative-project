"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A progressive blur strip pinned to the top of the viewport. It fades in while
 * the page is scrolling and fades back out shortly after scrolling stops. The
 * blur itself is applied with the Tailwind `backdrop-blur-md` utility (a raw
 * `backdrop-filter` in a CSS file gets stripped by the build); a gradient mask
 * makes it taper from full blur at the top edge to none at the bottom.
 */
export default function ScrollBlur() {
  const [scrolling, setScrolling] = useState(false);
  const activeRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onScroll = () => {
      if (!activeRef.current) {
        activeRef.current = true;
        setScrolling(true);
      }
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        activeRef.current = false;
        setScrolling(false);
      }, 180);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      // Below the navbar (z-100) and menu (z-90) so they stay sharp on top.
      className="fixed inset-x-0 top-0 z-[80] pointer-events-none backdrop-blur-md"
      style={{
        height: "110px",
        WebkitMaskImage:
          "linear-gradient(to bottom, #000 0%, #000 30%, transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, #000 0%, #000 30%, transparent 100%)",
        opacity: scrolling ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    />
  );
}
