"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { isPhoneDevice } from "@/app/lib/device";
import { hasGPU } from "@/app/lib/gpu";

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
 * already in the cache. Until the curtain is off the network belongs to the
 * hero.
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
  // `app:uncovered`, not `app:reveal`: the reveal is the curtain STARTING to
  // lift, and the hero logo — the page's largest paint — is recorded as it
  // finishes. A fetch begun in between shares the connection with that
  // moment, and Lighthouse charges every byte in flight before the largest
  // paint to it: 230KB of section code fetched here held the mobile LCP at
  // 5.8s after the work itself had been cut by two thirds.
  const w = window as Window & { __appUncovered?: boolean };
  if (w.__appUncovered) go();
  else window.addEventListener("app:uncovered", go, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("app:uncovered", go);
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
/**
 * False while the page is in the background — on phones only, for the
 * scenes that are not leased on approach (the page background). The
 * reason is the one in useSceneLease: a backgrounded tab on iOS must be
 * light or it is discarded.
 */
export function useForeground(): boolean {
  const [fg, setFg] = useState(true);
  const gpu = useGPU();
  useEffect(() => {
    if (!isPhoneDevice()) return;
    const on = () => setFg(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  // Never in the foreground where there is no GPU to draw with.
  return fg && gpu;
}

/**
 * Whether a scene may be built at all: false where the CPU would be doing
 * the drawing (see lib/gpu.ts — every scene then costs whole seconds a
 * frame and the page never finishes loading).
 *
 * True while hydrating, whatever the answer, so the markup React hydrates
 * matches what the server sent (the probe cannot run on the server, and a
 * mismatch here would be a hydration error on every scene at once). The
 * real answer arrives on the render straight after, and the scene is
 * dropped a moment later rather than never written. A scene dropped this
 * way must settle its reveal gate, exactly as a released one does, or the
 * loader waits out its timeout.
 */
export function useGPU(): boolean {
  return useSyncExternalStore(noChange, hasGPU, yes);
}
/** The answer is a property of the machine: it is read once and never moves. */
const noChange = () => () => {};
const yes = () => true;

export function useSceneLease(
  ref: RefObject<Element | null>,
  {
    near = "150% 0px 150% 0px",
    far = "400% 0px 400% 0px",
    initial = false,
    label,
  }: { near?: string; far?: string; initial?: boolean; label?: string } = {},
): boolean {
  const [leased, setLeased] = useState(initial);
  const gpu = useGPU();

  // Every build and release goes to the mobile debug log under the
  // section's name, so a stall right after one is attributable.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!label) return;
  }, [leased, label]);

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
    let onVisibility: (() => void) | null = null;
    if (isPhoneDevice()) {
      farIo = new IntersectionObserver(
        (entries) => {
          if (entries.every((e) => !e.isIntersecting)) setLeased(false);
        },
        { rootMargin: far },
      );
      farIo.observe(el);
      // Released wholesale while the page is in the background. iOS gives a
      // backgrounded tab a far smaller memory budget than a visible one and
      // discards a tab that stays over it — the visitor comes back to a
      // reload. Timers do not run while hidden, so this is immediate; on
      // return, re-observing fires the near observer's initial callback and
      // whatever is within reach is rebuilt on the spot.
      onVisibility = () => {
        if (document.visibilityState === "hidden") setLeased(false);
        else {
          nearIo.unobserve(el);
          nearIo.observe(el);
        }
      };
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      nearIo.disconnect();
      farIo?.disconnect();
      if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ref, near, far]);

  // A lease is never granted where the CPU would be drawing the scene.
  return leased && gpu;
}
