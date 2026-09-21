"use client";

import { useEffect, useRef, useState, type ComponentProps, type ComponentType } from "react";
import { prefetchWhenIdle, useNearViewport } from "@/app/animations/hooks/useNearViewport";
import { PIXEL_WIPE_GAP_VH } from "./pixelWipeGap";

type WipeProps = ComponentProps<typeof import("./PixelWipe").default>;

/**
 * A PixelWipe that is mounted on approach.
 *
 * The wipe is a fixed curtain that plays across one seam of the page, a
 * couple of screens below the hero at the nearest. Building it — a few
 * hundred cells and their tweens, or the stroke's canvas and path table —
 * used to happen at hydration, for both seams, under the loading curtain,
 * for every visitor including the many who never scroll that far. Now it
 * happens when the reader is within a viewport and a half of the seam,
 * in a moment of quiet, the way the sections around it are mounted
 * (LazyHydrate).
 *
 * What the page needs from the wipe before then is only its seam spacer:
 * the 75vh of breathing room the wipe rides through. That is rendered here,
 * on the server too, at exactly the wipe's own height, so mounting the wipe
 * swaps one spacer for another and nothing on the page moves. (The wipe
 * itself was client-only before, so the spacer used to appear at hydration
 * and shift everything below it — the page's only layout shift.)
 */
export default function PixelWipeLazy(props: WipeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref, "150% 0px 150% 0px");
  const [Wipe, setWipe] = useState<ComponentType<WipeProps> | null>(null);

  // The code is warmed once the page is revealed, so approach only mounts.
  useEffect(() => prefetchWhenIdle(() => import("./PixelWipe")), []);

  /**
   * Never while the page is frozen.
   *
   * The wipe measures its scroll range the moment it mounts, and a locked
   * page is not the page: the services detail pins the body on touch, which
   * collapses the document to one screen and reads `scrollY` as 0. A curtain
   * built against that keeps those positions, and once the lock lifts it
   * decides it is mid-transition over a section it should be nowhere near.
   * The reader's route into that lock is the services section — which is
   * exactly where the first wipe's spacer comes near — so this is the common
   * case, not a corner.
   */
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const lock = () => setLocked(true);
    const unlock = () => setLocked(false);
    window.addEventListener("app:scroll-lock", lock);
    window.addEventListener("app:scroll-unlock", unlock);
    return () => {
      window.removeEventListener("app:scroll-lock", lock);
      window.removeEventListener("app:scroll-unlock", unlock);
    };
  }, []);

  useEffect(() => {
    if (!near || Wipe || locked) return;
    let cancelled = false;
    let idle = 0;
    const go = () =>
      import("./PixelWipe").then((m) => {
        if (!cancelled) setWipe(() => m.default);
      });
    if (typeof window.requestIdleCallback === "function") {
      idle = window.requestIdleCallback(() => void go(), { timeout: 700 });
    } else {
      idle = window.setTimeout(() => void go(), 0);
    }
    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [near, Wipe, locked]);

  if (Wipe) return <Wipe {...props} />;
  return (
    <div
      ref={ref}
      aria-hidden
      className="w-full"
      style={{ height: `${PIXEL_WIPE_GAP_VH}vh` }}
    />
  );
}
