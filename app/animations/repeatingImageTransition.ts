import gsap from "gsap";

/**
 * Repeating image transition — the trail of clip-path-wiped clones that travels
 * between a thumbnail and the opened image (after the Codrops sketch of the
 * same name).
 *
 * Framework-free on purpose: it takes two rectangles and an image URL, drops
 * fixed-position clones over the page, animates them, and removes them. It
 * never touches the lightbox's own layout — the opened image stays exactly
 * where each gallery already puts it, and only its clip-path is animated, which
 * costs nothing in layout terms.
 *
 * Used by every click-to-open image on the site (WorksRail, CareerGallery,
 * SeasonsGlobe) so they all open and close the same way.
 */

export interface TrailRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type TrailDirection =
  | "top-bottom"
  | "bottom-top"
  | "left-right"
  | "right-left";

export interface TrailClipPaths {
  /** Fully hidden, on the side the wipe travels FROM. */
  from: string;
  /** Fully visible. */
  reveal: string;
  /** Fully hidden, on the side the wipe travels TO. */
  hide: string;
}

export const clipPathsFor = (direction: TrailDirection): TrailClipPaths => {
  switch (direction) {
    case "bottom-top":
      return {
        from: "inset(0% 0% 100% 0%)",
        reveal: "inset(0% 0% 0% 0%)",
        hide: "inset(100% 0% 0% 0%)",
      };
    case "left-right":
      return {
        from: "inset(0% 100% 0% 0%)",
        reveal: "inset(0% 0% 0% 0%)",
        hide: "inset(0% 0% 0% 100%)",
      };
    case "right-left":
      return {
        from: "inset(0% 0% 0% 100%)",
        reveal: "inset(0% 0% 0% 0%)",
        hide: "inset(0% 100% 0% 0%)",
      };
    case "top-bottom":
    default:
      return {
        from: "inset(100% 0% 0% 0%)",
        reveal: "inset(0% 0% 0% 0%)",
        hide: "inset(0% 0% 100% 0%)",
      };
  }
};

export interface TrailOptions {
  /** Where the trail starts — the thumbnail, or the pointer for a WebGL tile. */
  from: TrailRect;
  /** Where it ends — the opened image. */
  to: TrailRect;
  src: string;
  /**
   * Mirror of the source image's `crossOrigin`. It must match, or the clones
   * miss the cache: a CORS-mode fetch and a no-CORS fetch of the same URL are
   * SEPARATE cache entries, so a clone that disagrees with the image it is
   * copying re-downloads the file and paints nothing until it lands.
   */
  crossOrigin?: string | null;
  direction?: TrailDirection;
  /** Clones generated between the two rects. */
  steps?: number;
  stepDuration?: number;
  stepInterval?: number;
  pauseBeforeExit?: number;
  /** Max random Z tilt per clone, in degrees. */
  rotationRange?: number;
  enterEase?: string;
  exitEase?: string;
  /** Sits above the lightbox but below the custom cursor (z-99999). */
  zIndex?: number;
  /**
   * The corner the cards carry, in px, from the thumbnail's to the opened
   * image's. Left out, they are hard rectangles.
   *
   * They always were, and that was right while every thumbnail they flew
   * from was one: the work strip's bars used to be 3px, near enough square
   * that a square card leaving one read as the picture lifting off. The bars
   * are liquid-glass slabs now and their corner is a fraction of their width
   * — an order of magnitude rounder — so the first card out was a hard
   * rectangle sitting on a rounded pane, and the click began with a pop.
   * Interpolated rather than fixed because the two ends disagree: the
   * lightbox lands on 6px.
   */
  radius?: { from: number; to: number };
  /**
   * True when the destination is hidden and the trail is what reveals it, so
   * the last card must land exactly on it rather than one step short. The
   * entrance uses this; the exit does not, because the thumbnail it returns
   * to is on the page already and a card landing on top of it would double up.
   */
  coverDestination?: boolean;
}

/**
 * These are the values the reference DEMO runs, not the defaults sitting at the
 * top of its config object — every item in its markup overrides those defaults
 * via data-attributes, so the config literal never describes what you actually
 * see. Building to the literal gave a noticeably different animation: six
 * clones instead of eight, a shorter hold, softer exits, and — most visibly —
 * no rotation at all, which turned the scattered trail of repeating cards into
 * a tidy concentric staircase.
 */
const DEFAULTS = {
  direction: "top-bottom" as TrailDirection,
  steps: 8,
  stepDuration: 0.35,
  stepInterval: 0.05,
  pauseBeforeExit: 0.25,
  rotationRange: 7,
  enterEase: "sine.in",
  exitEase: "power2",
  zIndex: 9000,
};

/** The opened image's own wipe, kept in step with the trail. */
export const PANEL_REVEAL = {
  /**
   * The wipe ON, finished before the cards start leaving.
   *
   * The reference's `stepDuration * panelRevealDurationFactor` is two steps,
   * and two steps is longer than the cards stay: they land at `revealAt`,
   * hold for `pauseBeforeExit` and are gone, while the picture underneath was
   * still creeping upward on a power2 ease — the last tenth of it taking
   * about a third of a second all by itself, in the open, with nothing over
   * it. What should read as the trail DEPOSITING the picture read as two
   * animations, the trail and then the picture growing behind it.
   *
   * One step puts the wipe inside the hold instead. The cards land, the
   * picture completes under them, and they peel away off a picture that is
   * already whole.
   *
   * This is now only the fallback, for a trail with no thumbnail to fly from
   * and so nothing covering the picture. When there IS a trail, the picture
   * is opened out of sight under the last card — see `coveredDuration`.
   */
  duration: DEFAULTS.stepDuration,
  /**
   * The wipe used UNDER the last card, in the gap between it landing and it
   * leaving. Short, and entirely hidden: what matters is only that it has
   * finished before the card starts to go. Not zero, so a card that does not
   * quite cover a corner cannot snap.
   */
  coveredDuration: DEFAULTS.pauseBeforeExit * 0.4,
  /**
   * The wipe OFF, unchanged: the reference's 0.7 of the old two-step wipe.
   * Nothing is stacked over the picture on the way out, so there is no second
   * animation to fold away and no reason to hurry it.
   */
  exitDuration: DEFAULTS.stepDuration * 2 * 0.7,
  ease: "power2",
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * How long the whole trail runs, and when its head reaches the destination.
 * Callers use `revealAt` to start the opened image's own wipe as the leading
 * clone lands on it, so the two read as one movement rather than two.
 */
export const trailTiming = (o: Pick<TrailOptions, "steps" | "stepDuration" | "stepInterval" | "pauseBeforeExit">) => {
  const steps = o.steps ?? DEFAULTS.steps;
  const stepDuration = o.stepDuration ?? DEFAULTS.stepDuration;
  const stepInterval = o.stepInterval ?? DEFAULTS.stepInterval;
  const pauseBeforeExit = o.pauseBeforeExit ?? DEFAULTS.pauseBeforeExit;
  return {
    revealAt: steps * stepInterval,
    /**
     * When the LAST card has finished wiping on, so it is covering the
     * destination completely. From here until it starts leaving
     * (`pauseBeforeExit` later) anything done to the opened image happens out
     * of sight, underneath it.
     *
     * Only meaningful with `coverDestination`, where that card lands exactly
     * on the image; its index is `steps`, so it starts at `revealAt`.
     */
    coveredAt: steps * stepInterval + stepDuration,
    total: steps * stepInterval + stepDuration * 2 + pauseBeforeExit,
  };
};

/**
 * Build the intermediate rectangles. The FIRST endpoint is always dropped: it
 * would sit exactly on the thumbnail, which is already on the page.
 *
 * The last is dropped only when the destination is already showing. When the
 * opened image is being uncovered underneath the trail instead (see
 * `coverDestination`) the last card is the thing doing the covering, and it
 * has to land exactly on the image or it does not cover it: the path's last
 * intermediate sits at 8/9 of the way, which for a 130px bar opening to a
 * 461px picture is a card 35px too narrow. The picture's own edges then
 * appeared outside it the instant it was uncovered, and an 8% step in one
 * frame is read as the picture jumping bigger.
 */
const motionPath = (
  from: TrailRect,
  to: TrailRect,
  steps: number,
  coverDestination: boolean,
) => {
  const full = steps + 2;
  const fromCx = from.left + from.width / 2;
  const fromCy = from.top + from.height / 2;
  const toCx = to.left + to.width / 2;
  const toCy = to.top + to.height / 2;

  const path: TrailRect[] = [];
  for (let i = 0; i < full; i++) {
    const t = i / (full - 1);
    const width = lerp(from.width, to.width, t);
    const height = lerp(from.height, to.height, t);
    path.push({
      left: lerp(fromCx, toCx, t) - width / 2,
      top: lerp(fromCy, toCy, t) - height / 2,
      width,
      height,
    });
  }
  return path.slice(1, coverDestination ? undefined : -1);
};

/**
 * Play the trail. Returns a cancel function that kills the tweens and removes
 * the clones immediately — call it if the lightbox is closed (or unmounted)
 * mid-flight, or the clones would outlive the thing they belong to.
 */
export function playImageTrail(options: TrailOptions): () => void {
  const {
    from,
    to,
    src,
    crossOrigin,
    direction = DEFAULTS.direction,
    steps = DEFAULTS.steps,
    stepDuration = DEFAULTS.stepDuration,
    stepInterval = DEFAULTS.stepInterval,
    pauseBeforeExit = DEFAULTS.pauseBeforeExit,
    rotationRange = DEFAULTS.rotationRange,
    enterEase = DEFAULTS.enterEase,
    exitEase = DEFAULTS.exitEase,
    zIndex = DEFAULTS.zIndex,
    radius,
    coverDestination = false,
  } = options;

  if (typeof document === "undefined") return () => {};
  // Nothing sensible to draw between two degenerate rects.
  if (!from.width || !from.height || !to.width || !to.height) return () => {};

  const clip = clipPathsFor(direction);
  const path = motionPath(from, to, steps, coverDestination);
  const movers: HTMLImageElement[] = [];
  const timelines: gsap.core.Timeline[] = [];
  const fragment = document.createDocumentFragment();

  path.forEach((step, index) => {
    // A real <img>, not a div with a background-image. Two reasons: it can
    // carry `crossOrigin` so the clone shares a cache entry with the image it
    // is copying (a background-image always fetches no-CORS, which re-downloads
    // the file and leaves the clone blank while it does), and a URL with
    // characters that need quoting inside `url()` cannot silently break it.
    const mover = document.createElement("img");
    // crossOrigin MUST be assigned before src — setting it afterwards does not
    // re-issue the request, so the mode would not apply.
    if (crossOrigin != null) mover.crossOrigin = crossOrigin;
    mover.src = src;
    mover.alt = "";
    mover.decoding = "sync";
    // Styled inline rather than from a stylesheet: this element is created by
    // JS and lives for under a second, and a rule that has not made it into the
    // bundle would leave it an unpositioned, zero-height element that paints
    // nothing. (Learned the hard way on the page transition's logo pieces.)
    gsap.set(mover, {
      position: "fixed",
      left: step.left,
      top: step.top,
      width: step.width,
      height: step.height,
      objectFit: "cover",
      objectPosition: "50% 50%",
      clipPath: clip.from,
      // The tilt is what stops the trail reading as one image scaling up: each
      // clone sits at its own slight angle, so they register as a stack of
      // separate cards. Set once here and never animated — only clip-path and
      // opacity move, so the rotation holds for the clone's whole life.
      rotationZ: gsap.utils.random(-rotationRange, rotationRange),
      zIndex: zIndex + index,
      pointerEvents: "none",
      willChange: "clip-path",
      // The corner walks from the thumbnail's to the opened image's along the
      // same path the card does, so the trail hands over at both ends instead
      // of only at the one that happened to be square.
      ...(radius
        ? {
            borderRadius: `${lerp(
              radius.from,
              radius.to,
              path.length > 1 ? index / (path.length - 1) : 1,
            ).toFixed(2)}px`,
          }
        : null),
    });
    fragment.appendChild(mover);
    movers.push(mover);

    timelines.push(
      gsap
        .timeline({ delay: index * stepInterval })
        .fromTo(
          mover,
          { opacity: 0.4, clipPath: clip.hide },
          {
            opacity: 1,
            clipPath: clip.reveal,
            duration: stepDuration,
            ease: enterEase,
          },
        )
        .to(
          mover,
          { clipPath: clip.from, duration: stepDuration, ease: exitEase },
          `+=${pauseBeforeExit}`,
        ),
    );
  });

  document.body.appendChild(fragment);

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    timelines.forEach((tl) => tl.kill());
    movers.forEach((m) => m.remove());
  };

  const { total } = trailTiming({
    steps,
    stepDuration,
    stepInterval,
    pauseBeforeExit,
  });
  const call = gsap.delayedCall(total, cleanup);

  return () => {
    call.kill();
    cleanup();
  };
}

/** Read an element's viewport rect in the shape the trail wants. */
export const rectOf = (el: Element): TrailRect => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/**
 * A stand-in rect for galleries whose "thumbnail" is drawn in WebGL and so has
 * no DOM box to measure — the globe's tiles, the careers belt. Centred on the
 * click, which is the one place on screen the viewer is certainly looking.
 */
export const rectAtPoint = (
  x: number,
  y: number,
  width: number,
  height: number,
): TrailRect => ({ left: x - width / 2, top: y - height / 2, width, height });
