"use client";

import { useEffect, useState } from "react";
import { gatesSettled } from "@/app/lib/revealGates";
import { isPhoneDevice } from "@/app/lib/device";
import { hasGPU } from "@/app/lib/gpu";

/**
 * True once the first screen is actually ready to be shown — not after a
 * fixed delay, and not after the WHOLE page has loaded.
 *
 * Waits on three things, all of them about the first viewport only:
 *
 *  - `document.fonts.ready`. Without it the page is uncovered mid-swap and
 *    every heading reflows a beat later.
 *  - the images inside the first viewport, decoded. Everything further down
 *    the page is deliberately NOT waited for: the sections below the fold load
 *    on approach (see useNearViewport), so waiting for them here would hold
 *    the curtain over a hero that has been ready for seconds. `window.load`,
 *    which this used to wait on, was exactly that mistake — on a slow phone it
 *    kept the site behind the curtain for ten seconds of photographs the reader
 *    could not see.
 *  - the reveal gates (revealGates.ts): the WebGL scenes behind the hero
 *    register one at mount and settle it on their first frame, so the curtain
 *    lifts onto a live background rather than the gradient standing in for it.
 *  - then a run of clean frames. A scene that has "loaded" is not yet a scene
 *    that runs smoothly: the Unicorn SDK re-uploads a layer's image to the
 *    GPU on every frame until all of its siblings have arrived, and for the
 *    hero's 2000x2000 depth map that is 30ms a frame for a second or more —
 *    on the old timing it landed exactly on the curtain lift and the headline
 *    entrance, which is the first impression this loader exists to protect.
 *    So the curtain waits until the main thread has produced a short run of
 *    frames at full rate (see settled), bounded so it cannot wait forever.
 *
 * Bounded at both ends, and both bounds matter:
 *
 *  - `minMs` stops a warm cache from flashing the loader for three frames,
 *    which reads as a glitch rather than as an intro.
 *  - `maxMs` is a hard cap. A wedged request — the scene SDK's CDN, an image
 *    that 404s slowly — would otherwise hold the whole site behind a curtain
 *    forever. Past the cap we show the page regardless.
 *
 * Both are counted from the NAVIGATION, not from this hook's first effect:
 * see the cap below for what that cost when it was not.
 */
export function useAppReady({ minMs = 500, maxMs = 6000 } = {}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let settleTimer = 0;
    // Since the PAGE began loading, not since this effect ran: performance.now()
    // is measured from the navigation itself.
    const since = () => performance.now();

    const finish = () => {
      if (cancelled) return;
      cancelled = true; // whichever path gets here first wins
      window.clearTimeout(capTimer);
      const remaining = Math.max(0, minMs - since());
      settleTimer = window.setTimeout(() => setReady(true), remaining);
    };

    // The cap is a deadline, not a duration.
    //
    // It used to be a duration, started here — and this runs at hydration,
    // which on a slow device is the thing being waited for. Measured on the
    // live site, a throttled phone: hydration at 6.3s, then the phone's 3.5s
    // cap on top of it, so the curtain lifted at 9.8s and the hero logo -
    // in the DOM and opaque since 1.6s - was not painted until 10.8s. That
    // is the whole of the site's mobile LCP, and 86% of it was this wait.
    // The cap exists to bound how long a visitor stares at a curtain, and a
    // visitor's wait starts when they ask for the page, so it is counted
    // from there. A hydration slower than the cap now spends the budget
    // rather than being handed a fresh one.
    const capTimer = window.setTimeout(finish, Math.max(0, maxMs - since()));

    // `fonts` is guarded: it is missing in some embedded webviews, and a
    // rejected font load must not stop the page from ever being shown.
    const fonts = document.fonts?.ready
      ? document.fonts.ready.catch(() => undefined)
      : Promise.resolve();

    Promise.all([fonts, firstViewportImagesDecoded(), gatesSettled()])
      // On a phone the settle wait is capped far lower. A run of eight clean
      // frames rarely comes while the Unicorn scenes are uploading their
      // textures, so there it almost always ran to the 4s cap — seconds of
      // curtain on top of the real load, which read as a slow site. The
      // scenes are already in (gatesSettled); the wait is only for calm.
      // No GPU, no scenes (lib/gpu.ts): there is nothing uploading textures
      // between frames, so there is nothing for a run of clean frames to
      // prove. On a machine that also draws slowly — Lighthouse's, or an old
      // laptop on software rendering — the wait only ran to its cap and
      // held a page that was ready. Machines with a GPU are unaffected.
      .then(() =>
        cancelled || !hasGPU()
          ? undefined
          : settled(isPhoneDevice() ? { capMs: 1500 } : undefined),
      )
      .then(() => {
        if (cancelled) return;
        requestAnimationFrame(() => requestAnimationFrame(finish));
      });

    return () => {
      cancelled = true;
      window.clearTimeout(capTimer);
      window.clearTimeout(settleTimer);
    };
  }, [minMs, maxMs]);

  return ready;
}

/**
 * Every `<img>` whose box touches the first viewport, decoded. Lazy images are
 * skipped — the browser has not fetched them and a lazy image inside the first
 * screen is a choice someone made. Broken and empty images resolve rather than
 * reject: a missing picture is not a reason to hold the page.
 */
function firstViewportImagesDecoded(): Promise<void> {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const seen = Array.from(document.images).filter((im) => {
    if (im.loading === "lazy") return false;
    if (!im.currentSrc && !im.src) return false;
    const r = im.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
  });
  return Promise.all(seen.map((im) => im.decode().catch(() => undefined))).then(
    () => undefined,
  );
}

/**
 * Resolves once `frames` consecutive animation frames have each arrived
 * within `maxGapMs` of the last — the page is painting at full rate — or
 * after `capMs`, whichever is first. A hidden tab never delivers frames, and
 * a device that simply cannot hit the rate must not be held: the cap covers
 * both, and the loader's own hard cap sits above this one.
 *
 * 40ms is two frames at 60Hz plus jitter: a single dropped frame does not
 * reset the count, a 30ms texture upload on every frame does.
 */
function settled({ frames = 8, maxGapMs = 40, capMs = 4000 } = {}): Promise<void> {
  return new Promise<void>((resolve) => {
    let run = 0;
    let last = performance.now();
    let raf = 0;
    const cap = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      resolve();
    }, capMs);
    const tick = (now: number) => {
      run = now - last <= maxGapMs ? run + 1 : 0;
      last = now;
      if (run >= frames) {
        window.clearTimeout(cap);
        resolve();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}
