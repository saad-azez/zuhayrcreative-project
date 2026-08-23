"use client";

import { useEffect, useRef } from "react";
import UnicornScene from "unicornstudio-react";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";
import { useUnicornGuard, useUnicornPerf } from "@/app/lib/unicornPerf";

/**
 * Hero-only Unicorn Studio WebGL background (experimental variant). Scoped to
 * the hero section — every other section keeps the shared, page-wide
 * `UnicornBackground`. This sits as an absolute layer behind the hero content
 * (z-0) and in front of the shared fixed background (z-[-10]).
 *
 * The bottom ~30% is masked transparent so the shared page background shows
 * through there and the two scenes cross-fade at the hero → services seam —
 * the same blend used at the top of the footer (see ContactFooter), just
 * mirrored to taper at the bottom instead of the top.
 *
 * Like the shared background, a brand-maroon base gradient paints from the
 * first frame (no black flash before the GL canvas mounts) and the canvas is
 * faded in once it appears.
 */
export default function HeroBackground() {
  const ref = useRef<HTMLDivElement>(null);
  // Device-tiered render settings; paused once the hero scrolls out of view
  // and self-healing if the browser evicts its WebGL context.
  const perf = useUnicornPerf();
  const { sceneKey, paused } = useUnicornGuard(ref, true);

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
      data-hero-unicorn-bg
      // iOS ONLY: the hero sits at the top of the page, so this scene meets
      // the screen's top edge at rest — the same keep-out as the shared
      // background, top end only. See "iOS WebGL edge keep-out" in
      // globals.css; the existing bottom taper below is left untouched.
      data-ios-edge="top"
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{
        // Sit just above the shared page background (z-[-10]) but BEHIND all
        // content — including the fixed navbar (z-100). At z-0 this full-bleed
        // layer was painting over the navbar (it's pointer-events-none, so the
        // button stayed clickable but invisible). A negative z-index makes it a
        // true background layer.
        zIndex: -1,
        background:
          "radial-gradient(120% 120% at 50% 30%, #4a0f1d 0%, #2a0a12 50%, #1a070d 100%)",
        // Taper to transparent at the bottom so the shared page background
        // shows through and the two scenes blend into the services section.
        WebkitMaskImage:
          "linear-gradient(to bottom, #000 0%, #000 70%, transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, #000 0%, #000 70%, transparent 100%)",
      }}
    >
      <UnicornScene
        key={sceneKey}
        projectId="Wuto1wGb9FV7qHOiSYto"
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
