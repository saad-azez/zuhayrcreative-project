"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import UnicornScene from "unicornstudio-react";

const CONTACT_ITEMS = [
  {
    label: "Email:",
    value: "inquiry@zuhayrcreative.org",
    href: "mailto:inquiry@zuhayrcreative.org",
  },
  {
    label: "Office",
    value: "Hong Kong",
  },
];

// Shared display type for the giant LET'S-TALK word. The vertically-stretched
// glyph (scaleY) needs a line-height that exceeds the stretch so it isn't
// clipped; the gradient is painted into the text via background-clip.
const LETS_TALK_BASE: React.CSSProperties = {
  fontFamily: "var(--font-anton), Impact, Anton, sans-serif",
  // Capped by viewport HEIGHT as well as width so the word can't push the
  // bottom bar (logo + copyright) out of the fixed 100svh footer.
  fontSize: "clamp(1.75rem, min(12vw, 17vh), 12rem)",
  letterSpacing: "0.08em",
  lineHeight: 1.6,
  transform: "scaleY(1.55)",
  transformOrigin: "center center",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
};
// Resting fill — near-white with a faint metallic shade at the foot.
const LETS_TALK_WHITE: React.CSSProperties = {
  ...LETS_TALK_BASE,
  background:
    "linear-gradient(#ffffff 0%, #ffffff 38%, rgba(255,255,255,0.8) 78%, rgba(196,188,191,0.8) 100%) text",
};
// Hover wipe fill — brand maroon → red core (#C4010D) → deep maroon.
const LETS_TALK_RED: React.CSSProperties = {
  ...LETS_TALK_BASE,
  background:
    "linear-gradient(90deg, #800020 0%, #C4010D 50%, #dc143c 78%, #800020 100%) text",
};

export default function ContactFooter() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fadeUp = (delay: number): React.CSSProperties => ({
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(24px)",
    transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
  });

  return (
    <footer id="contact-footer" ref={containerRef} className="relative w-full h-[100svh] overflow-hidden">
      {/* Footer's own Unicorn Studio scene, faded IN from the top. The top
          ~30% is masked transparent, so there the page-wide UnicornBackground
          shows through and cross-fades into the footer's distinct scene — the
          two backgrounds mix at the seam instead of meeting abruptly, while the
          footer still keeps its own look lower down. */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, #000 30%, #000 100%)",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, #000 30%, #000 100%)",
        }}
      >
        <UnicornScene
          projectId="koIJ3lJZK1zDcpHfWek7"
          width="100%"
          height="100%"
          scale={1}
          dpi={1.5}
          sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.1.12/dist/unicornStudio.umd.js"
        />
      </div>

      {/* Content panel — transparent at the top (lets the cross-fade show),
          darkening toward the bottom for text contrast over the scene. */}
      <div className="bg-linear-to-b from-transparent via-background/35 to-background/70 flex flex-col justify-between items-center w-full h-full relative z-10 overflow-hidden">

        <div className="mx-auto px-4 sm:px-6 md:px-12 py-6 sm:py-8 w-full h-full flex flex-col justify-between">
          {/* Tagline */}
          <div
            style={fadeUp(0)}
            className="flex flex-col items-center pb-4 sm:pb-6"
          >
            <div className="w-12 h-px bg-title-red/40 mb-6" />
            <p className="text-foreground text-base sm:text-lg md:text-xl max-w-4xl leading-relaxed tracking-wide text-center font-light italic">
              &ldquo;Zuhayr Creative partners with businesses that value
              structured strategy, disciplined execution, and measurable
              results.&rdquo;
            </p>
            <div className="w-12 h-px bg-title-red/40 mt-6" />
          </div>

          {/* Contact Items Row */}
          <div
            style={{
              borderTop: "0.5px solid rgba(220, 20, 60, 0.15)",
              borderBottom: "0.5px solid rgba(220, 20, 60, 0.15)",
            }}
            className="flex items-start justify-between py-4 sm:py-6"
          >
            {CONTACT_ITEMS.map((item, idx) => {
              const isOffice = item.label === "Office";
              const hasIcon = isOffice;
              return (
                <div
                  key={idx}
                  style={fadeUp(50 + idx * 80)}
                  className={
                    hasIcon
                      ? "flex items-center gap-3"
                      : "flex flex-col gap-1"
                  }
                >
                  {isOffice && (
                    <span className="inline-flex items-center" aria-hidden>
                      {/* Animated Hong Kong flag (gif) — rendered with a plain
                          <img> so Next's image optimizer doesn't freeze it. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/Hong-Kong_120-animated-flag-gifs.gif"
                        alt="Hong Kong"
                        className="h-8 w-auto drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]"
                      />
                    </span>
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs sm:text-sm font-medium tracking-wider uppercase text-title-red">
                      {item.label}
                    </span>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="text-sm sm:text-base font-normal text-foreground hover:text-title-red transition-colors break-all sm:break-normal"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <span className="text-sm sm:text-base font-normal text-foreground-muted">
                        {item.value}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* LET'S-TALK CTA — breakout to full viewport width. Carries the
              "accepting new projects" motion at display scale: a pulsing
              brand-red status dot, and a brand-red gradient that wipes across
              the word left→right on hover. */}
          <div
            style={fadeUp(200)}
            className="relative left-1/2 right-1/2 -translate-x-1/2 w-screen py-2 sm:py-4 flex justify-center"
          >
            <a
              href="/contact"
              aria-label="Let's talk — we're accepting new projects"
              className="group relative inline-flex items-center justify-center transition-transform duration-500 hover:scale-[1.01]"
            >
              {/* Display word — white at rest, brand-red wipe revealed on hover.
                  The fill floor stays low so the word shrinks to fit narrow
                  phones instead of overflowing (the footer clips overflow). */}
              <span className="relative inline-block">
                <span
                  className="relative inline-block font-black uppercase whitespace-nowrap"
                  style={LETS_TALK_WHITE}
                >
                  LET&apos;S-TALK
                </span>
                <span
                  aria-hidden
                  className="absolute inset-0 inline-block font-black uppercase whitespace-nowrap [clip-path:inset(0_100%_0_0)] transition-[clip-path] duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:[clip-path:inset(0_0_0_0)]"
                  style={LETS_TALK_RED}
                >
                  LET&apos;S-TALK
                </span>
              </span>

              {/* "Accepting new projects" badge — fades up beneath the word on
                  hover, mirroring the contact-page CTA. */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 translate-y-1.5 mt-2 inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/10 bg-[#0e0e0e]/90 px-3.5 py-2 text-[0.8rem] font-medium normal-case tracking-normal text-white/90 opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100"
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#C4010D] opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C4010D]" />
                </span>
                Accepting new projects
              </span>
            </a>
          </div>

          {/* Bottom Bar — logo on top, text stacked below, divider, copyright */}
          <div
            style={fadeUp(300)}
            className="flex flex-col items-center justify-center gap-3 sm:gap-4 pt-3 sm:pt-4 text-center"
          >
            {/* Logo (centered, large) — grows slightly on hover */}
            <span className="footer-logo transition-transform duration-300 ease-out hover:scale-110">
              <span className="footer-logo__inner">
                <Image
                  src="/zuhayr-holdings-white.png"
                  alt="Zuhayr Holdings"
                  width={120}
                  height={120}
                  className="footer-logo__img"
                />
              </span>
            </span>

            {/* Concern + trading text — stacked centered under logo */}
            <div className="flex flex-col items-center gap-2 leading-tight">
              <a
                href="https://zuhayrholdings.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1.5 text-sm sm:text-base text-foreground-muted hover:text-title-red transition-colors"
              >
                A concern of Zuhayr Holdings
                <span
                  aria-hidden
                  className="inline-block transition-transform duration-300 ease-out group-hover:translate-x-1.5"
                >
                  &rarr;
                </span>
              </a>
              <span className="text-xs sm:text-sm text-foreground-subtle">
                A trading name of Zuhayr Media LTD.
              </span>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-title-red/15 my-1 sm:my-2" />

            {/* Copyright */}
            <span className="text-xs sm:text-sm text-foreground-subtle tracking-[0.18em] uppercase">
              &copy; Zuhayr Creative. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── 3D Map Pin SVG ───────────────────────────────────────────────── */
function MapPin3D() {
  const uid = "mp";
  return (
    <svg viewBox="0 0 48 60" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Body shading — bright top-left → deep maroon bottom-right */}
        <linearGradient
          id={`${uid}-body`}
          x1="0.2"
          y1="0.05"
          x2="0.85"
          y2="0.95"
        >
          <stop offset="0" stopColor="#ff5a7a" />
          <stop offset="0.45" stopColor="#dc143c" />
          <stop offset="1" stopColor="#3a0010" />
        </linearGradient>
        {/* Specular highlight on the upper-left curve */}
        <radialGradient
          id={`${uid}-hl`}
          cx="0.35"
          cy="0.22"
          r="0.32"
        >
          <stop offset="0" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* Rim shadow — darkens the silhouette edges */}
        <radialGradient
          id={`${uid}-rim`}
          cx="0.5"
          cy="0.45"
          r="0.55"
        >
          <stop offset="0.55" stopColor="rgba(0,0,0,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>
        {/* Inner socket gradient */}
        <radialGradient
          id={`${uid}-socket`}
          cx="0.5"
          cy="0.42"
          r="0.55"
        >
          <stop offset="0" stopColor="#1a0008" />
          <stop offset="0.6" stopColor="#36000f" />
          <stop offset="1" stopColor="#6a001b" />
        </radialGradient>
        {/* Bead inside socket */}
        <radialGradient
          id={`${uid}-bead`}
          cx="0.4"
          cy="0.35"
          r="0.6"
        >
          <stop offset="0" stopColor="#ffd1d8" />
          <stop offset="0.5" stopColor="#ff5a7a" />
          <stop offset="1" stopColor="#8a0020" />
        </radialGradient>
      </defs>

      {/* Pin body */}
      <path
        d="M24 2 C13 2 5 9.5 5 19.5 C5 31 17.5 47 24 58 C30.5 47 43 31 43 19.5 C43 9.5 35 2 24 2 Z"
        fill={`url(#${uid}-body)`}
      />
      {/* Rim shadow overlaid on body */}
      <path
        d="M24 2 C13 2 5 9.5 5 19.5 C5 31 17.5 47 24 58 C30.5 47 43 31 43 19.5 C43 9.5 35 2 24 2 Z"
        fill={`url(#${uid}-rim)`}
      />
      {/* Highlight gloss on upper-left */}
      <path
        d="M24 2 C13 2 5 9.5 5 19.5 C5 25 8 31 12 36 C9 28 10 18 16 11 C19.5 6.5 23.5 4.5 28 4 C26.7 2.8 25.4 2 24 2 Z"
        fill={`url(#${uid}-hl)`}
        opacity="0.7"
      />
      {/* Inner socket — gives depth to the hole */}
      <ellipse
        cx="24"
        cy="20"
        rx="9"
        ry="9.5"
        fill={`url(#${uid}-socket)`}
      />
      {/* Bead inside socket */}
      <circle cx="24" cy="19.5" r="6" fill={`url(#${uid}-bead)`} />
      {/* Tiny sparkle highlight on bead */}
      <ellipse
        cx="21.5"
        cy="17"
        rx="2.2"
        ry="1.3"
        fill="rgba(255,255,255,0.85)"
      />
    </svg>
  );
}

