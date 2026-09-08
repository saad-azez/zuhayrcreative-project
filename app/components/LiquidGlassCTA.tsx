"use client";

import React from "react";
import ChromaticMetal from "./ChromaticMetal";

interface LiquidGlassCTAProps {
  /** Button label, e.g. "Send Inquiry". */
  label: string;
  /** Tooltip text that reveals below the button on hover. */
  tooltip?: string;
  /** Render as a link when set; otherwise a <button>. */
  href?: string;
  /** Button type when rendered as a <button>. */
  type?: "button" | "submit";
  /** Rectangular corners (10px radius) matching the navbar toggle. Default is pill. */
  rect?: boolean;
  /** Stretch to full width of parent container. */
  fullWidth?: boolean;
  className?: string;
}

/**
 * Liquid-glass CTA with the "accepting new projects" hover badge: a frosted-
 * glass pill/rect that keeps its label, and on hover a small dark tooltip badge
 * fades up beneath it with a bouncing entrance and a flashing brand-red dot.
 * Renders as <a> when `href` is set, otherwise a <button>.
 */
export default function LiquidGlassCTA({
  label,
  tooltip = "Accepting new projects",
  href,
  type = "button",
  rect = false,
  fullWidth = false,
  className = "",
}: LiquidGlassCTAProps) {
  const radius = rect ? "rounded-[10px]" : "rounded-full";
  const width  = fullWidth ? "w-full justify-center" : "inline-flex";

  // The glass — texture, edge, hover and press — is the shared
  // .liquid-glass skin (globals.css), the site's one glass; nothing here
  // overrides it. The utilities are layout and type only.
  const shell =
    `liquid-glass group relative ${fullWidth ? "flex" : "inline-flex"} items-center gap-2.5 ${radius} ` +
    `px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white ` +
    `${fullWidth ? width : ""} ` +
    className;

  const content = (
    <>
      {/* Chromatic-metal border — flowing chrome rim on the CTA shell.
          (The hover tooltip badge below keeps the plain CSS rim.) */}
      <ChromaticMetal />

      <span className="relative z-10 whitespace-nowrap">{label}</span>
      <span
        aria-hidden
        className="relative z-10 transition-transform duration-300 group-hover:translate-x-0.5"
      >
        &rarr;
      </span>

      {/* "Accepting new projects" badge — bounces in beneath the button on hover.
          The badge itself animates with a gentle bounce; the dot's inner ring
          pings AND the solid dot pulses so it reads as actively "live".
          -right-px (not right-3) so its right edge lines up flush with the
          button's, rather than sitting 12px inside it. The extra pixel offsets
          the shell's 1px border: an absolutely-positioned child anchors to the
          padding box, so a plain right-0 would still land 1px short of the
          button's visible outer edge. */}
      <span
        aria-hidden
        className="liquid-glass pointer-events-none absolute -right-px top-full z-20 mt-5 inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-[0.72rem] font-medium normal-case tracking-normal text-white opacity-0 translate-y-2 transition-[opacity,transform] duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#ff2a45] opacity-90 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff2a45] shadow-[0_0_10px_2px_rgba(255,42,69,0.9)] animate-pulse" />
        </span>
        {tooltip}
      </span>
    </>
  );

  if (href) {
    return <a href={href} className={shell}>{content}</a>;
  }
  return (
    <button type={type} className={shell}>
      {content}
    </button>
  );
}
