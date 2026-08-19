"use client";

import { useEffect, useRef } from "react";
import UnicornScene from "unicornstudio-react";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";
import { useUnicornGuard, useUnicornPerf } from "@/app/lib/unicornPerf";

/**
 * Fixed, full-viewport Unicorn Studio WebGL background, shared across pages.
 * Sits behind page content (z-index: -10) so every transparent section shows
 * it through.
 *
 * The WebGL canvas takes ~1s to mount (SDK fetch from CDN + GL init), so for
 * that first second only this element's own background paints. Two things stop
 * that from reading as a black flash through the loader's frosted blur:
 *   1. The base is a brand maroon gradient with NO near-black stops, so there's
 *      a designed surface to frost from the very first frame.
 *   2. The canvas is faded in once it appears (see below), so the hand-off from
 *      the gradient to the live scene is smooth instead of a hard pop.
 */
export default function UnicornBackground() {
  const ref = useRef<HTMLDivElement>(null);
  // Device-tiered dpi/scale/fps (weak devices render smaller + at 30fps) and
  // context-loss self-healing. This scene is fixed and always on screen, so
  // it is NOT offscreen-paused.
  const perf = useUnicornPerf();
  const { sceneKey, paused } = useUnicornGuard(ref);

  // Fade the WebGL <canvas> in the moment it mounts. Until then the maroon
  // gradient shows; the cross-fade hides the "scene suddenly appears" pop.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // Mobile URL-bar collapse resizes 100vh in some browsers/WebViews, which
    // makes the SDK rebuild its framebuffers mid-scroll (visible glitch).
    // 100lvh is the LARGE viewport height — stable while scrolling. Applied
    // imperatively so browsers without lvh keep the inline 100vh.
    if (
      typeof CSS !== "undefined" &&
      CSS.supports?.("height", "100lvh")
    ) {
      root.style.height =
        "calc(100lvh + var(--safe-top, 0px) + var(--safe-bottom, 0px))";
    }
    let done = false;
    const fadeIn = (c: HTMLCanvasElement) => {
      if (done) return;
      done = true;
      c.style.opacity = "0";
      c.style.transition = "opacity 0.8s ease";
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
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      data-unicorn-bg
      style={{
        position: "fixed",
        // Overshoot the safe areas rather than sitting inside them.
        //
        // iOS Safari confines the page between the status bar and the toolbar
        // while the toolbar is expanded, then hands the full screen back as it
        // collapses on scroll. Pinned at top/left 0 with a plain viewport
        // height, this layer covered the first state but came up exactly one
        // inset short at each end of the second — and what shows through the
        // shortfall is the dark base gradient below, as a hard-edged strip.
        //
        // Growing by the insets at both ends costs nothing when they are 0 (a
        // desktop browser, or any device without a notch) and guarantees cover
        // in every toolbar state. The scene's centre shifts by less than half
        // an inset, which is not perceptible on a full-bleed gradient.
        top: "calc(-1 * var(--safe-top, 0px))",
        left: "calc(-1 * var(--safe-left, 0px))",
        width: "calc(100vw + var(--safe-left, 0px) + var(--safe-right, 0px))",
        height: "calc(100vh + var(--safe-top, 0px) + var(--safe-bottom, 0px))",
        zIndex: -10,
        overflow: "hidden",
        background:
          "radial-gradient(120% 120% at 50% 30%, #4a0f1d 0%, #2a0a12 50%, #1a070d 100%)",
      }}
    >
      <UnicornScene
        key={sceneKey}
        projectId="nHxm08nl2UefH5hUAMVJ"
        width="100%"
        height="100%"
        scale={perf.scale}
        dpi={perf.dpi}
        fps={perf.fps}
        paused={paused}
        lazyLoad={false}
        sdkUrl={UNICORN_SDK_URL}
        className="h-full w-full"
      />
    </div>
  );
}
