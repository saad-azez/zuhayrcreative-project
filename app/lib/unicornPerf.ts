"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ulog, uwarn } from "./unicornDebug";
import { installWebglContextManager, getCensus } from "./webglContexts";
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

/**
 * Recovery policy for a scene whose WebGL context died or never arrived.
 * The delays lengthen so a page that is genuinely at its context limit gets
 * progressively more time for another scene to release one, and the count is
 * capped so a device that simply cannot serve another context is left alone
 * with its static background rather than thrashing.
 */
const RECOVERY_BACKOFF_MS = [400, 1500, 4000];
const MAX_RECOVERIES = RECOVERY_BACKOFF_MS.length;
const WATCHDOG_GRACE_MS = 4000;
const WATCHDOG_INTERVAL_MS = 3000;

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
  /** Shown in the diagnostics — see unicornDebug.ts. */
  name = "scene",
) {
  const [sceneKey, setSceneKey] = useState(0);
  const [offscreen, setOffscreen] = useState(false);
  // Read at first render, like reducedMotion below: a scene that mounts while
  // the menu is already open must start paused, and an effect that set it
  // afterwards would render one live frame behind the veil first.
  const [menuOpen, setMenuOpen] = useState(
    () =>
      typeof document !== "undefined" &&
      document.body.classList.contains("menu-open"),
  );
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  // Recovery attempts so far. Capped: each retry itself asks for a context, so
  // an unbounded loop on a device that is simply out of them would make the
  // page worse, not better.
  const attempts = useRef(0);

  // ── Diagnostics ── (no-ops unless the debug flag is on — unicornDebug.ts)
  // Installed from the first guard to mount, so the census sees every WebGL
  // request the page makes, not just this scene's.
  useEffect(() => {
    installWebglContextManager();
    ulog(name, "guard mounted", { pauseOffscreen });
    return () => ulog(name, "guard unmounted");
  }, [name, pauseOffscreen]);

  // Context-loss recovery.
  //
  // `webglcontextlost` covers the common case (the browser evicts a live
  // context, the canvas goes permanently black). `webglcontextcreationerror`
  // covers the one it misses and which is why scenes still came back black on
  // phones: when a remount asks for a replacement context while the page is
  // STILL over the device's limit, creation fails outright — and a context
  // that was never created never fires "lost", so the old handler waited for
  // an event that could not arrive. Backing off between attempts gives the
  // other scenes' teardown time to actually free a slot.
  //
  // Both bubble to the wrapper in the capture phase.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: number | undefined;
    const retry = (e: Event) => {
      if (attempts.current >= MAX_RECOVERIES) {
        uwarn(name, `GIVING UP after ${MAX_RECOVERIES} attempts`, {
          trigger: e.type,
          note: "scene will stay blank — its base colour is all that shows",
        });
        return;
      }
      if (timer) {
        ulog(name, `${e.type} (retry already scheduled)`);
        return;
      }
      const wait = RECOVERY_BACKOFF_MS[attempts.current];
      attempts.current += 1;
      uwarn(name, `${e.type} — retry ${attempts.current}/${MAX_RECOVERIES} in ${wait}ms`, {
        liveContexts: getCensus().live(),
        refusedSoFar: getCensus().refused(),
      });
      timer = window.setTimeout(() => {
        timer = undefined;
        setSceneKey((k) => k + 1);
      }, wait);
    };
    el.addEventListener("webglcontextlost", retry, true);
    el.addEventListener("webglcontextcreationerror", retry, true);
    return () => {
      el.removeEventListener("webglcontextlost", retry, true);
      el.removeEventListener("webglcontextcreationerror", retry, true);
      if (timer) window.clearTimeout(timer);
    };
  }, [ref, name]);

  // Pause while scrolled out of view. Generous margin so the scene is already
  // running again just before it scrolls back in.
  useEffect(() => {
    if (!pauseOffscreen) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        ulog(
          name,
          `intersection: ${entry.isIntersecting ? "ON screen" : "off screen"}`,
          { ratio: +entry.intersectionRatio.toFixed(3) },
        );
        setOffscreen(!entry.isIntersecting);
      },
      { rootMargin: "25%" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, pauseOffscreen, name]);

  // Pause while the nav menu covers the page.
  //
  // Every scene is behind a full-screen veil at that point, so none of them
  // can be seen — and the veil is a backdrop-filter, which the browser must
  // re-evaluate over the whole viewport on every frame anything behind it
  // changes. Four live WebGL scenes behind a 40px blur is the most expensive
  // thing this page ever asks for, and all of it is invisible. Stopped, the
  // frosted ground composites once and holds.
  useEffect(() => {
    const open = () => setMenuOpen(true);
    const close = () => setMenuOpen(false);
    window.addEventListener("app:menu-open", open);
    window.addEventListener("app:menu-close", close);
    return () => {
      window.removeEventListener("app:menu-open", open);
      window.removeEventListener("app:menu-close", close);
    };
  }, []);

  // Track live changes to the reduced-motion preference.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const paused = offscreen || reducedMotion || menuOpen;

  useEffect(() => {
    ulog(name, `paused = ${paused}`, {
      offscreen,
      menuOpen,
      reducedMotion,
      sceneKey,
      attempts: attempts.current,
    });
  }, [paused, name, offscreen, menuOpen, reducedMotion, sceneKey]);

  useEffect(() => {
    if (sceneKey > 0) uwarn(name, `REMOUNTED (sceneKey ${sceneKey})`, {
      attempts: attempts.current,
      of: MAX_RECOVERIES,
    });
  }, [sceneKey, name]);

  // Watchdog — the backstop for everything the events above cannot report.
  //
  // Two silent failure modes, both of which leave the section showing nothing
  // but its own black base (the mobile "footer background is just black" bug):
  //   1. the SDK never attaches a canvas at all — `lazyLoad` init lost to a
  //      race with the scene mounting while still paused offscreen;
  //   2. the context is already gone by the time we could listen, so no event
  //      was ever delivered to us.
  // Polling the canvas's own context state catches both. It only runs while
  // the scene is supposed to be visible, so an offscreen or reduced-motion
  // scene is never remounted for no reason.
  useEffect(() => {
    if (paused) return;
    const el = ref.current;
    if (!el) return;
    if (attempts.current >= MAX_RECOVERIES) return;

    let timer: number | undefined;
    ulog(name, `watchdog armed (+${WATCHDOG_GRACE_MS}ms grace)`, { sceneKey });
    const check = () => {
      const canvas = el.querySelector("canvas");
      let dead: boolean;
      let why = "";
      if (!canvas) {
        dead = true; // case 1 — nothing was ever drawn
        why = "no <canvas> attached — the SDK never initialised";
      } else {
        // getContext returns the canvas's EXISTING context when the type
        // matches, so this reads the SDK's own context rather than allocating
        // a second one. The type is unknown, hence trying both; a mismatch
        // returns null, which tells us nothing and is treated as healthy.
        const gl = (canvas.getContext("webgl2") ??
          canvas.getContext("webgl")) as WebGLRenderingContext | null;
        dead = gl !== null && gl.isContextLost(); // case 2
        if (dead) why = "context lost";
        else if (!gl) why = "canvas has no WebGL context (treated as healthy)";
      }
      if (!dead) {
        ulog(name, "watchdog: healthy", {
          canvas: canvas ? `${canvas.width}x${canvas.height}` : null,
          note: why || undefined,
        });
        timer = window.setTimeout(check, WATCHDOG_INTERVAL_MS);
        return;
      }
      if (attempts.current >= MAX_RECOVERIES) {
        uwarn(name, `watchdog: DEAD (${why}) but out of retries`, {
          attempts: attempts.current,
          of: MAX_RECOVERIES,
          liveContexts: getCensus().live(),
          refused: getCensus().refused(),
          note: "this is the permanent-blank case",
        });
        return;
      }
      attempts.current += 1;
      uwarn(name, `watchdog: DEAD (${why}) — remount ${attempts.current}/${MAX_RECOVERIES}`, {
        liveContexts: getCensus().live(),
        refused: getCensus().refused(),
      });
      setSceneKey((k) => k + 1); // remount re-runs this effect and re-arms
    };
    // Grace period first: a healthy scene needs a moment to boot, and a
    // watchdog that fires during that window would remount a scene that was
    // about to come up fine.
    timer = window.setTimeout(check, WATCHDOG_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [ref, paused, sceneKey, name]);

  return { sceneKey, paused };
}

/**
 * Fades a scene's WebGL <canvas> in the moment it appears.
 *
 * Every scene paints a static base colour behind the canvas so there is
 * something on-brand to look at during the ~1s the SDK spends fetching from the
 * CDN and initialising GL. That only works if the canvas is transparent until
 * it has something to show: the element exists, and is opaque BLACK, from the
 * moment the SDK inserts it — so without this the base is covered by a black
 * rectangle and the scene appears to "load late" out of a black box.
 *
 * The canvas is inserted by the SDK rather than by React, so there is no mount
 * callback to hang this on and no way to set the initial style in JSX; hence
 * the observer. `done` guards against a second canvas (a scene remounted by
 * useUnicornGuard after a context loss) restarting the fade on the first one.
 *
 * This lived as four-way-duplicated inline code, and the footer's copy was
 * simply never written — which is exactly the bug it is meant to prevent.
 * Keep it here so a new scene gets it by importing one hook.
 */
export function useUnicornCanvasFade(
  ref: RefObject<HTMLElement | null>,
  { duration = 0.8 }: { duration?: number } = {},
): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let done = false;

    const fadeIn = (c: HTMLCanvasElement) => {
      if (done) return;
      done = true;
      ulog(
        root.getAttribute("data-unicorn-scene") || "scene",
        "canvas attached — fading in",
        { size: `${c.width}x${c.height}` },
      );
      c.style.opacity = "0";
      c.style.transition = `opacity ${duration}s ease`;
      // Two frames: one for the browser to accept opacity 0 as the start
      // value, the next to transition off it. A single frame is occasionally
      // coalesced with the style write and the fade never runs.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          c.style.opacity = "1";
        }),
      );
    };

    const existing = root.querySelector("canvas");
    if (existing) {
      fadeIn(existing);
      return;
    }

    const obs = new MutationObserver(() => {
      const c = root.querySelector("canvas");
      if (c) {
        fadeIn(c);
        obs.disconnect();
      }
    });
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [ref, duration]);
}
