"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { useCursorPosition } from "./VerticalGallery/useCursorPosition";

// CSS in globals.css already handles hiding on touch devices:
// @media (hover: none) and (pointer: coarse) { .gallery-cursor { display: none } }
export default function GlobalCursor() {
  const { cursorRef } = useCursorPosition({ lerp: 0.07, offsetFactor: 0.5 });
  const prevClassRef = useRef<string>("");

  // Watch for any class mutation so we can see exactly who is toggling
  // hide-cursor and when — helps diagnose the cursor flicker on idle screen.
  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;
    prevClassRef.current = el.className;

    const obs = new MutationObserver(() => {
      const next = el.className;
      if (next !== prevClassRef.current) {
        console.log(`[GlobalCursor] class changed: "${prevClassRef.current}" → "${next}"`);
        prevClassRef.current = next;
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [cursorRef]);

  return (
    <div
      ref={cursorRef}
      className="gallery-cursor is-visible"
      aria-hidden="true"
      style={{ "--cursor-size": "30px", zIndex: 99999 } as CSSProperties}
    >
      <div className="cursor-logo" />
    </div>
  );
}
