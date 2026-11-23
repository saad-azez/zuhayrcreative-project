import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Remeasuring ScrollTrigger on resize, but only when the WIDTH changes.
 *
 * iOS Safari's toolbar shrinks and grows as a finger scrolls, and every time
 * it does the window fires `resize` with only its height changed. Each of
 * those ran a full ScrollTrigger.refresh(), which scrolls the page to the top
 * and back to remeasure every trigger and reverts and rebuilds every pin. On
 * the client's iPhone 12 (23 Nov) the crash recorder caught exactly that,
 * scrollTo(0,0) then scrollTo(0,5306) from the refresh, seconds before iOS
 * killed the tab at 1.9 GB while she scrolled past the services section's
 * wink with her finger. Scrolled by code (no toolbar movement) it never
 * happened, at the same place with ~750 MB to spare.
 *
 * GSAP's own answer to this is ignoreMobileResize, set here for the whole
 * page as soon as anything that refreshes on resize is loaded.
 */
ScrollTrigger.config({ ignoreMobileResize: true });

export function refreshOnWidthResize(delayMs = 150): () => void {
  let width = typeof window === "undefined" ? 0 : window.innerWidth;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => {
    const w = window.innerWidth;
    if (w === width) return; // the toolbar, not the layout
    width = w;
    clearTimeout(timer);
    timer = setTimeout(() => ScrollTrigger.refresh(), delayMs);
  };
  window.addEventListener("resize", onResize, { passive: true });
  return () => {
    window.removeEventListener("resize", onResize);
    clearTimeout(timer);
  };
}
