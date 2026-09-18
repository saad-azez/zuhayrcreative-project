"use client";

import { useSyncExternalStore } from "react";

/**
 * Kill switches — turn one expensive thing at a time OFF on a real phone,
 * to find out what it costs there.
 *
 * The site runs at 2–7fps on the client's iPhone and a phone has no
 * profiler. Every heavy piece of the page (each WebGL scene, the blurs,
 * the wipes, the glass) checks a switch here; the debug panel's Device tab
 * lists them as toggles, a reload applies them, and the panel's fps pill
 * shows what changed. Ten minutes on the device beat any guess from here.
 *
 * Inert unless set: nothing reads localStorage on the server, the first
 * client render matches the server's (useSyncExternalStore's server
 * snapshot), and a switch only ever REMOVES work. Set from the URL
 * (`?off=fluid,tunnel`, `?off=` clears) or the panel; kept on the device.
 */

export const KILL_SWITCHES = [
  ["bg", "Page background scene (Unicorn, fixed, always on screen)"],
  ["hero", "Hero background scene (Unicorn)"],
  ["tunnel", "Services text tunnel (WebGL)"],
  ["work", "Work strip flare + bakes (WebGL)"],
  ["globe", "Seasons globe (three.js)"],
  ["dome", "Footer horizon dome (three.js)"],
  ["footer", "Footer background scene (Unicorn)"],
  ["paint", "\"Let's Talk\" metallic paint (WebGL2)"],
  ["fluid", "Water cursor / tap splash (three.js, full screen)"],
  ["navglass", "Navbar toggle's glass shader (WebGL)"],
  ["rim", "Chrome rims: the CSS conic flow + the WebGL tile"],
  ["dock", "Corner dock"],
  ["glass", "Frosted glass (backdrop-filter on every .liquid-glass)"],
  ["seams", "Blur seams between sections (backdrop-filter bands)"],
  ["scrollblur", "Top-of-screen scroll blur strip"],
  ["wipes", "Both section wipes (pixel cascade + stroke)"],
] as const;

export type KillSwitch = (typeof KILL_SWITCHES)[number][0];

const KEY = "mdbg:off";
let cached: Set<string> | null = null;
const listeners = new Set<() => void>();

function read(): Set<string> {
  if (cached) return cached;
  cached = new Set();
  if (typeof window === "undefined") return cached;
  try {
    const m = /[?&]off=([^&#]*)/.exec(location.search);
    if (m) localStorage.setItem(KEY, decodeURIComponent(m[1]));
    const raw = localStorage.getItem(KEY) ?? "";
    for (const s of raw.split(",")) if (s.trim()) cached.add(s.trim());
  } catch {
    /* private mode: nothing is off */
  }
  return cached;
}

/** Is this piece switched off on this device? False on the server. */
export function isOff(name: KillSwitch): boolean {
  return read().has(name);
}

export function getOff(): string[] {
  return [...read()];
}

/** Flip a switch. Takes effect on the next load (the panel offers Reload). */
export function setOff(name: KillSwitch, off: boolean) {
  const s = read();
  if (off) s.add(name);
  else s.delete(name);
  try {
    localStorage.setItem(KEY, [...s].join(","));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

export function clearOff() {
  read().clear();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * The switch as a hook: false during server render and hydration, then the
 * device's answer — so the markup hydrates cleanly and the piece is dropped
 * in the render right after.
 */
export function useKillSwitch(name: KillSwitch): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isOff(name),
    () => false,
  );
}

/**
 * The CSS-only switches (glass, rim) are classes on <html>; called once
 * from the debug install, client side.
 */
export function applyCssSwitches() {
  if (typeof document === "undefined") return;
  const s = read();
  for (const name of ["glass", "rim", "seams"] as const)
    document.documentElement.classList.toggle(`off-${name}`, s.has(name));
}
