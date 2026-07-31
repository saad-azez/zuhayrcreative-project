"use client";

import { useEffect, useState, type RefObject } from "react";
import type { UnicornSceneProps } from "unicornstudio-react";

/**
 * Shared performance policy + resilience helpers for every Unicorn Studio
 * scene in the app.
 *
 * Why this exists:
 *  - The scenes are full-screen fragment-shader work. On weak devices (phones,
 *    old laptops) rendering several of them at native resolution and 60fps
 *    makes the whole site stutter. `useUnicornPerf` picks one device tier at
 *    first client render and every scene uses it, so the load scales down
 *    together.
 *  - Mobile browsers cap live WebGL contexts per page (~8) and silently evict
 *    the oldest when the cap — or GPU memory pressure — is hit. The evicted
 *    canvas goes PERMANENTLY BLACK (this is the "scene glitches and turns
 *    black while scrolling" bug). `useUnicornGuard` both reduces the number of
 *    simultaneously-rendering scenes (pausing offscreen ones) and self-heals
 *    an evicted scene by remounting it with a fresh key.
 */

export interface UnicornPerf {
  dpi: number;
  scale: number;
  /** The SDK only accepts 15 | 24 | 30 | 60 | 120. */
  fps: NonNullable<UnicornSceneProps["fps"]>;
}

/** Desktop defaults — also what the server renders with (never used to paint). */
const DESKTOP_PERF: UnicornPerf = { dpi: 1.5, scale: 1, fps: 60 };

function computePerf(): UnicornPerf {
  if (typeof window === "undefined") return DESKTOP_PERF;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  // Both hints are absent on some browsers (Safari) — assume capable then,
  // since Apple hardware generally is.
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8; // GB, Chrome-only
  const weak = cores <= 4 || memory <= 4;

  if (touch) {
    // Phones/tablets. `dpi` and `scale` MULTIPLY, and the old pairing applied
    // both cuts at once: dpi 1 × scale 0.75 rendered at 0.75x CSS pixels, which
    // a 2–3x DPR screen then stretched back up — an effective ~2.7x upscale,
    // versus desktop's supersampled 1.5x. That gap is what read as pixelated
    // and low-quality on touch devices while desktop looked clean.
    //
    // Capable devices now match desktop's 1.5x sampling; weak ones render 1:1
    // rather than below native. Both stay capped at 30fps (half desktop's 60)
    // and offscreen scenes are still paused by useUnicornGuard, so the extra
    // fragment work is bounded.
    return weak
      ? { dpi: 1, scale: 1, fps: 30 }
      : { dpi: 1.5, scale: 1, fps: 30 };
  }
  // Weak desktop matches the weak-touch tier exactly (dpi 1, scale 1) rather
  // than sitting at its own 0.85 — `scale` resizes the internal render buffer,
  // and these scenes are noise/pattern based, so a different scale literally
  // changes the grain size and pattern density on screen. Keeping the scale
  // identical across tiers is what makes a scene look like the same scene
  // everywhere, with only dpi and fps flexing for performance.
  return weak ? { dpi: 1, scale: 1, fps: 30 } : DESKTOP_PERF;
}

/**
 * Device-tier render settings for a Unicorn scene. Computed ONCE at first
 * client render and frozen — feeding changing values into <UnicornScene>
 * would tear down and re-init the whole scene (this previously happened on
 * every mobile load when `isTouch` flipped after mount).
 */
export function useUnicornPerf(): UnicornPerf {
  const [perf] = useState(computePerf);
  return perf;
}

/**
 * Resilience wrapper for one scene:
 *  - `sceneKey`: pass as `key` on <UnicornScene>. When the browser evicts the
 *    scene's WebGL context (canvas goes black), the key bumps and the scene
 *    remounts with a fresh context.
 *  - `paused`: pass as `paused`. True while the scene is scrolled offscreen
 *    (if `pauseOffscreen`) and for reduced-motion users — a paused scene
 *    costs no GPU time and doesn't crowd out visible contexts.
 *
 * `ref` must point at an element that CONTAINS the scene's canvas.
 */
export function useUnicornGuard(
  ref: RefObject<HTMLElement | null>,
  pauseOffscreen = false,
) {
  const [sceneKey, setSceneKey] = useState(0);
  const [offscreen, setOffscreen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // Context-loss recovery — webglcontextlost bubbles to the wrapper in the
  // capture phase. Small delay lets the browser finish the eviction sweep
  // before we ask for a new context.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: number | undefined;
    const onLost = () => {
      timer = window.setTimeout(() => setSceneKey((k) => k + 1), 400);
    };
    el.addEventListener("webglcontextlost", onLost, true);
    return () => {
      el.removeEventListener("webglcontextlost", onLost, true);
      if (timer) window.clearTimeout(timer);
    };
  }, [ref]);

  // Pause while scrolled out of view. Generous margin so the scene is already
  // running again just before it scrolls back in.
  useEffect(() => {
    if (!pauseOffscreen) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { rootMargin: "25%" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, pauseOffscreen]);

  // Track live changes to the reduced-motion preference.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return { sceneKey, paused: offscreen || reducedMotion };
}
