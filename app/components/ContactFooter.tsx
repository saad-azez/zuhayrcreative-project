"use client";

import { useRef, useEffect, useState } from "react";

const CONTACT_ITEMS = [
  {
    label: "Call Today:",
    value: "+62 523 736 1221",
    href: "tel:+6252373612 21",
  },
  {
    label: "Email:",
    value: "hello.nomore@gmail.com",
    href: "mailto:hello.nomore@gmail.com",
  },
  {
    label: "Admin:",
    value: "support-nomore@gmail.com",
    href: "mailto:support-nomore@gmail.com",
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
    <footer ref={containerRef} className="relative w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-12 sm:py-16 md:py-24">
        <div
          style={{
            borderBottom: "0.5px solid rgba(220, 20, 60, 0.15)",
            ...fadeUp(0),
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 pb-6 sm:pb-8"
        >
          {CONTACT_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className={`flex flex-col gap-1 ${
                idx === 1 ? "md:items-center" : idx === 2 ? "md:items-end" : ""
              }`}
            >
              <span className="text-xs sm:text-sm font-medium tracking-wider uppercase text-title-red">
                {item.label}
              </span>
              <a
                href={item.href}
                className="text-sm sm:text-base font-normal text-foreground hover:text-title-red transition-colors break-all sm:break-normal"
              >
                {item.value}
              </a>
            </div>
          ))}
        </div>

        <div style={fadeUp(140)} className="py-8 sm:py-12 md:py-16 overflow-hidden flex justify-center">
          <a
            href="#contact"
            className="group w-full flex items-center justify-center gap-4 transition-transform duration-500 hover:scale-[1.02]"
          >
            <span
              className="relative inline-block text-[clamp(3.5rem,13vw,11rem)] font-black tracking-tight leading-[0.9] whitespace-nowrap"
              style={{
                fontFamily: "var(--font-geist-sans)",
                background:
                  "linear-gradient(to bottom, var(--title-red) 0%, var(--title-red) 25%, rgb(128 27 47 / 22%) 60%, #00000087 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              LET&apos;S-TALK
            </span>
            <svg
              width="clamp(2rem, 5vw, 4.5rem)"
              height="clamp(2.6rem, 6.5vw, 5.85rem)"
              viewBox="0 0 90 117"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              strokeWidth="0.5px"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 self-center"
            >
              <path d="M67.8997 51.8301V111.15C67.8997 112.83 67.3997 113.95 66.4097 114.52C65.4197 115.08 64.1896 114.94 62.7296 114.09C61.2596 113.25 60.0397 111.97 59.0397 110.26C58.0497 108.55 57.5596 106.86 57.5596 105.18V60.1001L28.9897 76.3801L11.5497 86.3301C10.5997 86.8701 9.39966 86.7201 7.92966 85.8701C6.46966 85.0201 5.25963 83.7801 4.30963 82.1501C3.36963 80.5101 2.88965 78.8601 2.88965 77.1801C2.88965 75.5001 3.36963 74.3801 4.30963 73.8401L50.3196 47.6101L11.0296 24.9301C9.56963 24.0901 8.33964 22.8101 7.34964 21.1001C6.35964 19.3901 5.85965 17.6901 5.85965 16.0101C5.85965 14.3301 6.35964 13.2101 7.34964 12.6501L7.65964 12.5001C8.58964 12.1201 9.71963 12.3101 11.0296 13.0701L61.8796 42.4201L62.7296 42.9101C64.1896 43.7601 65.4197 45.0401 66.4097 46.7401C67.3997 48.4501 67.8997 50.1501 67.8997 51.8301Z" stroke="#FF4E4C" strokeLinejoin="round"/>
              <path d="M57.5598 60.1001V61.5001L31.5498 76.3301L31.2598 76.4701L11.5498 86.3301L28.9898 76.3801L57.5598 60.1001Z" stroke="#FF4E4C" strokeLinejoin="round"/>
              <path d="M87.8997 41.8301V101.15C87.8997 102.83 87.3997 103.95 86.4097 104.52L86.1096 104.67L66.4097 114.52C67.3997 113.95 67.8997 112.83 67.8997 111.15V51.8301C67.8997 50.1501 67.3997 48.4501 66.4097 46.7401C65.4197 45.0401 64.1896 43.7601 62.7296 42.9101L61.8797 42.4201L11.0297 13.0701C9.71966 12.3101 8.58967 12.1201 7.65967 12.5001L27.3497 2.65009C28.3397 2.08009 29.5697 2.22009 31.0297 3.07009L82.7296 32.9101C84.1896 33.7601 85.4197 35.0401 86.4097 36.7401C87.3997 38.4501 87.8997 40.1501 87.8997 41.8301Z" stroke="#FF4E4C" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>

        <div
          style={{
            borderTop: "0.5px solid rgba(220, 20, 60, 0.15)",
            ...fadeUp(280),
          }}
          className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 pt-6 sm:pt-8"
        >
          <div className="text-xs sm:text-sm order-3 md:order-1 text-foreground-muted text-center md:text-left">
            Designed by{" "}
            <a href="#" className="font-medium hover:underline text-title-red">
              Voxtion
            </a>{" "}
            · Powered by{" "}
            <a href="#" className="font-medium hover:underline text-title-red">
              Webflow
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 order-1 md:order-2">
            {SOCIAL_LINKS.map((social, idx) => (
              <a
                key={idx}
                href={social.href}
                aria-label={social.ariaLabel}
                className="w-[38px] h-[38px] sm:w-[34px] sm:h-[34px] rounded-lg flex items-center justify-center  transition-all duration-200  group active:scale-95"
              >
                <svg
                  className="w-[18px] h-[18px] sm:w-4 sm:h-4 group-hover:fill-white transition-colors"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="var(--title-red)"
                >
                  <path d={social.svg} />
                </svg>
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4 order-2 md:order-3 text-xs text-foreground-muted">
            <a href="#" className="hover:text-title-red transition-colors">Style guide</a>
            <a href="#" className="hover:text-title-red transition-colors">Licenses</a>
            <a href="#" className="hover:text-title-red transition-colors">Changelog</a>
            <a href="#" className="hover:text-title-red transition-colors">404</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
