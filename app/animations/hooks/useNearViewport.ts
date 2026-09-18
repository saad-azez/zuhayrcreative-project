"use client";

import { useEffect, useState, type RefObject } from "react";
import { isPhoneDevice } from "@/app/lib/device";

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

/**
 * useNearViewport, plus RELEASE on phones: true within `near` of the
 * viewport, and — on a phone only — false again once the element is further
 * than `far` away.
 *
 * ── Why phones break the "never unmount" rule above ──
 * That rule trades memory for smoothness, and on a phone the trade fails.
 * The page holds nine WebGL contexts and their textures a few seconds after
 * load, nothing is ever given back, and by the time the reader reaches the
 * globe and the footer iOS kills the tab for memory and reloads it — the
 * mobile debug panel caught it ("did not end normally while on screen",
 * Seasons + Footer on screen). A rebuild on the way back is a stutter; a
 * killed tab is the whole page. So on a phone a heavy scene lives only
 * while the reader is within reach of it.
 *
 * The gap between `near` and `far` is hysteresis: a reader hovering around
 * one boundary never builds and tears down the same scene over and over.
 * `far` is generous (four viewports by default) so an ordinary scroll back
 * finds the scene still built; only a reader who has genuinely moved on to
 * another part of the page costs it its memory.
 *
 * Desktop behaves exactly as useNearViewport: build on approach, never
 * release. `initial` starts it true, for scenes that must exist at load
 * (the hero, which the loader waits on).
 */
export function useSceneLease(
  ref: RefObject<Element | null>,
  {
    near = "150% 0px 150% 0px",
    far = "400% 0px 400% 0px",
    initial = false,
  }: { near?: string; far?: string; initial?: boolean } = {},
): boolean {
  const [leased, setLeased] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = requestAnimationFrame(() => setLeased(true));
      return () => cancelAnimationFrame(t);
    }
    const nearIo = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLeased(true);
      },
      { rootMargin: near },
    );
    nearIo.observe(el);
    let farIo: IntersectionObserver | null = null;
    if (isPhoneDevice()) {
      farIo = new IntersectionObserver(
        (entries) => {
          if (entries.every((e) => !e.isIntersecting)) setLeased(false);
        },
        { rootMargin: far },
      );
      farIo.observe(el);
    }
    return () => {
      nearIo.disconnect();
      farIo?.disconnect();
    };
  }, [ref, near, far]);

  return leased;
}
