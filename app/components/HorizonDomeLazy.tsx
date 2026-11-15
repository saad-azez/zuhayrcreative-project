"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  prefetchWhenIdle,
  useSceneLease,
} from "@/app/animations/hooks/useNearViewport";
import { isPhoneDevice } from "@/app/lib/device";
import { hasGPU } from "@/app/lib/gpu";
import { readHeroVariant } from "@/app/lib/heroVariant";

/**
 * The end-credits dome, loaded on approach — the treatment SeasonsGlobeLazy
 * already gives the globe, for the same reason and a worse case.
 *
 * The dome was imported straight into SiteFooter, which the template renders
 * on EVERY route. three.js, react-three-fiber and drei therefore sat in the
 * bundle every visitor downloads before the site can hydrate, for a scene at
 * the very bottom of the page that most readers never scroll to. Measured on
 * the live site, a phone on slow 4G: 756KB of JavaScript over 21 requests,
 * the largest chunk 183KB and holding three, and hydration not finishing
 * until 7.3s — which is the whole of the site's mobile LCP, because the
 * curtain cannot lift before React wakes up.
 *
 * So the shell below holds the dome's place and its code is fetched in the
 * first quiet moment, exactly as the globe's is. The shell is the same
 * height as the scene by construction (both take `className`), so the swap
 * moves nothing and the page's scroll positions keep their numbers.
 */
// The model draft (?hero=model) has its own dome: the same scene with the
// photoreal look (HorizonDomeModel). The live site keeps HorizonDome.
const loadDome = () =>
  readHeroVariant() === "model" ? import("./HorizonDomeModel") : import("./HorizonDome");

const HorizonDome = dynamic(loadDome, { ssr: false });

/** The dome's approach margin: wide, because it is the last thing on the page. */
const APPROACH_MARGIN = "300% 0px 300% 0px";

export default function HorizonDomeLazy({ className = "" }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const near = useSceneLease(wrapRef, {
    near: APPROACH_MARGIN,
    far: "600% 0px 600% 0px",
    label: "Footer",
  });
  // Built in the first quiet moment — the dome's own reasoning, moved out
  // here so the decision is made before its code is even fetched. Not on a
  // phone (its memory, with the globe's, is what got the tab killed near the
  // footer) and not where the CPU would be drawing it (gpu.ts).
  const [built, setBuilt] = useState(false);
  useEffect(() => {
    if (isPhoneDevice() || !hasGPU()) return;
    return prefetchWhenIdle(async () => {
      await loadDome();
      const schedule = (cb: () => void) =>
        typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback(cb, { timeout: 700 })
          : window.setTimeout(cb, 300);
      schedule(() => setBuilt(true));
    });
  }, []);

  // The wrapper is always mounted and always the one being observed: the
  // lease releases on a phone, and an observer whose element had gone with
  // the scene could never grant it again.
  return (
    <div ref={wrapRef} className={className}>
      {(near || built) && <HorizonDome className="h-full" />}
    </div>
  );
}
