import React from "react";
import { fadeUpStyle } from "./contact-animations";

interface TaglineQuoteProps {
  inView: boolean;
}

/**
 * Quoted brand tagline with thin maroon hairline accents.
 * React.memo prevents re-render unless `inView` changes.
 */
const TaglineQuote = React.memo(function TaglineQuote({
  inView,
}: TaglineQuoteProps) {
  return (
    <div
      style={fadeUpStyle(0, inView)}
      className="flex flex-col items-center pb-8 sm:pb-10"
    >
      <div className="w-12 h-px bg-title-red/40 mb-6" />
      <p className="text-foreground text-base sm:text-lg md:text-xl max-w-4xl leading-relaxed tracking-wide text-center font-light italic">
        &ldquo;Zuhayr Creative partners with businesses that value structured
        strategy, disciplined execution, and measurable results.&rdquo;
      </p>
      <div className="w-12 h-px bg-title-red/40 mt-6" />
    </div>
  );
});

export default TaglineQuote;
