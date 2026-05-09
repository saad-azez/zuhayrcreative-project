"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

interface LoadingScreenProps {
  onComplete: () => void;
}

const COMPANY_NAME = "Zuhayr Creative";
const CHARS = COMPANY_NAME.split("");

const REVEAL_END = (CHARS.length - 1) * 0.04 + 0.3;

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline();

      tl.to(".ldr-char", {
        opacity: 1,
        scale: 1,
        duration: 0.3,
        ease: "power3.out",
        stagger: { each: 0.04 },
        delay: 0.5,
      });

      tl.to(
        containerRef.current,
        {
          yPercent: -100,
          duration: 0.7,
          ease: "power4.inOut",
          onComplete,
        },
        REVEAL_END + 1,
      );
    },
    { scope: containerRef },
  );

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden will-change-transform bg-maroon-deep"
    >
      <div
        className="flex items-center justify-center select-none"
        style={{ gap: "2px" }}
        role="heading"
        aria-level={1}
        aria-label={COMPANY_NAME}
      >
        {CHARS.map((char, i) =>
          char === " " ? (
            <span
              key={`sp-${i}`}
              className="ldr-char inline-block"
              aria-hidden="true"
              style={{ width: "0.3em", opacity: 0 }}
            />
          ) : (
            <span
              key={`ch-${i}`}
              className="ldr-char inline-block text-white"
              aria-hidden="true"
              style={{
                fontFamily: "var(--font-geist-sans)",
                fontSize: "clamp(2.4rem, 5.8vw, 3.875rem)",
                fontWeight: 600,
                letterSpacing: "0.04em",
                lineHeight: 1,
                opacity: 0,
                transform: "scale(3.5)",
                transformOrigin: "center center",
                willChange: "transform, opacity",
              }}
            >
              {char}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
