"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import UnicornScene from "./UnicornScene";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";
import {
  useUnicornCanvasFade,
  useUnicornGuard,
  useUnicornPerf,
} from "@/app/lib/unicornPerf";
import { useRevealGate } from "@/app/lib/revealGates";
import { useBackgroundCovered } from "@/app/lib/backgroundCover";
import { useForeground } from "@/app/animations/hooks/useNearViewport";

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
  const { sceneKey, paused } = useUnicornGuard(ref, false, "page-background");
  // Nothing of it shows behind the footer and the end credits: paused there,
  // it keeps its last frame and costs nothing (backgroundCover.ts).
  const covered = useBackgroundCovered();
  // Only once its first frame is in: the loader waits on that frame, and a
  // visit that opens at the footer would otherwise hold the curtain until
  // its timeout.
  const [loaded, setLoaded] = useState(false);

  // Fade the WebGL <canvas> in the moment it mounts. Until then the maroon
  // gradient shows; the cross-fade hides the "scene suddenly appears" pop.
  useUnicornCanvasFade(ref);

  // This scene is behind the hero, so the loader holds its curtain until the
  // first frame is in (or the scene has failed and will never be) — see
  // revealGates.ts. Registered here in the parent, which never remounts, and
  // settled by whichever key of the child gets there first.
  const settleGate = useRevealGate("page-background");
  const onSceneLoad = useCallback(() => {
    setLoaded(true);
    settleGate();
  }, [settleGate]);
  // Kill switch (debug): the loader must not wait on a scene that is off.
  // Unmounted while the page is in the background on a phone (see
  // useForeground); rebuilt the moment it comes back.
  const fg = useForeground();
  useEffect(() => {
    if (!fg) settleGate();
  }, [fg, settleGate]);

  return (
    <div
      ref={ref}
      data-unicorn-scene="page-background"
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
      {fg && (
      <UnicornScene
        key={sceneKey}
        projectId="nHxm08nl2UefH5hUAMVJ"
        width="100%"
        height="100%"
        scale={perf.scale}
        dpi={perf.dpi}
        fps={perf.fps}
        paused={paused || (loaded && covered)}
        // Read by the marble seams (MarbleSeam), at moments of their own.
        readable
        lazyLoad={false}
        sdkUrl={UNICORN_SDK_URL}
        onLoad={onSceneLoad}
        onError={settleGate}
        className="h-full w-full"
      />
      )}
    </div>
  );
}
