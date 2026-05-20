import React from "react";
import Image from "next/image";
import { SOCIAL_LINKS, MAROON_HAIRLINE } from "./contactData";
import { fadeUpStyle } from "./contact-animations";

interface BottomBarProps {
  inView: boolean;
}

/** Single social icon link — tiny leaf, no need for separate file */
const SocialIcon = React.memo(function SocialIcon({
  social,
}: {
  social: (typeof SOCIAL_LINKS)[number];
}) {
  return (
    <a
      href={social.href}
      aria-label={social.ariaLabel}
      className="w-9.5 h-9.5 sm:w-8.5 sm:h-8.5 rounded-lg flex items-center justify-center transition-all duration-200 group active:scale-95"
    >
      <svg
        className="w-4.5 h-4.5 sm:w-4 sm:h-4 group-hover:fill-white transition-colors"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        fill="var(--title-red)"
        aria-hidden="true"
      >
        <path d={social.svg} />
      </svg>
    </a>
  );
});

/**
 * Footer bottom bar: logo + legal links on the left, social icons on the right.
 * Reorders on mobile (socials first, then legal).
 */
const BottomBar = React.memo(function BottomBar({ inView }: BottomBarProps) {
  return (
    <div
      style={{
        borderTop: MAROON_HAIRLINE,
        ...fadeUpStyle(300, inView),
      }}
      className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 pt-6 sm:pt-8"
    >
      {/* Legal / copyright column */}
      <div className="flex flex-col gap-1 order-3 md:order-1 text-center md:text-left">
        <span className="inline-flex items-center gap-2">
          <span className="w-7 h-7 flex items-center justify-center p-1">
            <Image
              src="/logo.png"
              alt="Zuhayr Holdings"
              width={20}
              height={20}
              className="w-full h-full object-contain"
            />
          </span>
          <a
            href="#"
            className="text-xs sm:text-sm text-foreground-muted hover:text-title-red transition-colors"
          >
            A concern of Zuhayr Holdings &rarr;
          </a>
        </span>
        <span className="text-[11px] text-foreground-subtle ml-8">
          A trading name of Zuhayr Media LTD.
        </span>
        <span className="text-[11px] text-foreground-subtle ml-8">
          &copy; ZUHAYR CREATIVE. ALL RIGHTS RESERVED.
        </span>
      </div>

      {/* Social icons */}
      <div className="flex items-center gap-2 sm:gap-2.5 order-1 md:order-2">
        {SOCIAL_LINKS.map((social) => (
          <SocialIcon key={social.icon} social={social} />
        ))}
      </div>
    </div>
  );
});

export default BottomBar;
