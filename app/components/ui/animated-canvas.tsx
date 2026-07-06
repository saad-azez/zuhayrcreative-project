"use client";

// Animated vertical-line sweep on a 2D canvas: a train of lines eases across
// the width while their height breathes, giving a scanning "energy field"
// feel. Adapted for this codebase: converted to typed TSX, and the canvas
// sizes to its OWN container (via ResizeObserver) instead of the window, so
// it can fill arbitrary slots (e.g. the strips flanking the idle banner).
//
// Extensions over the source snippet:
//   • lineColors — multiple stops sampled as a smooth gradient across the
//     width (x=0 → x=1), each line coloured by its current position.
//   • taperStart / taperEnd — spatial height multipliers at x=0 / x=width,
//     so lines can be tall at one edge and shrink toward the other.
//   • Under prefers-reduced-motion a single static frame is drawn.
//
// Note: this project doesn't use the shadcn structure (no root /components,
// no cn() util) — small copy-paste primitives live in app/components/ui.

import React, { useEffect, useRef } from "react";

const ease = {
  quint: {
    in: (t: number, b: number, c: number, d: number) => {
      t /= d;
      return c * t * t * t * t * t + b;
    },
    out: (t: number, b: number, c: number, d: number) => {
      t = t / d - 1;
      return c * (t * t * t * t * t + 1) + b;
    },
  },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const parseHex = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : [255, 255, 255];
};

export interface AnimatedCanvasProps {
  count?: number;
  lineColor?: string;
  /**
   * Gradient stops mapped across the width (index 0 at x=0). When set, each
   * line is coloured by smoothly interpolating the stops at its current x —
   * overrides lineColor.
   */
  lineColors?: string[];
  heightMultiplier?: number;
  /** Extra height scale at x=0 (1 = unchanged). */
  taperStart?: number;
  /** Extra height scale at x=width (1 = unchanged). */
  taperEnd?: number;
  /**
   * Easing power for the horizontal distribution (x = timeᵖ). The source's
   * quintic sweep (5) parks most lines near their start edge, stacking them
   * there; lower values (≈2) spread the pack out with visible gaps while
   * keeping the accelerating-sweep feel. 1 = perfectly even spacing.
   */
  positionPower?: number;
  speed?: number;
  lineWidth?: number;
  className?: string;
  direction?: "left-to-right" | "right-to-left";
}

const AnimatedCanvas = ({
  count = 40,
  lineColor = "hsl(180, 70%, 50%)",
  lineColors,
  heightMultiplier = 0.4,
  taperStart = 1,
  taperEnd = 1,
  positionPower = 5,
  speed = 0.0001,
  lineWidth = 1,
  className = "",
  direction = "left-to-right",
}: AnimatedCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Stable dependency key — callers typically pass a fresh array each render
  // (e.g. from a component re-rendering every countdown tick), and the effect
  // must not tear the canvas down unless the colours actually changed.
  const colorsKey = lineColors ? JSON.stringify(lineColors) : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size the backing store to the element's own box (not the window).
    const resizeCanvas = () => {
      canvas.width = Math.max(1, canvas.clientWidth);
      canvas.height = Math.max(1, canvas.clientHeight);
    };
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

    // Pre-parsed gradient stops; sampled per line at its current x.
    const stops = colorsKey
      ? (JSON.parse(colorsKey) as string[]).map(parseHex)
      : null;
    const colorAt = (p: number): string => {
      if (!stops || stops.length === 0) return lineColor;
      if (stops.length === 1)
        return `rgb(${stops[0][0]},${stops[0][1]},${stops[0][2]})`;
      const seg = Math.min(Math.max(p, 0), 1) * (stops.length - 1);
      const i = Math.min(Math.floor(seg), stops.length - 2);
      const f = seg - i;
      const r = Math.round(lerp(stops[i][0], stops[i + 1][0], f));
      const g = Math.round(lerp(stops[i][1], stops[i + 1][1], f));
      const b = Math.round(lerp(stops[i][2], stops[i + 1][2], f));
      return `rgb(${r},${g},${b})`;
    };

    const drawFrame = (timeBase: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = lineWidth;

      const c = 1 / count;
      const cy = canvas.height / 2;
      for (let i = 0; i < count; i++) {
        const t_ = i * c;
        const time = (timeBase + t_) % 1;
        const t = ease.quint.in(time, 0, 1, 1);
        const ty = ease.quint.out(t, 0, 1, 1);
        // Position uses its own (gentler) easing so the pack spreads out
        // instead of stacking at the start edge; height keeps the original
        // quintic breathing.
        const tx = Math.pow(time, positionPower);
        const x =
          direction === "left-to-right"
            ? lerp(canvas.width, 0, tx)
            : lerp(0, canvas.width, tx);
        const p = canvas.width > 0 ? x / canvas.width : 0;

        // Breathing height, scaled by the spatial taper at this x.
        const y = ty * canvas.height * heightMultiplier;
        const half = Math.max(0, cy - y) * lerp(taperStart, taperEnd, p);

        ctx.beginPath();
        ctx.strokeStyle = colorAt(p);
        ctx.moveTo(x, cy - half);
        ctx.lineTo(x, cy + half);
        ctx.stroke();
      }
    };

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      drawFrame(0.35); // one static, mid-sweep frame
      return () => ro.disconnect();
    }

    const draw = () => {
      drawFrame(Date.now() * speed);
      animationRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(animationRef.current);
    };
  }, [
    count,
    lineColor,
    colorsKey,
    heightMultiplier,
    taperStart,
    taperEnd,
    positionPower,
    speed,
    lineWidth,
    direction,
  ]);

  return (
    <canvas ref={canvasRef} className={className} style={{ display: "block" }} />
  );
};

export { AnimatedCanvas };
