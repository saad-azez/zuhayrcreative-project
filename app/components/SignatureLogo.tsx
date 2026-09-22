"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { AnimationItem } from "lottie-web";

/**
 * The ZUHAYR Creative signature — the brand lockup as a Lottie, drawing itself.
 *
 * This replaces the flat `ZEALTH-11-trimmed.png` everywhere the lockup is used
 * as an INTRO: the loading curtain and the page-transition cover. At frame 0
 * the ZUHAYR wordmark is already there (the file's own "Static ZUHAYR"
 * marker); what animates is the "Creative" signature, written on by a pen-path
 * matte, then the t crossbar, then the dot on the i. The hero's logo lens is a
 * different thing and is left alone.
 *
 * Both consumers have to know exactly when the writing has finished — nothing
 * else is allowed to start until it has — so the component is imperative:
 * `play()` starts the draw, `onComplete` fires once, when it is done.
 */

/** Where the file lives. Not bundled: 41KB of JSON off the JS critical path. */
const SRC = "/zuhayr-logo.json";

/**
 * The animation data, fetched ONCE for the whole page.
 *
 * Two players exist at the same time — the loading curtain's and the page
 * transition's — and handing lottie a `path` makes each of them fetch the file
 * itself. Fetching here instead means one request, and it is a plain `fetch`
 * with default credentials, which is what the `<link rel="preload">` in
 * app/layout.tsx is able to match: lottie's own XHR is not, and the preload is
 * then thrown away.
 */
let dataPromise: Promise<unknown> | null = null;
const animationData = () => {
  dataPromise ??= fetch(SRC).then((r) => {
    if (!r.ok) throw new Error(`${SRC} ${r.status}`);
    return r.json();
  });
  return dataPromise;
};

/**
 * lottie-web writes its own bookkeeping into the object it is given, so two
 * players cannot share one. Each gets a copy of the shared fetch's result.
 */
const copy = <T,>(v: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(v)
    : (JSON.parse(JSON.stringify(v)) as T);

/**
 * The last frame worth playing.
 *
 * The composition runs to 246, but the file's own markers put "Final hold" at
 * 184 and nothing moves after 190 — the pen dot's last keyframe. Those 56 dead
 * frames are ~1.9s of the visitor staring at a finished logo while the loader
 * and every page transition wait on them, so the draw ends where the drawing
 * ends.
 */
const END_FRAME = 190;

/**
 * Playback rate. **This is the knob for how long the draw takes.**
 *
 * The signature is authored at 30fps, so a draw is END_FRAME / 30 / speed
 * seconds — and whatever is playing it is held for exactly that long, by
 * design (see LoadingScreen and PageTransition). At 1 it is the authored 6.3s.
 *
 * This is the LOADER's rate, and the loader is the one place the full 4s is
 * worth spending: it is the first thing a visitor sees, once. A page
 * transition runs on every click and is much faster — see
 * TRANSITION_LOGO_SPEED in PageTransition.tsx.
 */
export const LOGO_SPEED = 1.6;

/** How long a `play()` at `speed` takes, in ms. Used for the watchdogs. */
export const logoDurationMs = (speed = LOGO_SPEED) =>
  (END_FRAME / 30 / speed) * 1000;

/**
 * One width for the lockup, so the mark on the transition cover and the mark
 * on the loading curtain are the same size. They used to be two different
 * clamps kept in sync by a comment, and they had already drifted apart.
 */
export const LOGO_CLASS = "w-[clamp(16rem,42vw,34rem)]";

export type SignatureLogoHandle = {
  /** Draw the signature, from the top. */
  play: () => void;
};

type Props = {
  className?: string;
  /** Draw as soon as the animation data has landed. */
  autoplay?: boolean;
  /** Playback rate — see LOGO_SPEED, which is the default. */
  speed?: number;
  /** The writing has finished. Fires exactly once per `play()`. */
  onComplete?: () => void;
};

const SignatureLogo = forwardRef<SignatureLogoHandle, Props>(
  function SignatureLogo(
    { className, autoplay = false, speed = LOGO_SPEED, onComplete },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<AnimationItem | null>(null);
    // The animation data can arrive AFTER play() has been called — on a page
    // transition the cover lands in 0.45s and the chunk may still be in
    // flight. Remember the request and honour it on load.
    const wantsPlay = useRef(autoplay);
    const done = useRef(false);
    const watchdog = useRef(0);

    // Held in refs so a consumer re-rendering with a new closure does not
    // tear down and rebuild the player mid-draw.
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;
    const speedRef = useRef(speed);
    speedRef.current = speed;

    const finish = useCallback(() => {
      if (done.current) return;
      done.current = true;
      window.clearTimeout(watchdog.current);
      onCompleteRef.current?.();
    }, []);

    const start = useCallback(() => {
      const anim = animRef.current;
      if (!anim) return;
      done.current = false;

      // A visitor who has asked for less motion still gets the lockup — just
      // finished, not drawn — and everything waiting on it carries straight on.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        anim.goToAndStop(END_FRAME, true);
        finish();
        return;
      }

      // Re-asserted on every play rather than once at load: the rate is a
      // prop, and a consumer is free to change it between draws.
      anim.setSpeed(speedRef.current);
      anim.goToAndStop(0, true);
      anim.playSegments([0, END_FRAME], true);

      // Nothing downstream may hang on this. `complete` is the normal path;
      // this is the floor under a player that stalls in a backgrounded tab or
      // a browser that throttles rAF to nothing.
      window.clearTimeout(watchdog.current);
      watchdog.current = window.setTimeout(
        finish,
        logoDurationMs(speedRef.current) + 1500,
      );
    }, [finish]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          wantsPlay.current = true;
          if (animRef.current) start();
        },
      }),
      [start],
    );

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      let cancelled = false;
      let anim: AnimationItem | null = null;

      // The player is loaded on demand: lottie-web is ~150KB and belongs in
      // its own chunk, not in the bundle that has to hydrate before anything
      // can be painted. The data is fetched alongside it, not after it.
      Promise.all([
        import("lottie-web/build/player/lottie_light"),
        animationData(),
      ])
        .then(([{ default: lottie }, data]) => {
          if (cancelled) return;
          anim = lottie.loadAnimation({
            container: host,
            renderer: "svg",
            loop: false,
            autoplay: false,
            animationData: copy(data),
            rendererSettings: {
              preserveAspectRatio: "xMidYMid meet",
              // The signature is drawn by a track matte over a filled shape
              // layer; with progressive load the matte can be attached a frame
              // late and the whole word flashes in at once before it is
              // written.
              progressiveLoad: false,
            },
          });
          animRef.current = anim;
          anim.setSpeed(speedRef.current);
          anim.addEventListener("complete", finish);
          // `DOMLoaded` rather than `data_ready`: the SVG has to exist before
          // playSegments has anything to drive.
          anim.addEventListener("DOMLoaded", () => {
            if (!cancelled && wantsPlay.current) start();
          });
        })
        // A 404, a malformed file, a chunk that never arrives: none of them
        // may hold the site behind a curtain forever. Hand over as if the
        // draw had finished.
        .catch(finish);

      return () => {
        cancelled = true;
        window.clearTimeout(watchdog.current);
        anim?.destroy();
        animRef.current = null;
      };
    }, [finish, start]);

    return (
      <div
        ref={hostRef}
        className={className ?? LOGO_CLASS}
        // The composition is 1400x460. Reserving the box means the curtain's
        // lockup does not jump into place when the JSON lands.
        style={{ aspectRatio: "1400 / 460" }}
        aria-hidden
      />
    );
  },
);

export default SignatureLogo;
