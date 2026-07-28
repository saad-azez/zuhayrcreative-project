"use client";

import type { CSSProperties } from "react";
import { useCursorPosition } from "./VerticalGallery/useCursorPosition";

// CSS in globals.css already handles hiding on touch devices:
// @media (hover: none) and (pointer: coarse) { .gallery-cursor { display: none } }
export default function GlobalCursor() {
  const { cursorRef } = useCursorPosition({ lerp: 0.07, offsetFactor: 0.5 });

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
