"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import { useCursorPosition } from "./VerticalGallery/useCursorPosition";

export default function GlobalCursor() {
  const { isTouch } = useDeviceDetect();
  const { cursorRef } = useCursorPosition({ lerp: 0.07, offsetFactor: 0.5 });
  const [isVisible] = useState(true);

  if (isTouch) return null;

  return (
    <div
      ref={cursorRef}
      className={`gallery-cursor${isVisible ? " is-visible" : ""}`}
      aria-hidden="true"
      style={{ "--cursor-size": "80px" } as CSSProperties}
    >
      <div className="cursor-logo" />
    </div>
  );
}
