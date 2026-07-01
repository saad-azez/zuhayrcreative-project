"use client";

import React from "react";

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

  const shell =
    `group relative ${fullWidth ? "flex" : "inline-flex"} items-center gap-2.5 ${radius} ` +
    `px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white ` +
    `bg-white/[0.05] border border-white/[0.12] backdrop-blur-md ` +
    `shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_10px_30px_rgba(0,0,0,0.35)] ` +
    `transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ` +
    `hover:border-[#C4010D]/60 hover:bg-white/[0.08] ` +
    `hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.24),0_12px_44px_rgba(196,1,13,0.30)] ` +
    `active:scale-[0.98] ${fullWidth ? width : ""} ` +
    className;

  const content = (
    <>
      {/* Light sheen sweep on hover */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden ${radius}`}
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-[120%]" />
      </span>

      <span className="relative z-10 whitespace-nowrap">{label}</span>
      <span
        aria-hidden
        className="relative z-10 transition-transform duration-300 group-hover:translate-x-0.5"
      >
        &rarr;
      </span>

      {/* "Accepting new projects" badge — bounces in beneath the button on hover.
          The badge itself animates with a gentle bounce; the dot's inner ring
          pings AND the solid dot pulses so it reads as actively "live". */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-full z-20 mt-3 inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/10 bg-[#0e0e0e]/90 px-3 py-1.5 text-[0.72rem] font-medium normal-case tracking-normal text-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md opacity-0 translate-y-2 transition-[opacity,transform] duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-hover:animate-bounce"
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#C4010D] opacity-75 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C4010D] animate-pulse" />
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
