"use client";

import { useEffect } from "react";

export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Only activate smooth scroll on pointer/mouse devices (desktop)
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;

    let locomotiveScroll: { destroy: () => void } | null = null;
    let destroyed = false;

    const init = async () => {
      const [{ default: LocomotiveScroll }, { gsap }, { ScrollTrigger }] =
        await Promise.all([
          import("locomotive-scroll"),
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);

      if (destroyed) return;

      // Prevent GSAP lag smoothing from fighting with Lenis lerp
      gsap.ticker.lagSmoothing(0);

      locomotiveScroll = new LocomotiveScroll({
        lenisOptions: {
          lerp: 0.1,
          smoothWheel: true,
          smoothTouch: false,
        },
        // Hand off RAF to GSAP ticker so GSAP animations stay in sync
        initCustomTicker: (render) => {
          gsap.ticker.add(render);
        },
        destroyCustomTicker: (render) => {
          gsap.ticker.remove(render);
        },
        // Keep GSAP ScrollTrigger in sync with Lenis scroll position
        scrollCallback: () => {
          ScrollTrigger.update();
        },
      });
    };

    init();

    return () => {
      destroyed = true;
      locomotiveScroll?.destroy();
    };
  }, []);

  return <>{children}</>;
}
