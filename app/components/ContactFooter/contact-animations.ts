import type React from "react";
import { FADE_EASING, FADE_DURATION, FADE_OFFSET } from "./contactData";

/**
 * Returns CSSProperties for a fade-up reveal.
 * Extracted to avoid inline objects in JSX (refactor rule 11).
 *
 * When `inView` is false the element sits FADE_OFFSET px lower with opacity 0.
 * When `inView` flips to true the CSS transition animates it into place.
 */
export function fadeUpStyle(
  delayMs: number,
  inView: boolean,
): React.CSSProperties {
  return {
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : `translateY(${FADE_OFFSET}px)`,
    transition: [
      `opacity ${FADE_DURATION}ms ${FADE_EASING} ${delayMs}ms`,
      `transform ${FADE_DURATION}ms ${FADE_EASING} ${delayMs}ms`,
    ].join(", "),
    willChange: "transform, opacity",
  };
}

/** Gradient text style for the LET'S-TALK CTA */
export const LETS_TALK_GRADIENT: React.CSSProperties = {
  fontFamily: "var(--font-geist-sans)",
  background:
    "linear-gradient(to bottom, var(--title-red) 0%, var(--title-red) 25%, rgb(128 27 47 / 22%) 80%, #00000087 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};
