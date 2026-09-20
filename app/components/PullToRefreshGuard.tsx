"use client";

import { useEffect } from "react";
import { isPhoneDevice } from "@/app/lib/device";

/**
 * Stops the browser's pull-to-refresh on phones.
 *
 * Chrome on iOS reloads the page when a finger drags down while the page
 * is already at its top. On this site every load starts at the top, the
 * hero fills the screen, and a flick back up to it overshoots — so the
 * client saw the page "reloading on its own when I scroll". The debug
 * panel's record of one such reload: a healthy load, 49fps, scrollY 0,
 * then a clean exit — the browser's own reload, not a crash.
 *
 * `overscroll-behavior: none` is already on html and body (globals.css)
 * and Chrome on iOS ignores it: its pull-to-refresh belongs to the native
 * scroll view, not to CSS. What that view does respect is a cancelled
 * touchmove — the same signal that stops any scroll gesture — so the
 * guard cancels the FIRST move of a downward drag that begins with the
 * page at scrollY 0, and nothing else:
 *
 *   - a drag upward (scrolling down the page) is never touched;
 *   - a drag anywhere but the top of the page is never touched — the
 *     non-passive listener only exists between a touchstart at the top and
 *     the matching touchend, so scrolling elsewhere keeps its fast path;
 *   - a drag inside something that scrolls or drags on its own (the menu
 *     wheel, the lightboxes) is left alone.
 *
 * Phones only (lib/device.ts); renders nothing.
 */
/** How close to the top a touch may land and still count as "at the top". */
const TOP_ZONE_PX = 60;

export default function PullToRefreshGuard() {
  useEffect(() => {
    if (!isPhoneDevice()) return;

    let startY = 0;
    let armed = false;

    const inOwnScroller = (t: EventTarget | null) =>
      t instanceof Element &&
      !!t.closest("[data-lenis-prevent], .menu-veil, [role='dialog']");

    const onMove = (e: TouchEvent) => {
      if (!armed || !e.cancelable) return;
      const y = e.touches[0]?.clientY ?? startY;
      // Only the page's top, only a downward pull.
      if (window.scrollY <= 0 && y > startY + 2) e.preventDefault();
      // One decision per gesture: iOS settles what a gesture is on its
      // first move, so there is nothing more to do (and no cost) after it.
      disarm();
    };
    const disarm = () => {
      if (!armed) return;
      armed = false;
      document.removeEventListener("touchmove", onMove);
    };
    const onStart = (e: TouchEvent) => {
      disarm();
      if (window.scrollY > TOP_ZONE_PX || inOwnScroller(e.target)) return;
      // A drag that begins a few pixels under the top reaches it mid-gesture
      // and pulls on past it — by then the gesture is the browser's and
      // cannot be cancelled. So a touch landing that close snaps the page
      // to the top first (at most TOP_ZONE_PX, under the finger), and the
      // first move is then judged from there.
      if (window.scrollY > 0) window.scrollTo(0, 0);
      startY = e.touches[0]?.clientY ?? 0;
      armed = true;
      document.addEventListener("touchmove", onMove, { passive: false });
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", disarm, { passive: true });
    document.addEventListener("touchcancel", disarm, { passive: true });
    return () => {
      disarm();
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", disarm);
      document.removeEventListener("touchcancel", disarm);
    };
  }, []);

  return null;
}
