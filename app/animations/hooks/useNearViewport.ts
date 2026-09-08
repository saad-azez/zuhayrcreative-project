"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True once an element has come within `margin` of the viewport — and stays
 * true. This is the page's "approach" trigger: a section's expensive insides
 * (its WebGL, its textures, its photographs, a library the rest of the page
 * never needs) are held back until the reader is genuinely on their way to it.
 *
 * ── Why it never flips back ──
 * The obvious symmetrical design — tear a section down again once it is
 * scrolled past — was considered and rejected. Scrolling back up is common
 * (every nav link does it), and a remount on the way up means recompiling
 * shaders, re-uploading textures and replaying entrances right as the reader
 * arrives: a stutter that cannot be hidden. The sections already pause their
 * own loops off screen, which is where the running cost was. So: mount once,
 * pause when away, never unmount.
 *
 * ── Why a whole viewport and a half ──
 * A flick on a phone crosses a viewport in about 200ms, and a shader compile
 * plus a texture upload is slower than that on the phones that matter. The
 * margin has to buy the section more time than the fastest plausible approach
 * takes. Code is prefetched earlier still (see prefetchWhenIdle) so what
 * happens here is only the mount, not the download.
 *
 * Reads false on the server and on the first client render, so the shell
 * markup hydrates cleanly; browsers without IntersectionObserver get true at
 * mount rather than never.
 */
export function useNearViewport(
  ref: RefObject<Element | null>,
  margin = "150% 0px 150% 0px",
): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = requestAnimationFrame(() => setNear(true));
      return () => cancelAnimationFrame(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, near]);

  return near;
}

/**
 * Warm a lazily-loaded chunk during idle time once the page is uncovered, so
 * the approach trigger above only ever has to mount something whose code is
 * already in the cache. Before the reveal the network belongs to the hero.
 *
 * Returns the cleanup for the listener; pass it straight back from an effect.
 */
export function prefetchWhenIdle(load: () => Promise<unknown>): () => void {
  let idle = 0;
  let cancelled = false;
  const go = () => {
    if (cancelled) return;
    const schedule = (cb: () => void) =>
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(cb, { timeout: 4000 })
        : window.setTimeout(cb, 1500);
    idle = schedule(() => {
      if (!cancelled) void load().catch(() => {});
    });
  };
  const w = window as Window & { __appRevealed?: boolean };
  if (w.__appRevealed) go();
  else window.addEventListener("app:reveal", go, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("app:reveal", go);
    if (idle) {
      if (typeof window.cancelIdleCallback === "function")
        window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    }
  };
}
