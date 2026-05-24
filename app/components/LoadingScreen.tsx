"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

interface LoadingScreenProps {
  onComplete: () => void;
  onNearComplete?: () => void;
}

const COMPANY_NAME = "Zuhayr Creative";
const CHARS = COMPANY_NAME.split("");

export default function LoadingScreen({
  onComplete,
  onNearComplete,
}: LoadingScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container) return;
      const creativeChars = container.querySelectorAll<HTMLElement>(
        '[data-creative="true"]',
      );
      const cursor = container.querySelector<HTMLElement>(".typing-cursor");
      if (!cursor) return;

      const tl = gsap.timeline();

      // Phase 1: Stagger zoom-in only "Zuhayr" chars
      tl.to('[data-creative="false"]', {
        opacity: 1,
        scale: 1,
        duration: 0.3,
        ease: "power3.out",
        stagger: { each: 0.04 },
        delay: 0.5,
      });

      // Phase 2: Typewriter reveal "Creative" chars + cursor
      tl.call(() => {
        if (onNearComplete) onNearComplete();
      });

      tl.set(cursor, { opacity: 1 });

      tl.to(creativeChars, {
        opacity: 1,
        duration: 0.12,
        ease: "none",
        stagger: { each: 0.14 },
      });

      // Phase 3: Blink cursor a few times, then hide + fire onComplete
      tl.to(cursor, {
        opacity: 0,
        duration: 0.15,
        ease: "none",
        repeat: 3,
        yoyo: true,
      });

      tl.set(cursor, { opacity: 0 });

      tl.call(() => {
        if (onComplete) onComplete();
      });
    },
    { scope: containerRef },
  );

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-9999 flex items-center justify-center overflow-hidden will-change-transform bg-linear-to-br from-background via-background-secondary to-maroon-deep"
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
              data-creative={i >= 7 ? "true" : "false"}
              style={{
                fontFamily:
                  i >= 7 ? "var(--font-caveat)" : "var(--font-geist-sans)",
                fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
                fontWeight: i >= 7 ? 500 : 600,
                letterSpacing: i >= 7 ? "0.02em" : "0.04em",
                lineHeight: 1,
                opacity: 0,
                transform: i >= 7 ? "scale(1)" : "scale(3.5)",
                transformOrigin: "center center",
                willChange: "transform, opacity",
              }}
            >
              {char}
            </span>
          ),
        )}
        <span
          className="typing-cursor inline-block text-title-red"
          aria-hidden="true"
          style={{
            fontFamily: "var(--font-caveat)",
            fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
            fontWeight: 500,
            lineHeight: 1,
            opacity: 0,
            willChange: "opacity",
          }}
        >
          |
        </span>
      </div>
    </div>
  );
}
