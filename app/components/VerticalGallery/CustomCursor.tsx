"use client";

import { memo } from "react";
import { useCursorPosition } from "./useCursorPosition";

interface CustomCursorProps {
  isVisible: boolean;
  isOpen: boolean;
}

/**
 * Custom cursor — uses GSAP quickTo for GPU-accelerated position tracking.
 * Renders a circular cross button that rotates when open.
 */
const CustomCursor = memo(function CustomCursor({
  isVisible,
  isOpen,
}: CustomCursorProps) {
  const { cursorRef } = useCursorPosition({ lerp: 0.15 });

  const cursorClasses = [
    "gallery-cursor",
    isVisible && "is-visible",
    isOpen && "is-open",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={cursorRef} className={cursorClasses} data-cursor="container">
      <div className="cross_button" />
    </div>
  );
});

export default CustomCursor;
