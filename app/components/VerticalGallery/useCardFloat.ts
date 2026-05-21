"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Gentle y-axis float on cards — staggered drift with yoyo.
 * Returns a ref to attach to the container element.
 */
export function useCardFloat(
  selector: string,
): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const cards =
        containerRef.current?.querySelectorAll<HTMLElement>(selector);
      if (!cards || cards.length === 0) return;

      for (let i = 0; i < cards.length; i++) {
        gsap.to(cards[i], {
          y: `${8 + (i % 3) * 6}px`,
          duration: 3.5 + (i % 4) * 0.7,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: i * 0.35,
        });
      }
    },
    { scope: containerRef },
  );

  return containerRef;
}
