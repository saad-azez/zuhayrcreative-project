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
  className?: string;
}

/**
 * Liquid-glass pill CTA with the "accepting new projects" hover motion: a
 * frosted-glass capsule that keeps its label, and on hover a small dark
 * tooltip badge fades up beneath it. A light sheen sweeps across and the glass
 * warms with a brand-red (#C4010D) border/glow — the only chromatic accent.
 * Renders as <a> when `href` is set, otherwise a <button>.
 */
export default function LiquidGlassCTA({
  label,
  tooltip = "Accepting new projects",
  href,
  type = "button",
  className = "",
}: LiquidGlassCTAProps) {
  const shell =
    "group relative inline-flex items-center gap-2.5 rounded-full " +
    "px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white " +
    "bg-white/[0.05] border border-white/[0.12] backdrop-blur-md " +
    "shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_10px_30px_rgba(0,0,0,0.35)] " +
    "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] " +
    "hover:border-[#C4010D]/60 hover:bg-white/[0.08] " +
    "hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.24),0_12px_44px_rgba(196,1,13,0.30)] " +
    "active:scale-[0.98] " +
    className;

  const content = (
    <>
      {/* Light sheen sweep on hover — clipped to the pill so it never bleeds
          onto the tooltip below. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
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

      {/* "Accepting new projects" badge — fades up beneath the button on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-full z-20 mt-3 inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/10 bg-[#0e0e0e]/90 px-3 py-1.5 text-[0.72rem] font-medium normal-case tracking-normal text-white/90 opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md translate-y-1.5 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100"
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#C4010D] opacity-75 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C4010D]" />
        </span>
        {tooltip}
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={shell}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={shell}>
      {content}
    </button>
  );
}
