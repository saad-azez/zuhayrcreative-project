import React from "react";
import { fadeUpStyle, LETS_TALK_GRADIENT } from "./contact-animations";

interface LetsTalkCTAProps {
  inView: boolean;
}

/**
 * Giant "LET'S-TALK" call-to-action with maroon gradient text.
 * Links to the inquiry email. Subtle scale-on-hover.
 */
const LetsTalkCTA = React.memo(function LetsTalkCTA({
  inView,
}: LetsTalkCTAProps) {
  return (
    <div
      style={fadeUpStyle(200, inView)}
      className="py-8 sm:py-12 md:py-16 overflow-hidden flex justify-center"
    >
      <a
        href="mailto:inquiry@zuhayrcreative.org"
        className="group w-full flex items-center justify-center gap-4 transition-transform duration-500 hover:scale-[1.02]"
      >
        <span
          className="relative inline-block text-[clamp(3.5rem,13vw,11rem)] font-black tracking-tight leading-[0.9] whitespace-nowrap"
          style={LETS_TALK_GRADIENT}
        >
          LET&apos;S-TALK
        </span>
      </a>
    </div>
  );
});

export default LetsTalkCTA;
