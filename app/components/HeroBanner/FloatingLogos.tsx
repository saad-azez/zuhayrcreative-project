"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

const LOGO_COUNT_DESKTOP = 22;
const LOGO_COUNT_MOBILE = 8;

/**
 * Floating logos background layer.
 * Uses pure CSS keyframe animations (not GSAP) for optimal performance.
 * Reduces logo count on mobile and respects reduced motion.
 */
const FloatingLogos = React.memo(function FloatingLogos() {
  const [count, setCount] = useState(LOGO_COUNT_DESKTOP);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mqMobile = window.matchMedia("(max-width: 767px)");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => {
      setCount(mqMobile.matches ? LOGO_COUNT_MOBILE : LOGO_COUNT_DESKTOP);
      setReducedMotion(mqMotion.matches);
    };
    update();

    mqMobile.addEventListener("change", update);
    mqMotion.addEventListener("change", update);
    return () => {
      mqMobile.removeEventListener("change", update);
      mqMotion.removeEventListener("change", update);
    };
  }, []);

  if (reducedMotion) return null;

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="floating-logo-container">
          <Image
            className="floating-logo-img"
            src="/logo_banner.png"
            alt=""
            width={300}
            height={300}
            priority={i < 4}
            loading={i < 4 ? undefined : "lazy"}
          />
        </div>
      ))}
    </>
  );
});

export default FloatingLogos;
