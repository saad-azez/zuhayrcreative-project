"use client";

import { useEffect, useState } from "react";

/**
 * TEMPORARY — a readout of what the phone reports for the viewport, to
 * settle why the hero does not reach the bottom of the iPhone's screen
 * under Safari's see-through toolbar. Dev server only, and only with
 * `?vh=1` in the address. Delete once the hero is settled.
 *
 * Sits mid-screen, NOT at an edge: iOS 26 Safari tints its bars from
 * fixed elements near the screen's edges.
 */
export default function ViewportProbe() {
  const [lines, setLines] = useState<string[] | null>(null);

  useEffect(() => {
    if (!new URLSearchParams(location.search).has("vh")) return;
    // Rulers: one element per unit, measured rather than computed.
    const ruler = (css: string) => {
      const d = document.createElement("div");
      d.style.cssText = `position:absolute;left:-9999px;top:0;width:1px;${css}`;
      document.body.appendChild(d);
      return d;
    };
    const r = {
      svh: ruler("height:100svh"),
      lvh: ruler("height:100lvh"),
      dvh: ruler("height:100dvh"),
      vh: ruler("height:100vh"),
      safe: ruler(
        "padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);height:0",
      ),
    };
    const read = () => {
      const hero = document.getElementById("hero-banner");
      const hb = hero?.getBoundingClientRect();
      // The first following element that takes up space (services).
      let sib = hero?.nextElementSibling as HTMLElement | null | undefined;
      while (sib && sib.offsetHeight === 0) sib = sib.nextElementSibling as HTMLElement | null;
      const next = sib?.getBoundingClientRect();
      const safe = getComputedStyle(r.safe);
      const vv = window.visualViewport;
      setLines([
        `screen ${screen.width}x${screen.height}  dpr ${devicePixelRatio}`,
        `innerH ${innerHeight}  clientH ${document.documentElement.clientHeight}`,
        `visualVP ${vv ? `${Math.round(vv.height)} @${Math.round(vv.offsetTop)}` : "-"}`,
        `svh ${r.svh.offsetHeight}  lvh ${r.lvh.offsetHeight}  dvh ${r.dvh.offsetHeight}  vh ${r.vh.offsetHeight}`,
        `safe top ${safe.paddingTop}  bottom ${safe.paddingBottom}`,
        `hero h ${hero?.offsetHeight ?? "-"}  top ${hb ? Math.round(hb.top) : "-"}  bottom ${hb ? Math.round(hb.bottom) : "-"}`,
        `next top ${next ? Math.round(next.top) : "-"}  scrollY ${Math.round(scrollY)}`,
        `standalone ${String((navigator as Navigator & { standalone?: boolean }).standalone ?? "-")}`,
      ]);
    };
    read();
    const iv = window.setInterval(read, 400);
    return () => {
      window.clearInterval(iv);
      Object.values(r).forEach((d) => d.remove());
    };
  }, []);

  if (!lines) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: 8,
        top: "38%",
        zIndex: 2147483647,
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(0,0,0,0.82)",
        color: "#7CFFB2",
        font: "11px/1.45 ui-monospace, Menlo, monospace",
        whiteSpace: "pre",
        pointerEvents: "none",
      }}
    >
      {lines.join("\n")}
    </div>
  );
}
