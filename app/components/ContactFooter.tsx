"use client";

import { useRef, useEffect, useState } from "react";

const CONTACT_ITEMS = [
  {
    label: "Email:",
    value: "inquiry@zuhayrcreative.org",
    href: "mailto:inquiry@zuhayrcreative.org",
  },
  {
    label: "Headquarters",
    value: "Dubai, UAE",
  },
  {
    label: "Offices",
    value: "Hong Kong / Singapore / Vancouver, Canada",
  },
];

const SOCIAL_LINKS = [
  {
    icon: "X",
    href: "https://x.com",
    ariaLabel: "X / Twitter",
    svg: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    icon: "IG",
    href: "https://instagram.com",
    ariaLabel: "Instagram",
    svg: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  },
  {
    icon: "LI",
    href: "https://linkedin.com",
    ariaLabel: "LinkedIn",
    svg: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  {
    icon: "YT",
    href: "https://youtube.com",
    ariaLabel: "YouTube",
    svg: "M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z",
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
      <div className="bg-background/90 rounded-xl flex flex-col justify-between items-center w-full h-auto p-6">
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
                    "linear-gradient(to bottom, var(--title-red) 0%, var(--title-red) 25%, rgb(128 27 47 / 22%) 80%, #00000087 100%)",
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
                <span className="w-6 h-6 rounded-full bg-title-red/20 flex items-center justify-center">
                  <span className="text-[8px] font-black text-title-red tracking-tight">
                    ZH
                  </span>
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

            <div className="flex items-center gap-2 sm:gap-2.5 order-1 md:order-2">
              {SOCIAL_LINKS.map((social, idx) => (
                <a
                  key={idx}
                  href={social.href}
                  aria-label={social.ariaLabel}
                  className="w-9.5 h-9.5 sm:w-8.5 sm:h-8.5 rounded-lg flex items-center justify-center transition-all duration-200 group active:scale-95"
                >
                  <svg
                    className="w-4.5 h-4.5 sm:w-4 sm:h-4 group-hover:fill-white transition-colors"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="var(--title-red)"
                  >
                    <path d={social.svg} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
