"use client";

import React from "react";
import Image from "next/image";

const LOGO_COUNT = 25;

/**
 * Floating logos background layer.
 * Uses pure CSS keyframe animations (not GSAP) for optimal performance
 * with 20 simultaneous float paths.
 */
const FloatingLogos = React.memo(function FloatingLogos() {
  return (
    <>
      {Array.from({ length: LOGO_COUNT }, (_, i) => (
        <div key={i} className="floating-logo-container">
          <Image
            className="floating-logo-img"
            src="/logo.png"
            alt="Zuhayr Creative logo"
            width={300}
            height={300}
            priority={i < 6}
            loading={i < 6 ? undefined : "lazy"}
          />
        </div>
      ))}
    </>
  );
});

export default FloatingLogos;
