"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import {
  clipPathsFor,
  playImageTrail,
  trailTiming,
  PANEL_REVEAL,
  type TrailDirection,
  type TrailRect,
} from "./repeatingImageTransition";

/**
 * Drives the repeating image transition for a click-to-open lightbox.
 *
 * The shape every gallery on the site shares: a thumbnail is clicked, an image
 * opens at some fixed spot, and later it closes. This hook remembers WHERE the
 * click came from, runs the trail out to the opened image on the way in and
 * back to the thumbnail on the way out, and wipes the opened image's clip-path
 * in step with it.
 *
 * It never positions or sizes the opened image — each gallery keeps its own
 * layout untouched. Only `clip-path` is animated on it, which does not affect
 * layout, so the image lands exactly where it always did.
 */

/** Apply to the opened image so it starts hidden with no flash before the
 *  effect runs. Matches `clipPathsFor("top-bottom").from`. */
export const TRAIL_HIDDEN_CLIP = "inset(100% 0% 0% 0%)";

/**
 * Size of the fallback origin, as a fraction of the opened image. Used when the
 * thing that was clicked has no DOM box to measure — the globe's tiles and the
 * careers belt are drawn in WebGL, so there is no element to call
 * getBoundingClientRect on.
 */
const POINT_ORIGIN_SCALE = 0.18;

/**
 * Take the clone's source from the opened image itself rather than from the
 * URL the caller passed.
 *
 * `currentSrc` is what the browser actually fetched (after any srcset choice),
 * and `crossOrigin` decides which cache entry that fetch landed in. Copying
 * both guarantees the clones reuse the bitmap already decoded for the image
 * they are trailing, instead of kicking off their own download and painting
 * nothing until it arrives.
 */
const sourceOf = (el: HTMLElement, fallback: string) => {
  const img = el as HTMLImageElement;
  return {
    src: img.currentSrc || img.src || fallback,
    crossOrigin: img.crossOrigin,
  };
};

/**
 * What the trail flies from.
 *
 * A GETTER is the most general form and the right choice for anything that
 * moves: it is called at play time, so it can report where the thumbnail is
 * now. WebGL galleries use it to project a tile's live 3D position to screen
 * coordinates, since they have no element to measure.
 */
export type TrailOrigin =
  | HTMLElement
  | TrailRect
  | (() => TrailRect | null)
  | null;

export function useImageTrail(direction: TrailDirection = "top-bottom") {
  // Where the click came from — needed again on close, so it outlives the open.
  //
  // An ELEMENT is preferred over a rect wherever one exists. Galleries whose
  // thumbnails move on their own — the works rail drifts continuously — leave a
  // rect captured at click time stale by the time the trail actually plays:
  // entering waits for the opened image to lay out, and exiting happens however
  // long later the viewer closes. Both flew the clones to where the thumbnail
  // USED to be. Holding the element and measuring it fresh fixes both ends.
  const originGet = useRef<(() => TrailRect | null) | null>(null);
  const originEl = useRef<HTMLElement | null>(null);
  const origin = useRef<TrailRect | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  const imgTween = useRef<gsap.core.Tween | null>(null);
  const capTween = useRef<gsap.core.Tween | null>(null);
  const settleCall = useRef<gsap.core.Tween | null>(null);
  // Undo for work scheduled but not yet started (waiting on image layout).
  const pending = useRef<(() => void) | null>(null);
  // Last place the pointer went down, anywhere on the page. This is the origin
  // for WebGL galleries: the click landed on the tile, so the point under it is
  // exactly where the viewer expects the image to come from.
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      lastPoint.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointerdown", onDown, { capture: true });
    return () =>
      window.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);

  /** The rect the trail should fly from/to, given where the image ended up. */
  const resolveOrigin = useCallback((to: DOMRect): TrailRect | null => {
    // Asked NOW, not at click time — see the note on originEl above.
    const get = originGet.current;
    if (get) {
      const r = get();
      if (r && r.width && r.height) return r;
    }
    const el = originEl.current;
    if (el?.isConnected) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) {
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      }
    }
    if (origin.current) return origin.current;
    const p = lastPoint.current;
    if (!p) return null;
    return {
      left: p.x - (to.width * POINT_ORIGIN_SCALE) / 2,
      top: p.y - (to.height * POINT_ORIGIN_SCALE) / 2,
      width: to.width * POINT_ORIGIN_SCALE,
      height: to.height * POINT_ORIGIN_SCALE,
    };
  }, []);

  const stop = useCallback(() => {
    pending.current?.();
    pending.current = null;
    cancel.current?.();
    cancel.current = null;
    imgTween.current?.kill();
    imgTween.current = null;
    capTween.current?.kill();
    capTween.current = null;
    settleCall.current?.kill();
    settleCall.current = null;
  }, []);

  // A lightbox torn down mid-flight (route change, Escape during the entrance)
  // would otherwise leave its clones on the page for good.
  useEffect(() => stop, [stop]);

  const captureOrigin = useCallback((source: TrailOrigin) => {
    originGet.current = typeof source === "function" ? source : null;
    originEl.current = source instanceof HTMLElement ? source : null;
    origin.current =
      typeof source === "function" || source instanceof HTMLElement
        ? null
        : source;
  }, []);

  /** Trail in from the thumbnail, then wipe the opened image on. */
  const enter = useCallback(
    (img: HTMLElement | null, src: string, caption?: HTMLElement | null) => {
      stop();
      if (!img) return;
      const clip = clipPathsFor(direction);

      const play = () => {
        pending.current = null;
        const to = img.getBoundingClientRect();
        const from = to.width && to.height ? resolveOrigin(to) : null;
        const timing = trailTiming({});

        // The trail needs a real destination box. The wipe does NOT — it must
        // run either way, because the opened image is rendered already clipped
        // and would otherwise stay invisible for good.
        if (from) {
          cancel.current = playImageTrail({
            from,
            to: {
              left: to.left,
              top: to.top,
              width: to.width,
              height: to.height,
            },
            ...sourceOf(img, src),
            direction,
          });
        }

        imgTween.current = gsap.fromTo(
          img,
          { clipPath: clip.hide },
          {
            clipPath: clip.reveal,
            duration: PANEL_REVEAL.duration,
            ease: PANEL_REVEAL.ease,
            // Starts as the leading clone lands, so the trail appears to
            // deposit the image rather than the two playing side by side.
            delay: from ? timing.revealAt : 0,
          },
        );

        // The caption rises as the image wipes on, starting a beat ahead of it
        // — the reference's panel content, which lifts 25px on an expo ease.
        // Only `y` is driven here; each gallery keeps its own opacity fade, so
        // the two do not fight over the same property.
        if (caption) {
          capTween.current = gsap.fromTo(
            caption,
            { y: 25 },
            {
              y: 0,
              duration: 1,
              ease: "expo",
              delay: Math.max(0, (from ? timing.revealAt : 0) - 0.2),
            },
          );
        }
      };

      // Galleries whose opened image is sized by the bitmap (`max-h`/`w-auto`)
      // measure 0×0 on the effect that follows the opening render — the file
      // has not been decoded yet, so there is no layout to read and the trail
      // would silently skip. Wait for the image to have a box before measuring.
      const rect = img.getBoundingClientRect();
      if (rect.width && rect.height) {
        play();
        return;
      }

      const el = img as HTMLImageElement;
      if (el.tagName === "IMG" && !el.complete) {
        el.addEventListener("load", play, { once: true });
        pending.current = () => el.removeEventListener("load", play);
      } else {
        const raf = requestAnimationFrame(play);
        pending.current = () => cancelAnimationFrame(raf);
      }
    },
    [direction, stop, resolveOrigin],
  );

  /**
   * Trail back out to the thumbnail and wipe the image off, then call `done`.
   * The caller unmounts on `done` so the image is still on screen to animate.
   *
   * `onSettled` fires later still — when the last clone has finished, not when
   * the image has. Galleries that hold their motion for the transition resume
   * on this rather than on `done`: a clone's path is baked when it is created,
   * so a gallery that started moving again at `done` would slide out from under
   * the clones still travelling toward it.
   */
  const exit = useCallback(
    (
      img: HTMLElement | null,
      src: string,
      done: () => void,
      onSettled?: () => void,
    ) => {
      stop();
      const clip = clipPathsFor(direction);

      if (!img) {
        done();
        onSettled?.();
        return;
      }

      if (onSettled) {
        settleCall.current = gsap.delayedCall(
          trailTiming({}).total,
          onSettled,
        ) as unknown as gsap.core.Tween;
      }

      const rect = img.getBoundingClientRect();
      // Back to wherever the trail came in from — the captured thumbnail, or
      // the point that was clicked when there was no element to measure.
      const to = resolveOrigin(rect);
      if (to && rect.width && rect.height) {
        cancel.current = playImageTrail({
          from: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
          to,
          ...sourceOf(img, src),
          direction,
        });
      }

      imgTween.current = gsap.to(img, {
        clipPath: clip.from,
        duration: PANEL_REVEAL.duration * 0.7,
        ease: PANEL_REVEAL.ease,
        onComplete: done,
      });
    },
    [direction, stop, resolveOrigin],
  );

  // MUST be memoised. Callers put this object in the dependency array of the
  // effect that plays the entrance, so a fresh object each render re-runs that
  // effect on every render — and `enter` begins by calling `stop()`. Closing
  // sets state (the caption's fade), which re-renders, which re-ran `enter`,
  // which killed the exit tween before its onComplete could unmount the
  // lightbox. The lightbox then stayed open forever.
  return useMemo(
    () => ({ captureOrigin, enter, exit, stop }),
    [captureOrigin, enter, exit, stop],
  );
}
