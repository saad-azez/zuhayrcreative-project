"use client";

import { useEffect, useRef } from "react";
import UnicornScene from "./UnicornScene";
import { HERO_SCENE_IMAGES, UNICORN_SDK_URL } from "@/app/lib/unicorn";
import {
  useUnicornCanvasFade,
  useUnicornGuard,
  useUnicornPerf,
} from "@/app/lib/unicornPerf";
import { useRevealGate } from "@/app/lib/revealGates";
import { useSceneLease } from "@/app/animations/hooks/useNearViewport";

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

/**
 * `underShop`: the 3D shop's box is standing on this scene (the "shop" hero
 * variant, lib/heroVariant.ts). The box covers most of it and is itself the
 * heaviest thing on the page, so here the scene draws at no more than 30
 * frames a second: it is a slow drift seen round the edges of the box, and
 * the frames it gives up go to the box and to the page's own motion.
 */
export default function HeroBackground({
  underShop = false,
}: {
  underShop?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Device-tiered render settings; paused once the hero scrolls out of view
  // and self-healing if the browser evicts its WebGL context.
  const perf = useUnicornPerf();
  const { sceneKey, paused } = useUnicornGuard(ref, true, "hero-background");

  // Fade the WebGL <canvas> in the moment it mounts. Until then the maroon
  // gradient shows; the cross-fade hides the "scene suddenly appears" pop.
  useUnicornCanvasFade(ref);

  // This scene is behind the hero, so the loader holds its curtain until the
  // first frame is in (or the scene has failed and will never be) — see
  // revealGates.ts. Registered here in the parent, which never remounts, and
  // settled by whichever key of the child gets there first.
  const settleGate = useRevealGate("hero-background");

  // Built at load (the loader waits on it); on a phone, released once the
  // reader is four viewports away and rebuilt on the way back — see
  // useSceneLease. A scene released before it ever loaded (a deep link far
  // down the page) must still let the loader go.
  const leased = useSceneLease(ref, { initial: true, label: "Hero" });
  useEffect(() => {
    if (!leased) settleGate();
  }, [leased, settleGate]);

  return (
    <div
      ref={ref}
      data-unicorn-scene="hero-background"
      aria-hidden
      data-hero-unicorn-bg
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
      {leased && (
      <UnicornScene
        key={sceneKey}
        projectId="Wuto1wGb9FV7qHOiSYto"
        width="100%"
        height="100%"
        scale={perf.scale}
        dpi={perf.dpi}
        fps={underShop ? (Math.min(perf.fps, 30) as typeof perf.fps) : perf.fps}
        paused={paused}
        lazyLoad={false}
        sdkUrl={UNICORN_SDK_URL}
        onLoad={settleGate}
        onError={settleGate}
        preloadImages={HERO_SCENE_IMAGES}
        className="h-full w-full"
      />
      )}
    </div>
  );
}
