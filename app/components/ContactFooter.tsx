"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import GradientBlinds from "./GradientBlinds";

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
    <footer ref={containerRef} className="relative w-full overflow-hidden p-6">
      {/* GradientBlinds background */}

      <div className="bg-background/50 rounded-xl flex flex-col justify-between items-center w-full h-auto p-6 relative z-10 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <GradientBlinds
            gradientColors={["#38000e", "#470015", "#800020"]}
            angle={20}
            noise={0.3}
            blindCount={16}
            blindMinWidth={25}
            spotlightRadius={0.5}
            spotlightSoftness={1}
            spotlightOpacity={1}
            mouseDampening={0.19}
            distortAmount={0}
            shineDirection="left"
            mixBlendMode="lighten"
          />
        </div>
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
            {CONTACT_ITEMS.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1">
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
            ))}
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
                className="relative inline-block text-[clamp(3.5rem,13vw,11rem)] font-black tracking-tight leading-[0.9] whitespace-nowrap"
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
            <div className="flex flex-col gap-1 order-3 md:order-1 text-center md:text-left">
              <span className="inline-flex items-center gap-2">
                <span className="w-7 h-7  flex items-center justify-center p-1">
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
