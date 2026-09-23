"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import gsap from "gsap";
import "@/app/styles/rolling-number.css";

/**
 * A number drawn as odometer reels — one reel per digit, each clipped to a
 * window exactly one digit tall, so a digit changing ROLLS rather than
 * swaps: the old one slides out of the window as the new one slides in, the
 * two a fixed pitch apart, and the digits that do not change hold still.
 *
 * The motion is measured off the client's reference recording (Screen
 * Recording 2026-09-23 171623, fromanother.love): the reel moves one full
 * pitch — the window's own height — per step, in 0.40s on a cubic ease-out
 * (GSAP power2.out fits the per-frame positions to 0.23% RMS). The reference
 * brings the new digit up from BELOW as the count rises; the client asked for
 * it to come from ABOVE, so here a rising count moves the reel DOWN, and a
 * falling one (scrolling back) moves it up — the same mirror the reference
 * uses in reverse.
 *
 * Nothing a reel draws can leave the number's box: every digit is painted
 * inside its reel's `overflow: hidden` window, and the window is the size of
 * one static digit, so the number's layout box never changes while it rolls.
 */

/** One reel step, from the reference recording. */
export const ROLL_DURATION = 0.4;
export const ROLL_EASE = "power2.out";

export interface RollingNumberHandle {
  /**
   * Show `value`. Each reel rolls to it; `immediate` jumps without rolling
   * (initial state, reduced motion).
   */
  set(value: number, immediate?: boolean): void;
}

interface Props {
  /** The final value — rendered by the server, and read by assistive tech. */
  value: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A reel's strip, top to bottom: 0 9 8 7 6 5 4 3 2 1 0. It hangs so that
 * the LAST "0" sits in the window, and moves DOWN by one pitch per step, so
 * each next digit arrives from above. The duplicate "0" at the top is what
 * lets a reel wrap past 9 seamlessly: position 10 shows the same picture as
 * position 0, so the transform can drop back by ten pitches unseen.
 */
const STRIP = [0, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

const RollingNumber = forwardRef<RollingNumberHandle, Props>(
  function RollingNumber({ value, className = "", style }, ref) {
    const digits = String(Math.max(0, Math.round(value))).length;
    const strips = useRef<(HTMLSpanElement | null)[]>([]);
    // Each reel's position, unwrapped (it can pass 9 and keep going; only
    // its value mod 10 is drawn), and where it is heading.
    const pos = useRef<number[]>([]);
    const goal = useRef<number[]>([]);
    const tweens = useRef<(gsap.core.Tween | null)[]>([]);
    // The value last asked for, for the direction of the next change.
    const shownValue = useRef<number | null>(null);

    const paint = (k: number) => {
      const el = strips.current[k];
      if (!el) return;
      const p = pos.current[k] ?? 0;
      const w = ((p % 10) + 10) % 10;
      el.style.transform = `translate3d(0, ${w.toFixed(4)}em, 0)`;
    };

    useImperativeHandle(ref, () => ({
      set(v, immediate = false) {
        const n = Math.max(0, Math.round(v));
        const prev = shownValue.current;
        shownValue.current = n;
        const up = prev === null || n >= prev;
        for (let k = 0; k < digits; k++) {
          const digit = Math.floor(n / 10 ** k) % 10;
          // Each reel travels from the digit it shows to the new one, the
          // short way round in the direction of the count — never a whole
          // revolution. A true odometer's units reel turns ten times for
          // every tick of the tens, which kept the last digit of a figure
          // counted in tens (250) spinning the entire time; here a digit that
          // does not change does not move.
          const from = goal.current[k];
          let target: number;
          if (immediate || from === undefined) {
            target = digit;
          } else {
            const at = ((from % 10) + 10) % 10;
            target = up
              ? from + ((digit - at + 10) % 10)
              : from - ((at - digit + 10) % 10);
          }
          goal.current[k] = target;
          if (pos.current[k] === undefined) pos.current[k] = target;
          tweens.current[k]?.kill();
          tweens.current[k] = null;
          if (immediate) {
            pos.current[k] = target;
            paint(k);
            continue;
          }
          if (pos.current[k] === target) continue;
          // Retargeted from wherever the reel is, so a count that keeps
          // moving (a scroll in progress) turns the reel continuously and a
          // count that stops settles on the reference's curve.
          const state = { p: pos.current[k] };
          tweens.current[k] = gsap.to(state, {
            p: target,
            duration: ROLL_DURATION,
            ease: ROLL_EASE,
            onUpdate: () => {
              pos.current[k] = state.p;
              paint(k);
            },
          });
        }
      },
    }));

    // Reels are keyed from the RIGHT (k = 0 is the units), rendered left to
    // right.
    const shown = String(Math.max(0, Math.round(value))).padStart(digits, "0");
    return (
      <span className={className} style={style}>
        <span className="sr-only">{shown}</span>
        {Array.from({ length: digits }, (_, i) => {
          const k = digits - 1 - i;
          const d = Number(shown[i]);
          return (
            <span key={k} className="rolling-number__reel" aria-hidden>
              {/* In flow and invisible: gives the reel its width (one
                  tabular digit), its height (one line) and its BASELINE, so
                  the number still sits on the same baseline as its suffix.
                  An inline-block that clips its own overflow would put its
                  baseline at its bottom edge instead. */}
              <span className="rolling-number__sizer">0</span>
              <span className="rolling-number__window">
                <span
                  ref={(el) => {
                    strips.current[k] = el;
                  }}
                  className="rolling-number__strip"
                  // Server render: already showing the final digit, so the
                  // number reads correctly before any script runs.
                  style={{ transform: `translate3d(0, ${d}em, 0)` }}
                >
                  {STRIP.map((s, j) => (
                    <span key={j}>{s}</span>
                  ))}
                </span>
              </span>
            </span>
          );
        })}
      </span>
    );
  },
);

export default RollingNumber;
