"use client";

/**
 * Diagnostics for the Unicorn Studio scenes — specifically for "the footer
 * background does not appear, or appears late".
 *
 * The scenes fail SILENTLY. A scene that never got a WebGL context, one whose
 * context was evicted, and one that is merely still booting all look the same
 * on screen: the section's own flat base colour. Nothing throws, so there is
 * nothing in the console to read. This makes each of those states say so.
 *
 * ── Turning it on ──
 *   anywhere       add `?unicorn-debug` to the URL
 *   or, sticky     localStorage.setItem("unicorn-debug", "1")   (survives reloads
 *                  and navigations — the one to give a client on their phone)
 *   off            localStorage.setItem("unicorn-debug", "0")
 *
 * Every line is prefixed `[unicorn]` and carries the scene's name and the ms
 * since the page began, so a fast scroll to the footer produces a readable
 * timeline of who asked for a context, who got one, and who was refused.
 */

const PREFIX = "[unicorn]";

export const unicornDebugEnabled = (() => {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("unicorn-debug")) return true;
    const stored = window.localStorage.getItem("unicorn-debug");
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    // Private mode can throw on localStorage; fall through to the default.
  }
  // Off unless asked for, dev included. On by default this is ~40 lines
  // per load — a scene census, a grant per context, a reaper line per
  // sweep — which buries anything else anyone is trying to read. The
  // numbers that matter to a bug outside these scenes are folded into
  // that bug's own report; turn this back on with ?unicorn-debug when
  // the scenes themselves are what is under investigation.
  return false;
})();

const t0 =
  typeof performance !== "undefined" ? performance.now() : 0;

/** ms since this module loaded, which is close enough to "since page start". */
export const since = () =>
  Math.round((typeof performance !== "undefined" ? performance.now() : 0) - t0);

export function ulog(scene: string, event: string, data?: unknown) {
  if (!unicornDebugEnabled) return;
  const head = `${PREFIX} ${String(since()).padStart(6)}ms  ${scene.padEnd(18)} ${event}`;
  if (data === undefined) console.log(head);
  else console.log(head, data);
}

export function uwarn(scene: string, event: string, data?: unknown) {
  if (!unicornDebugEnabled) return;
  const head = `${PREFIX} ${String(since()).padStart(6)}ms  ${scene.padEnd(18)} ${event}`;
  if (data === undefined) console.warn(head);
  else console.warn(head, data);
}

/**
 * The context census and the probe reaper live in `webglContexts.ts`: both
 * need the same single `getContext` wrapper, and patching a prototype twice
 * from two modules is how you end up with two of everything. This file is
 * only the logging surface and the flag.
 */
export { installWebglContextManager, getCensus } from "./webglContexts";
