"use client";

import React from "react";
import { useContactFooterState } from "./useContactFooterState";
import TaglineQuote from "./TaglineQuote";
import ContactRow from "./ContactRow";
import LetsTalkCTA from "./LetsTalkCTA";
import BottomBar from "./BottomBar";

/**
 * Contact footer with IntersectionObserver-driven fade-up reveal.
 *
 * Architecture (per refactor rules):
 * - `useContactFooterState` — IntersectionObserver hook (dedicated state file)
 * - `contactData.ts` — module-level constants (no inline objects)
 * - `contact-animations.ts` — pure style factories (no inline styles in JSX)
 * - Leaf components — each `React.memo`'d, one concern per file
 */
export default function ContactFooter() {
  const { containerRef, inView } = useContactFooterState(0.1);

  return (
    <footer ref={containerRef} className="relative w-full overflow-hidden p-6">
      <div className="bg-background/90 rounded-xl flex flex-col justify-between items-center w-full h-auto p-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-12 sm:py-16 md:py-24 w-full">
          <TaglineQuote inView={inView} />
          <ContactRow inView={inView} />
          <LetsTalkCTA inView={inView} />
          <BottomBar inView={inView} />
        </div>
      </div>
    </footer>
  );
}
