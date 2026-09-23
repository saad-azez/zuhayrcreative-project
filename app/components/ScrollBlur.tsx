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

  // Two boxes, not one, for iPhone Safari (iOS 26). It tints its status bar
  // and floating toolbar from the `background-color` / `backdrop-filter` of
  // any `position: fixed` element at the screen's edge — even one at
  // opacity 0 — and ignores `position: absolute` children of it. With the
  // blur on the fixed box itself, every scroll switched the bars from
  // see-through to a painted frost that hid the page under them (the client,
  // 23 Sep). So the fixed box is bare and the blur rides a child: the same
  // strip on screen, nothing for Safari to sample.
  return (
    <div
      aria-hidden
      // Below the navbar (z-100) and menu (z-90) so they stay sharp on top.
      className="fixed inset-x-0 top-0 z-[80] pointer-events-none"
      style={{ height: "110px" }}
    >
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, #000 0%, #000 30%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, #000 0%, #000 30%, transparent 100%)",
          opacity: scrolling ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      />
    </div>
  );
}
