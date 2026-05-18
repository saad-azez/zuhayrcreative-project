"use client";

import React, { useRef, useEffect, useMemo } from "react";

interface GlassPanelProps {
  /** Number of glass ribs (default 28) */
  ribCount?: number;
  /** Blur intensity in px (default 8) */
  blurPx?: number;
  /** Contrast multiplier (default 1.15) */
  ribContrast?: number;
}

/**
 * Glass panel overlay — right-half frosted glass with ribs,
 * edge highlights, sheen, and vignette.
 */
const GlassPanel = React.memo(function GlassPanel({
  ribCount = 28,
  blurPx = 8,
  ribContrast = 1.15,
}: GlassPanelProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const ribs = useMemo(() => {
    const items: React.ReactNode[] = [];
    const bH = 1.0 + (ribContrast - 1.0) * 0.12;
    const bL = 1.0 - (ribContrast - 1.0) * 0.12;

    for (let i = 0; i < ribCount; i++) {
      const frac = i / (ribCount - 1 || 1);
      const bri = bL + (bH - bL) * frac;
      const alpha = 0.6 + 0.4 * Math.sin(frac * Math.PI);

      items.push(
        <div key={i} className="flex-1 relative h-full overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${blurPx}px)`,
              WebkitBackdropFilter: `blur(${blurPx}px)`,
              background: `rgba(255,255,255,${(alpha * 0.06).toFixed(3)})`,
            }}
          />
          <div
            className="absolute inset-0 z-3 pointer-events-none"
            style={{
              background: `rgba(255,255,255,${(bri * 0.04).toFixed(3)})`,
            }}
          />
          <div className="glass-panel__rib-spec" />
        </div>,
      );
    }
    return items;
  }, [ribCount, blurPx, ribContrast]);

  return (
    <div className="absolute right-0 top-0 w-1/2 h-full z-3 overflow-hidden pointer-events-none">
      <div ref={wrapRef} className="absolute inset-0 z-2 flex">
        {ribs}
      </div>
      <div className="glass-panel__left-edge" />
      <div className="glass-panel__top-edge" />
      <div className="glass-panel__sheen" />
      <div className="glass-panel__vignette" />
    </div>
  );
});

export default GlassPanel;
