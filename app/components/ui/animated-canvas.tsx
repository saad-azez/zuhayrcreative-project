"use client";

// Animated vertical-line sweep on a 2D canvas — the reference "scanning line
// field": a train of full-height lines whose ends breathe inward as they sweep
// across, all in ONE colour, drawn in a single path. This matches the provided
// reference algorithm exactly. Two project adaptations, neither of which change
// the look:
//   • typed TSX + a single-frame fallback under prefers-reduced-motion;
//   • the backing store sizes to the element's OWN box (via ResizeObserver)
//     instead of window.innerWidth/Height, so it can fill the narrow strips
//     flanking the idle banner without squashing a full-window buffer into them.

import { useEffect, useRef } from "react";

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

export interface AnimatedCanvasProps {
  count?: number;
  lineColor?: string;
  heightMultiplier?: number;
  speed?: number;
  lineWidth?: number;
  className?: string;
  direction?: "left-to-right" | "right-to-left";
}

const AnimatedCanvas = ({
  count = 40,
  lineColor = "#C4010D",
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

    // Size the backing store to the element's own box (see note above).
    const resizeCanvas = () => {
      canvas.width = Math.max(1, canvas.clientWidth);
      canvas.height = Math.max(1, canvas.clientHeight);
    };
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

    const line = (x1: number, y1: number, x2: number, y2: number, close = false) => {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      if (close) ctx.closePath();
    };

    const drawFrame = (timeBase: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      const c = 1 / count;
      for (let i = 0; i < count; i++) {
        const t_ = i * c;
        const time = (timeBase + t_) % 1;
        const t = ease.quint.in(time, 0, 1, 1);
        const ty = ease.quint.out(t, 0, 1, 1);
        const x =
          direction === "left-to-right"
            ? lerp(canvas.width, 0, t)
            : lerp(0, canvas.width, t);
        const y = ty * canvas.height * heightMultiplier;
        line(x, y, x, canvas.height - y, false);
      }

      ctx.stroke();
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
  }, [count, lineColor, heightMultiplier, speed, lineWidth, direction]);

  return <canvas ref={canvasRef} className={className} style={{ display: "block" }} />;
};

export { AnimatedCanvas };
