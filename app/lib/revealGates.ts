"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Reveal gates — the things the loader waits for before it lifts.
 *
 * The loader used to wait on `window.load`, the browser's "everything the
 * document pulled in has arrived". On the landing page that meant the work
 * strip's eight photographs, the footer's flag, a dock icon and the globe's
 * textures — none of them visible when the curtain lifts — and on a slow
 * phone they held the site behind the curtain for ten seconds while the hero's
 * own background scene had not even started loading.
 *
 * So the loader now waits for what the reader will actually SEE: fonts, the
 * images inside the first viewport, and whichever scenes register a gate here.
 * A scene registers itself when it mounts and settles the gate when its first
 * frame is ready (or when it fails — a scene that will never arrive must not
 * hold the page). Anything below the fold is nobody's business until the
 * reader scrolls toward it.
 *
 * Registration is a LAYOUT effect on purpose. React runs every layout effect
 * in the committed tree before any passive effect, and the loader reads the
 * registry from a passive effect — so a gate registered this way is always in
 * place before the loader looks, whatever order the components sit in.
 */
type Gate = { promise: Promise<void>; settle: () => void };

const gates = new Map<string, Gate>();

function createGate(): Gate {
  let settle: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

/** Settle (or leave settled) the named gate. Safe to call any number of times. */
export function settleGate(id: string): void {
  gates.get(id)?.settle();
}

/**
 * A promise for every gate registered by the time it is read — after one
 * frame, so a scene that commits a beat later than the loader still counts.
 */
export function gatesSettled(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      Promise.all(Array.from(gates.values(), (g) => g.promise)).then(
        () => resolve(),
        () => resolve(),
      );
    });
  });
}

/**
 * Register a reveal gate for the component's lifetime and get back the
 * function that settles it. The gate is settled on unmount as well, so a
 * scene that is torn down before it loaded cannot strand the loader.
 */
export function useRevealGate(id: string): () => void {
  const gateRef = useRef<Gate | null>(null);

  useLayoutEffect(() => {
    // Two components claiming one id share a gate rather than fighting over
    // it; the first to settle releases both. (StrictMode's double-mount goes
    // through the cleanup below in between, so it simply gets a fresh gate.)
    const gate = gates.get(id) ?? createGate();
    gates.set(id, gate);
    gateRef.current = gate;
    return () => {
      gate.settle();
      if (gates.get(id) === gate) gates.delete(id);
      gateRef.current = null;
    };
  }, [id]);

  return useCallback(() => {
    gateRef.current?.settle();
    gates.get(id)?.settle();
  }, [id]);
}
