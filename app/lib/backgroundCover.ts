"use client";

import { useEffect, useState } from "react";

/**
 * Is the page-wide background completely hidden right now?
 *
 * The background (UnicornBackground) is a fixed, full-screen scene behind
 * everything, and it rendered every frame whatever was in front of it. At
 * the foot of the page nothing of it can be seen: the contact footer's own
 * scene is opaque below its top 30% (the rest is a cross-fade mask) and the
 * end-credits dome sits on solid black. Measured by painting the background
 * magenta: 0% of it on screen there. That is the stretch where a tablet
 * lagged — the footer scene, the dome and the background all drawing at once.
 *
 * So an element that hides the background says so in its markup:
 *
 *   data-bg-cover        opaque over its whole box
 *   data-bg-cover="0.3"  opaque from 30% of its height down (above that it
 *                        fades, and the background shows through)
 *
 * and this reports true while the union of those opaque bands spans the
 * whole viewport. A paused scene keeps its last frame, so the moment any
 * sliver of it could show again it is running again first: the test is
 * strict (every pixel row covered), not a threshold.
 *
 * Never true while the idle screen is up: it frosts the live background over
 * the page (body.is-idle).
 */
export function useBackgroundCovered(): boolean {
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      if (document.body.classList.contains("is-idle")) {
        setCovered(false);
        return;
      }
      const vh = window.innerHeight;
      const bands: [number, number][] = [];
      document.querySelectorAll<HTMLElement>("[data-bg-cover]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= vh || r.width < window.innerWidth - 1) return;
        const from = parseFloat(el.dataset.bgCover || "0") || 0;
        bands.push([r.top + r.height * from, r.bottom]);
      });
      bands.sort((a, b) => a[0] - b[0]);
      // Walk down from the top of the viewport; any gap means it shows.
      let reach = 0;
      for (const [top, bottom] of bands) {
        if (top > reach + 0.5) break;
        reach = Math.max(reach, bottom);
      }
      setCovered(reach >= vh - 0.5);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // The idle screen announces itself with these (IdleScreen).
    window.addEventListener("app:scroll-lock", schedule);
    window.addEventListener("app:scroll-unlock", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("app:scroll-lock", schedule);
      window.removeEventListener("app:scroll-unlock", schedule);
    };
  }, []);

  return covered;
}
