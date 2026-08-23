"use client";

import { useEffect, useRef } from "react";
import UnicornScene from "unicornstudio-react";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";
import { useUnicornGuard, useUnicornPerf } from "@/app/lib/unicornPerf";

/**
 * iOS keep-out gap for WebGL canvases, in px — device-proven, do not remove.
 *
 * iOS 26 Safari extends a page edge-to-edge behind its translucent chrome by
 * continuing the page's backdrop. An opaque WebGL canvas touching the screen
 * edges is a layer it cannot read or continue, so it refuses and BOXES THE
 * PAGE IN at 699 of 844px, painting black bars above and below — the bars the
 * client kept photographing. Proven by on-device bisection (/edge-test, 2026-
 * 08-23): a bare page with this exact scene full-bleed gets the bars; the
 * same scene inset 24px from the top and bottom edges over a plain DOM
 * gradient renders edge-to-edge. Desktop browsers have no such heuristic, so
 * the gap is applied only on iOS and the scene stays full-bleed elsewhere.
 */
export const IOS_EDGE_GAP = 24;

/** iPhone/iPad detection (iPadOS reports as Mac but has touch). */
export function isIOS() {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))
  );
}

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
    const lvh =
      typeof CSS !== "undefined" && CSS.supports?.("height", "100lvh");
    if (isIOS()) {
      // Pull the canvas back from the screen edges (see IOS_EDGE_GAP above).
      // The sibling backdrop div below owns the outermost pixels instead.
      root.style.top = `${IOS_EDGE_GAP}px`;
      root.style.height = lvh
        ? `calc(100lvh - ${IOS_EDGE_GAP * 2}px)`
        : `calc(100vh - ${IOS_EDGE_GAP * 2}px)`;
    } else if (lvh) {
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
    <>
      {/* Readable DOM backdrop that ALWAYS touches the physical edges — the
          layer Safari continues behind its chrome on iOS, and what shows in
          the IOS_EDGE_GAP strips the canvas no longer covers. Same gradient
          and edge colour as the scene wrapper, so the join is invisible. */}
      <div
        aria-hidden
        data-unicorn-backdrop
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -11,
          backgroundColor: "#1a070d",
          backgroundImage:
            "radial-gradient(120% 120% at 50% 30%, #4a0f1d 0%, #2a0a12 50%, #1a070d 100%)",
        }}
      />
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
        // Colour and image, NOT the `background` shorthand — the split is the
        // point. iOS 26 Safari looks for a fixed, edge-spanning element and
        // reads its background-COLOR to tint the strips above and below the
        // page, before it falls back to <body>. This div is exactly such an
        // element, but a gradient is a background-IMAGE: under the shorthand
        // there was no colour here for the sampler to find.
        //
        // The gradient paints over this opaquely, so it changes nothing on
        // screen. It exists so that whichever of the two rules Safari applies,
        // it arrives at the same colour. Keep it equal to --page-edge in
        // globals.css and to the gradient's outermost stop.
        backgroundColor: "#1a070d",
        backgroundImage:
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
    </>
  );
}
