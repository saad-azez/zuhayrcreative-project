"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * The Expand button's glass turning INTO its arrow.
 *
 * The client (1 Oct): "for the expand button to arrow glass morphism the
 * button is just changing shape to a circle, not morphing into the Liquid
 * Glass arrow itself". The old morph rounded the pill into a circle with a
 * → glyph inside it. Now the pane itself takes the arrow's outline: the
 * frost, the sheen and the backdrop it blurs are all clipped to a shaft and
 * a head, so the arrow IS the glass.
 *
 * How: one 7-point polygon, the same points in the same order in both
 * shapes, so every point has somewhere to flow. At rest the points lie on
 * the pill's own edges (the polygon is the box, and the pill's rounded
 * corners come from its border-radius as before); on hover they move to
 * the arrow. The pane is clipped to the polygon; the chrome rim cannot
 * follow a clip, so as the shape leaves the pill it hands over to an SVG
 * outline drawn along the same polygon (`edge`), and hands back on the
 * way home. `--morph` (0..1) on the host carries the crossfade to CSS.
 *
 * The ease overshoots a touch on the way in — the shaft thins and the head
 * widens past their marks and settle back — which is what reads as liquid
 * rather than as a shape tween. Points are clamped to the box, so the
 * overshoot never pushes the tip out of it.
 *
 * Pointer hover (mouse and pen) and keyboard focus only: on touch there is
 * no hover, and a tap opens the detail straight away. Nothing under
 * reduced motion.
 */

type Pt = readonly [number, number];

// Fractions of the pane: x across, y down.
const PILL: readonly Pt[] = [
  [0, 0], [0.58, 0], [1, 0], [1, 0.5], [1, 1], [0.58, 1], [0, 1],
];
const ARROW: readonly Pt[] = [
  [0, 0.3], [0.58, 0.3], [0.58, 0], [1, 0.5], [0.58, 1], [0.58, 0.7], [0, 0.7],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function shapeAt(m: number) {
  return PILL.map(([x0, y0], i) => {
    const [x1, y1] = ARROW[i];
    return [clamp01(x0 + (x1 - x0) * m), clamp01(y0 + (y1 - y0) * m)] as const;
  });
}

/** Returns the four refs to put on the button, the shape wrapper, the glass and the edge polygon. */
export function useArrowMorph() {
  const trigger = useRef<HTMLButtonElement>(null);
  const host = useRef<HTMLSpanElement>(null);
  const glass = useRef<HTMLSpanElement>(null);
  const edge = useRef<SVGPolygonElement>(null);

  useEffect(() => {
    const hostEl = host.current;
    const glassEl = glass.current;
    const edgeEl = edge.current;
    const btn = trigger.current;
    if (!hostEl || !glassEl || !edgeEl || !btn) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const state = { m: 0 };
    const apply = () => {
      const pts = shapeAt(state.m);
      glassEl.style.clipPath = `polygon(${pts
        .map(([x, y]) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`)
        .join(", ")})`;
      edgeEl.setAttribute(
        "points",
        pts.map(([x, y]) => `${(x * 100).toFixed(2)},${(y * 100).toFixed(2)}`).join(" "),
      );
      hostEl.style.setProperty("--morph", clamp01(state.m).toFixed(3));
    };
    apply();

    let tween: gsap.core.Tween | null = null;
    const to = (m: number) => {
      tween?.kill();
      tween = gsap.to(state, {
        m,
        duration: m ? 0.6 : 0.45,
        ease: m ? "back.out(1.7)" : "power3.out",
        onUpdate: apply,
      });
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      to(1);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      to(0);
    };
    const onFocus = () => {
      if (btn.matches(":focus-visible")) to(1);
    };
    const onBlur = () => to(0);

    btn.addEventListener("pointerenter", onEnter);
    btn.addEventListener("pointerleave", onLeave);
    btn.addEventListener("focus", onFocus);
    btn.addEventListener("blur", onBlur);
    return () => {
      tween?.kill();
      btn.removeEventListener("pointerenter", onEnter);
      btn.removeEventListener("pointerleave", onLeave);
      btn.removeEventListener("focus", onFocus);
      btn.removeEventListener("blur", onBlur);
      glassEl.style.clipPath = "";
      hostEl.style.removeProperty("--morph");
    };
  }, []);

  return { trigger, host, glass, edge };
}
