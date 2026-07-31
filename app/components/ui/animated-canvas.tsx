"use client";

// Animated vertical-line sweep on a 2D canvas — the reference "scanning line
// field": a train of full-height lines whose ends breathe inward as they sweep
// across, all in ONE colour, drawn in a single path.
//
// This is the reference implementation as supplied, with types added and
// nothing else changed. In particular the backing store is sized to
// window.innerWidth/innerHeight, NOT to the element's own box.
//
// That is load-bearing, not incidental. The element is then laid out at some
// other size (the demo uses `h-80 w-full`), so the browser SCALES the drawing
// into it — non-uniformly, since the horizontal and vertical ratios differ.
// The lines are vertical, so the horizontal ratio thins their stroke and the
// vertical ratio shortens their travel. Sizing the buffer to the element
// instead removes that squash entirely and draws crisp native-width lines,
// which is a visibly different effect.

import { useEffect, useRef } from "react";

// Easing functions
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

// Linear interpolation
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface AnimatedCanvasProps {
  count?: number;
  lineColor?: string;
  heightMultiplier?: number;
  speed?: number;
  lineWidth?: number;
  className?: string;
  /** 'left-to-right' or 'right-to-left' */
  direction?: "left-to-right" | "right-to-left";
}

const AnimatedCanvas = ({
  count = 40,
  lineColor = "hsl(180, 70%, 50%)",
  heightMultiplier = 0.4,
  speed = 0.0001,
  lineWidth = 1,
  className = "",
  direction = "left-to-right",
}: AnimatedCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Line drawing function
    const line = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      close = false,
    ) => {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      if (close) ctx.closePath();
    };

    // Animation loop
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      const c = 1 / count;
      const time_ = Date.now() * speed;

      for (let i = 0; i < count; i++) {
        const t_ = i * c;
        const time = (time_ + t_) % 1;
        const t = ease.quint.in(time, 0, 1, 1);
        const ty = ease.quint.out(t, 0, 1, 1);
        // Adjust x based on direction
        const x =
          direction === "left-to-right"
            ? lerp(canvas.width, 0, t)
            : lerp(0, canvas.width, t);
        const y = ty * canvas.height * heightMultiplier;
        line(x, y, x, canvas.height - y, false);
      }

      ctx.stroke();
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    // Cleanup
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [count, lineColor, heightMultiplier, speed, lineWidth, direction]);

  return (
    <canvas ref={canvasRef} className={className} style={{ display: "block" }} />
  );
};

export { AnimatedCanvas };
