"use client";

import {
  useRef,
  type ComponentType,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type Ref,
} from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "@/app/styles/repeat-text.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * Text repetition scroll effect — the Codrops "Text Repetition Effect", demo 5.
 *
 * `copies` duplicates of the text sit in a single grid cell, stacked exactly on
 * top of each other and (bar the last one) fully transparent. As the element
 * travels through the viewport they extrude downwards and to the right into a
 * trail, fading in as they go: the copy nearest the front is the most opaque,
 * each one further back fainter, until the tail vanishes. The last copy in the
 * DOM never moves and stays solid — it paints over the trail and is the only
 * one exposed to screen readers.
 *
 * Copy `i` ends `(copies - i)` steps along the trail, at `i * opacityStep`
 * opacity, after `(copies - i) * stagger` seconds. Linear ease — the trail
 * tracks the scroll exactly rather than accelerating.
 *
 * The step sizes are fractions of the FONT SIZE, which is a deliberate change
 * from the demo. The demo moves its copies by `xPercent`/`yPercent`, i.e.
 * percentages of the element's own width and line box — fine there, where every
 * headline is a full-width block of 24vw type, but those two percentages
 * describe completely different lengths on a smaller headline in a narrower
 * column, and the trail comes out leaning wide and shallow instead of extruding
 * downwards. Measured off demo 5 at 1440×900 (345px type): each copy steps
 * 25.2px across and 41.2px down, hence the 0.073 / 0.119 defaults. Anchoring
 * both axes to the type size reproduces that geometry at any size.
 *
 * Driven the way the demo drives it: a paused timeline whose progress is
 * recomputed from the element's live position every frame while it's on screen.
 * See the comment on `update()` for why a ScrollTrigger scrub can't stand in.
 */

export interface RepeatTextProps {
  /** The string to repeat. Plain text only — every copy renders it verbatim. */
  text?: string;
  /**
   * Render each copy's content instead of `text` — for content that is not a
   * plain string, like the Impact section's rolling numbers, where every copy
   * of the trail has to carry its own reels. Called once per copy, back to
   * front; `solid` is the front copy that holds still.
   */
  renderCopy?: (index: number, solid: boolean) => ReactNode;
  /** Tag to render as. Defaults to a span so it can drop into a flex row. */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** How many stacked copies, including the static solid one at the front. */
  copies?: number;
  /** Vertical travel per copy, as a fraction of the font size. */
  step?: number;
  /** Horizontal travel per copy, as a fraction of the font size. */
  stepX?: number;
  /** Opacity gained per copy as the trail comes forward. */
  opacityStep?: number;
  /** Seconds between neighbouring copies within the scrubbed timeline. */
  stagger?: number;
  /**
   * Reserve room below (padding-bottom) for the trail, so it doesn't run over
   * whatever follows. Turn it off where the element's box is load-bearing — a
   * baseline flex row, say — and let the trail overflow instead.
   */
  spacing?: boolean;
}

export default function RepeatText({
  text = "",
  renderCopy,
  as = "span",
  className = "",
  style,
  copies = 8,
  step = 0.119,
  stepX = 0.073,
  opacityStep = 0.15,
  stagger = 0.01,
  spacing = true,
}: RepeatTextProps) {
  const rootRef = useRef<HTMLElement>(null);

  // Rendered back-to-front: copy 0 is the far tail, the last is the solid one
  // that holds still and paints on top. `distance` counts steps along the
  // trail — the demo's `totalWords - i`, so the tail sits a full `copies` steps
  // out and the copy just behind the solid one sits two.
  const layers = Array.from({ length: copies }, (_, i) => {
    if (i === copies - 1) return { distance: 0, opacity: 1, delay: 0 };
    const distance = copies - i;
    return {
      distance,
      opacity: Math.min(i * opacityStep, 1),
      delay: distance * stagger,
    };
  });

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const words = Array.from(
        root.querySelectorAll<HTMLElement>(":scope > span"),
      ).slice(0, -1);
      if (!words.length) return;

      // The solid copy is the only one at its natural position, so it's the one
      // to measure the type off. Read lazily: ScrollTrigger re-resolves these
      // function-based values on every refresh, so a vw-driven font size that
      // changes with the viewport re-scales the trail with it.
      const front = root.lastElementChild as HTMLElement | null;
      const fontSize = () =>
        front ? parseFloat(getComputedStyle(front).fontSize) || 0 : 0;

      const tl = gsap.timeline({ paused: true }).to(words, {
        duration: 1,
        ease: "none",
        x: (_i, target: HTMLElement) =>
          Number(target.dataset.distance) * fontSize() * stepX,
        y: (_i, target: HTMLElement) =>
          Number(target.dataset.distance) * fontSize() * step,
        startAt: { opacity: 0 },
        opacity: (_i, target: HTMLElement) => Number(target.dataset.opacity),
        delay: (_i, target: HTMLElement) => Number(target.dataset.delay),
      });

      // Progress is recomputed from live geometry every frame — the demo's
      // IntersectionObserver + gsap.ticker approach, and the reason it has to
      // be that rather than a ScrollTrigger scrub. A scrub caches its start/end
      // when the trigger is created, and this section sits ~7000px down the
      // page behind WebGL scenes, lazy images and the loading screen, all of
      // which change the document height after mount. The cached range ends up
      // thousands of pixels stale, so by the time the heading is actually on
      // screen the scrub has long since "finished" and the trail sits frozen at
      // full extension. A rect read can't go stale.
      //
      // `top bottom` → `bottom top`, same range the demo derived from offsetTop
      // — but off getBoundingClientRect, since offsetTop is relative to the
      // nearest positioned ancestor and several of these headings sit inside
      // one.
      const update = () => {
        const rect = root.getBoundingClientRect();
        const travel = window.innerHeight + rect.height;
        tl.progress(
          travel ? gsap.utils.clamp(0, 1, (window.innerHeight - rect.top) / travel) : 0,
        );
      };

      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          gsap.ticker.add(update);
        } else {
          gsap.ticker.remove(update);
          // Settle on the end state it left the viewport at, so scrolling back
          // past it doesn't jump.
          update();
        }
      });
      io.observe(root);
      update();

      let pendingRefresh: gsap.core.Tween | undefined;

      // Room for the tail's full drop — the demo reserves padding-bottom only,
      // since the trail never travels upwards.
      const applyRoom = () => {
        if (spacing) gsap.set(root, { paddingBottom: copies * fontSize() * step });
        // The travel is a fraction of the font size, which is viewport-derived,
        // so re-resolve the tween's end values whenever the type resizes. Rewind
        // first so invalidate() re-records the start values from the stacked
        // state rather than from wherever the trail currently sits.
        tl.progress(0);
        tl.invalidate();
        update();
        // Reserving the room moves everything below this element, so other
        // components' triggers need remeasuring. Debounced — this also fires on
        // mount and again on font swap.
        pendingRefresh?.kill();
        pendingRefresh = gsap.delayedCall(0.1, () => ScrollTrigger.refresh());
      };
      applyRoom();

      let observer: ResizeObserver | undefined;
      if (front) {
        observer = new ResizeObserver(applyRoom);
        observer.observe(front);
      }

      return () => {
        io.disconnect();
        gsap.ticker.remove(update);
        observer?.disconnect();
        pendingRefresh?.kill();
      };
    },
    { scope: rootRef },
  );

  // `as` is an ElementType for callers, but TS collapses that union's props to
  // `never` at the JSX call site — narrow it to the handful we actually pass.
  const Tag = as as ComponentType<{
    ref?: Ref<HTMLElement>;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
  }>;

  return (
    <Tag
      ref={rootRef}
      className={`repeat-text ${className}`.trim()}
      style={style}
    >
      {layers.map((layer, i) => (
        <span
          key={i}
          // The solid copy carries the accessible text; the trail is decoration.
          aria-hidden={i !== copies - 1 ? true : undefined}
          data-distance={layer.distance}
          data-opacity={layer.opacity}
          data-delay={layer.delay}
          // Server-rendered at zero so the stack can't flash at full strength
          // before GSAP takes the trail over.
          style={i === copies - 1 ? undefined : { opacity: 0 }}
        >
          {renderCopy ? renderCopy(i, i === copies - 1) : text}
        </span>
      ))}
    </Tag>
  );
}
