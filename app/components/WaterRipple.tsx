"use client";

import { useRef, useEffect, useCallback } from "react";

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  strength: number;
  speed: number;
}

const MAX_RIPPLES = 30;

export default function WaterRipple() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const frameRef = useRef(0);
  const mouseRef = useRef({ x: -9999, y: -9999, prevX: -9999, prevY: -9999 });

  const addRipple = useCallback((x: number, y: number, intensity = 1) => {
    const ripples = ripplesRef.current;
    if (ripples.length >= MAX_RIPPLES) ripples.shift();

    const maxR = 100 + Math.random() * 120 * intensity;
    ripples.push({
      x,
      y,
      radius: 0,
      maxRadius: maxR,
      strength: 0.4 * intensity,
      speed: 0.5 + Math.random() * 0.4,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => {
      const mx = e.clientX;
      const my = e.clientY;
      const prev = mouseRef.current;

      const dx = mx - prev.prevX;
      const dy = my - prev.prevY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 2) {
        const intensity = Math.min(dist / 60, 2);
        addRipple(mx, my, intensity);
      }

      prev.prevX = prev.x;
      prev.prevY = prev.y;
      prev.x = mx;
      prev.y = my;
    };

    window.addEventListener("mousemove", onMove);

    const loop = () => {
      const ripples = ripplesRef.current;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += r.speed;
        r.strength *= 0.992;

        if (r.strength < 0.003 || r.radius > r.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }

        const progress = r.radius / r.maxRadius;
        const alpha = r.strength * (1 - progress);

        // Soft radial gradient ring — no hard lines
        const grad = ctx.createRadialGradient(
          r.x, r.y, r.radius * 0.65,
          r.x, r.y, r.radius,
        );
        grad.addColorStop(0, `rgba(220, 20, 60, 0)`);
        grad.addColorStop(0.3, `rgba(220, 20, 60, ${alpha * 0.35})`);
        grad.addColorStop(0.6, `rgba(200, 50, 80, ${alpha * 0.2})`);
        grad.addColorStop(1, `rgba(220, 20, 60, 0)`);

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Faint outer spread — like water displacement
        if (r.radius > 10) {
          const outerGrad = ctx.createRadialGradient(
            r.x, r.y, r.radius * 0.3,
            r.x, r.y, r.radius * 1.5,
          );
          outerGrad.addColorStop(0, `rgba(255, 255, 255, 0)`);
          outerGrad.addColorStop(0.4, `rgba(255, 255, 255, ${alpha * 0.04})`);
          outerGrad.addColorStop(0.7, `rgba(255, 255, 255, ${alpha * 0.06})`);
          outerGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);

          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = outerGrad;
          ctx.fill();
        }
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [addRipple]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: -5,
        pointerEvents: "none",
      }}
    />
  );
}
