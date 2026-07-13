"use client";

import { useEffect } from "react";

/**
 * Global "water-drop" feedback layer. Every pointer press sends a subtle ring
 * rippling out from the cursor; a `app:splash` CustomEvent (detail {x, y})
 * fires a bigger, multi-ring brand splash — used by the orbiting-gallery
 * ("ferris wheel") expand. Pure DOM + Web Animations API, mounted once from the
 * template. No-ops under reduced-motion.
 */
export default function ClickRipple() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, {
      position: "fixed",
      inset: "0",
      zIndex: "95", // under navbar (100) / cursor, over content
      pointerEvents: "none",
      overflow: "hidden",
    } as CSSStyleDeclaration);
    document.body.appendChild(layer);

    const ring = (
      x: number,
      y: number,
      {
        size = 16,
        scale = 3,
        dur = 560,
        color = "rgba(255,255,255,0.7)",
        width = 1.5,
      }: { size?: number; scale?: number; dur?: number; color?: string; width?: number } = {},
    ) => {
      const el = document.createElement("span");
      Object.assign(el.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${size}px`,
        height: `${size}px`,
        marginLeft: `${-size / 2}px`,
        marginTop: `${-size / 2}px`,
        borderRadius: "999px",
        border: `${width}px solid ${color}`,
        willChange: "transform, opacity",
      } as CSSStyleDeclaration);
      layer.appendChild(el);
      el.animate(
        [
          { transform: "scale(0.2)", opacity: 0.9 },
          { transform: `scale(${scale})`, opacity: 0 },
        ],
        { duration: dur, easing: "cubic-bezier(0.22,1,0.36,1)" },
      ).onfinish = () => el.remove();
    };

    // Subtle drop on every left-press.
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      ring(e.clientX, e.clientY, { size: 15, scale: 3, dur: 540 });
    };

    // Bigger brand splash on demand (orbiting-gallery expand, etc.).
    const onSplash = (e: Event) => {
      const d = (e as CustomEvent<{ x?: number; y?: number }>).detail;
      if (!d || d.x == null || d.y == null) return;
      ring(d.x, d.y, { size: 44, scale: 4.6, dur: 900, color: "rgba(196,1,13,0.5)", width: 2 });
      window.setTimeout(
        () => ring(d.x!, d.y!, { size: 22, scale: 6, dur: 780, color: "rgba(255,255,255,0.6)" }),
        70,
      );
      window.setTimeout(
        () => ring(d.x!, d.y!, { size: 70, scale: 3.4, dur: 1000, color: "rgba(196,1,13,0.28)", width: 1 }),
        130,
      );
    };

    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("app:splash", onSplash as EventListener);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("app:splash", onSplash as EventListener);
      layer.remove();
    };
  }, []);

  return null;
}
