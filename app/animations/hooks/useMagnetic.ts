"use client";

import { useEffect, type RefObject } from "react";

/**
 * Magnetic hover — while the pointer is within reach, the element eases toward
 * it and snaps back on leave (the award-site "buttons that lean toward your
 * cursor" feel). Apply to a WRAPPER around the real control so it never fights
 * the control's own hover/active transforms. Pure rAF + inline transform; no
 * React state, no re-renders. No-ops on touch / reduced-motion.
 */
export function useMagnetic(
  ref: RefObject<HTMLElement | null>,
  { strength = 0.35, radius = 80 }: { strength?: number; radius?: number } = {},
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    let raf = 0;
    let curX = 0;
    let curY = 0;
    let tgtX = 0;
    let tgtY = 0;
    let engaged = false;

    const tick = () => {
      curX += (tgtX - curX) * 0.18;
      curY += (tgtY - curY) * 0.18;
      const settled =
        Math.abs(tgtX - curX) < 0.1 && Math.abs(tgtY - curY) < 0.1;
      if (settled && !engaged) {
        el.style.transform = "";
        raf = 0;
        return;
      }
      el.style.transform = `translate(${curX.toFixed(2)}px, ${curY.toFixed(2)}px)`;
      raf = requestAnimationFrame(tick);
    };
    const ensure = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const reach = radius + Math.max(r.width, r.height) / 2;
      if (Math.hypot(dx, dy) < reach) {
        engaged = true;
        tgtX = dx * strength;
        tgtY = dy * strength;
        ensure();
      } else if (engaged) {
        engaged = false;
        tgtX = 0;
        tgtY = 0;
        ensure();
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [ref, strength, radius]);
}
