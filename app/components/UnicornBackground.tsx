"use client";

import { useEffect, useRef } from "react";
import UnicornScene from "unicornstudio-react";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";

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

  // Fade the WebGL <canvas> in the moment it mounts. Until then the maroon
  // gradient shows; the cross-fade hides the "scene suddenly appears" pop.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
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
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: -10,
        overflow: "hidden",
        background:
          "radial-gradient(120% 120% at 50% 30%, #4a0f1d 0%, #2a0a12 50%, #1a070d 100%)",
      }}
    >
      <UnicornScene
        projectId="nHxm08nl2UefH5hUAMVJ"
        width="100%"
        height="100%"
        scale={1}
        dpi={1.5}
        lazyLoad={false}
        sdkUrl={UNICORN_SDK_URL}
        className="h-full w-full"
      />
    </div>
  );
}
