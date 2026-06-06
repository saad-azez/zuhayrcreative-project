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
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fadeUp = (delay: number): React.CSSProperties => ({
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(28px)",
    transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
  });

  return (
    <footer id="contact-footer" ref={containerRef} className="relative w-full overflow-hidden">
      {/* UnicornScene ambient background */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
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

      <div className="bg-background/50 flex flex-col justify-between items-center w-full h-auto relative z-10 overflow-hidden">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-12 sm:py-16 md:py-24 w-full">
          {/* Tagline */}
          <div
            style={fadeUp(0)}
            className="flex flex-col items-center pb-8 sm:pb-10"
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
              ...fadeUp(100),
            }}
            className="flex items-start justify-between py-6 sm:py-8"
          >
            {CONTACT_ITEMS.map((item, idx) => {
              const isOffice = item.label === "Office";
              return (
                <div
                  key={idx}
                  className={
                    isOffice
                      ? "flex items-center gap-3"
                      : "flex flex-col gap-1"
                  }
                >
                  {isOffice && (
                    <span className="footer-map" aria-hidden>
                      <span className="footer-map__inner">
                        <MapPin3D />
                      </span>
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

          {/* LET'S-TALK CTA */}
          <div
            style={fadeUp(200)}
            className="py-8 sm:py-12 md:py-16 overflow-hidden flex justify-center"
          >
            <a
              href="mailto:inquiry@zuhayrcreative.org"
              className="group w-full flex items-center justify-center gap-4 transition-transform duration-500 hover:scale-[1.02]"
            >
              <span
                className="relative inline-block text-[clamp(2.25rem,14vw,11rem)] font-black tracking-tight leading-[0.9] whitespace-nowrap"
                style={{
                  fontFamily: "var(--font-geist-sans)",
                  background:
                    "linear-gradient(rgb(255, 255, 255) 0%, rgb(255 255 255 / 56%) 25%, rgb(195 185 187 / 0%) 80%, rgb(0 0 0 / 25%) 100%) text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                LET&apos;S-TALK
              </span>
            </a>
          </div>

          {/* Bottom Bar */}
          <div
            style={{
              borderTop: "0.5px solid rgba(220, 20, 60, 0.15)",
              ...fadeUp(300),
            }}
            className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 pt-6 sm:pt-8"
          >
            <div className="flex items-center gap-3 order-3 md:order-1 text-center md:text-left">
              <span className="footer-logo">
                <span className="footer-logo__inner">
                  <Image
                    src="/logo.png"
                    alt="Zuhayr Holdings"
                    width={56}
                    height={56}
                    className="footer-logo__img"
                  />
                </span>
              </span>
              <div className="flex flex-col gap-1 leading-tight">
                <a
                  href="#"
                  className="text-xs sm:text-sm text-foreground-muted hover:text-title-red transition-colors"
                >
                  A concern of Zuhayr Holdings &rarr;
                </a>
                <span className="text-[11px] text-foreground-subtle">
                  A trading name of Zuhayr Media LTD.
                </span>
              </div>
            </div>

            <span className="text-[11px] text-foreground-subtle order-1 md:order-2">
              &copy; ZUHAYR CREATIVE. ALL RIGHTS RESERVED.
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
