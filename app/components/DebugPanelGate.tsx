"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

/**
 * The performance debug panel's gate: renders the panel only when the page
 * was opened with `?debug=1` (or this tab has had it since), and only then is
 * the panel's code downloaded. For every other visitor this is the whole of
 * it: one check, nothing drawn, nothing measured. See lib/perfDebug.ts.
 */

const DebugPanel = dynamic(() => import("./DebugPanel"), { ssr: false });

const FLAG_KEY = "perfDebug";

/** The same rule as lib/perfDebug's debugFlag, here so that module is not loaded to ask. */
function flagOn(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("debug");
  try {
    if (q === "1") sessionStorage.setItem(FLAG_KEY, "1");
    if (q === "0") sessionStorage.removeItem(FLAG_KEY);
    return sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return q === "1";
  }
}

// From this module's first evaluation, with the first client JS: every frame
// over 100ms, kept until the panel's collector takes over. The panel loads
// later, and the loading screen's freezes are among the ones being looked for.
if (typeof window !== "undefined" && flagOn()) {
  const w = window as Window & { __perfEarly?: [number, number][]; __perfEarlyStop?: boolean };
  w.__perfEarly = [];
  let last = performance.now();
  const tick = () => {
    const t = performance.now();
    if (t - last >= 100) w.__perfEarly!.push([last, t - last]);
    last = t;
    if (!w.__perfEarlyStop) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const noSubscribe = () => () => {};

export default function DebugPanelGate() {
  // False on the server and in the first client render (the markup matches),
  // then the flag.
  const on = useSyncExternalStore(noSubscribe, flagOn, () => false);
  return on ? <DebugPanel /> : null;
}
