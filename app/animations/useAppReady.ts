"use client";

import { useEffect, useState } from "react";

/**
 * True once the page has actually finished loading — not after a fixed delay.
 *
 * Waits on three things:
 *
 *  - `window`'s load event, which is the browser's own "everything the document
 *    pulled in has arrived": images, stylesheets, scripts, iframes. The WebGL
 *    scenes' textures are ordinary image requests, so they are covered by it
 *    too, and so is every gallery photo that is in the markup at first paint.
 *  - `document.fonts.ready`, which load does NOT cover. Without it the page is
 *    uncovered mid-swap and every heading reflows a beat later.
 *  - two animation frames after both, so the first real paint has happened
 *    behind the curtain rather than in front of the viewer.
 *
 * Bounded at both ends, and both bounds matter:
 *
 *  - `minMs` stops a warm cache from flashing the loader for three frames,
 *    which reads as a glitch rather than as an intro.
 *  - `maxMs` is a hard cap. A single wedged request — a third-party script, an
 *    image that 404s slowly — would otherwise hold the whole site behind a
 *    curtain forever. Past the cap we show the page regardless.
 */
export function useAppReady({ minMs = 500, maxMs = 6000 } = {}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let settleTimer = 0;
    const start = performance.now();

    const finish = () => {
      if (cancelled) return;
      cancelled = true; // whichever path gets here first wins
      window.clearTimeout(capTimer);
      const remaining = Math.max(0, minMs - (performance.now() - start));
      settleTimer = window.setTimeout(() => setReady(true), remaining);
    };

    const capTimer = window.setTimeout(finish, maxMs);

    const loaded =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            window.addEventListener("load", () => resolve(), { once: true });
          });

    // `fonts` is guarded: it is missing in some embedded webviews, and a
    // rejected font load must not stop the page from ever being shown.
    const fonts = document.fonts?.ready
      ? document.fonts.ready.catch(() => undefined)
      : Promise.resolve();

    Promise.all([loaded, fonts]).then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => requestAnimationFrame(finish));
    });

    return () => {
      cancelled = true;
      window.clearTimeout(capTimer);
      window.clearTimeout(settleTimer);
    };
  }, [minMs, maxMs]);

  return ready;
}
