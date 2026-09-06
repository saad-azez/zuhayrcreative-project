"use client";

/**
 * Mutes three.js deprecation notices we cannot act on.
 *
 * ── Why a filter, which is normally the wrong answer ──
 * `THREE.Clock: This module has been deprecated` is emitted by
 * @react-three/fiber, not by us: it builds its store with
 * `clock: new THREE.Clock()`, and that clock is `state.clock` — part of
 * r3f's public API, reachable from every useFrame callback on the page.
 * Checked against the source rather than assumed: 9.7.0, the newest
 * release, still has the same line as the 9.6.1 we are on, so upgrading
 * does not silence it and nothing in application code can.
 *
 * That leaves a warning nobody can fix, printed on every load, dragging a
 * ~150-line React commit stack behind it in the console — which is not a
 * cosmetic problem. A console with one permanent unfixable entry in it is
 * a console people stop reading, and the last few real bugs here were
 * found by reading exactly these lines.
 *
 * So it is muted, and the mute is deliberately narrow: an exact prefix,
 * on one named message, on console.warn only. Anything three.js has to
 * say that is not on this list still comes through.
 *
 * ── When to delete this ──
 * When @react-three/fiber stops constructing THREE.Clock (watch its
 * store.ts), or when three drops the class and the notice with it. Check
 * by removing the import in WebglBudget and reloading: if no THREE.Clock
 * line appears, this file has outlived its reason.
 */

const MUTED_PREFIXES = ["THREE.Clock: This module has been deprecated"];

let installed = false;

export function quietThreeDeprecations() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  const original = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      MUTED_PREFIXES.some((prefix) => first.startsWith(prefix))
    ) {
      return;
    }
    original(...args);
  };
}
