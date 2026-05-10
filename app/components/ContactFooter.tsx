"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

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
  const topBarRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLAnchorElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current || !headingRef.current) return;

      gsap.set(topBarRef.current, { opacity: 0, y: 50 });
      gsap.set(headingRef.current, { opacity: 0, scale: 0.9, y: 100 });
      gsap.set(bottomBarRef.current, { opacity: 0, y: 50 });

      if (iconRef.current) {
        gsap.set(iconRef.current.querySelectorAll("path"), { drawSVG: "0%" });
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%",
          end: "top 30%",
          scrub: 1.5,
        },
      });

      tl.to(topBarRef.current, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power3.out",
      });

      tl.to(
        headingRef.current,
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 1.5,
          ease: "power4.out",
        },
        "-=0.5",
      );

      tl.to(
        bottomBarRef.current,
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
        },
        "-=0.7",
      );

      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top 20%",
        once: true,
        onEnter: () => {
          if (!iconRef.current) return;
          const paths = iconRef.current.querySelectorAll("path");
          gsap.timeline({ delay: 0.3 }).to(paths, {
            drawSVG: "100%",
            duration: 1.3,
            stagger: 0.25,
            ease: "power2.inOut",
          });
        },
      });
    },
    { scope: containerRef },
  );

  return (
    <footer ref={containerRef} className="relative w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-12 sm:py-16 md:py-24">
        <div
          ref={topBarRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 pb-6 sm:pb-8 will-change-transform"
          style={{
            borderBottom: "0.5px solid rgba(220, 20, 60, 0.15)",
          }}
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

        <div className="py-8 sm:py-12 md:py-16 overflow-hidden">
          <a
            href="#contact"
            ref={headingRef}
            className="group flex items-center sm:items-start gap-3 sm:gap-4 md:gap-8 w-fit transition-transform duration-500 hover:scale-105"
          >
            <span
              className="relative inline-block text-[clamp(1.75rem,8vw,4rem)] sm:text-[clamp(3rem,8vw,7rem)] font-black tracking-tight leading-[0.95] whitespace-nowrap will-change-transform"
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
            <span className="shrink-0 w-10 h-10 sm:w-16 sm:h-16 md:w-24 md:h-24 rounded-full border-2 border-title-red flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-title-red/10 mt-1 sm:mt-0 md:mt-4">
              <svg
                ref={iconRef}
                className="w-5 h-5 sm:w-9 sm:h-9 md:w-14 md:h-14 will-change-transform"
                viewBox="0 0 90 119"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              >
                <path
                  d="M67.7698 47.4701V116.34L57.7698 110.57V61.2201L29.1498 77.5301L9.75977 88.5901L2.75977 76.5101L50.7698 49.1401L7.75977 24.3201V12.8401L61.9898 44.1401L67.7698 47.4701Z"
                  stroke="var(--title-red)"
                  strokeLinejoin="round"
                />
                <path
                  d="M87.7698 37.4701L67.7698 47.4701L61.9898 44.1401L7.75977 12.8401L27.7598 2.84009L87.7698 37.4701Z"
                  stroke="var(--title-red)"
                  strokeLinejoin="round"
                />
                <path
                  d="M87.7695 37.47V106.34L67.7695 116.34V47.47L87.7695 37.47Z"
                  stroke="var(--title-red)"
                  strokeLinejoin="round"
                />
                <path
                  d="M57.7698 61.22V62.61L29.7598 78.59L9.75977 88.59L29.1498 77.53L57.7698 61.22Z"
                  stroke="var(--title-red)"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </a>
        </div>

        <div
          ref={bottomBarRef}
          className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 pt-6 sm:pt-8 will-change-transform"
          style={{
            borderTop: "0.5px solid rgba(220, 20, 60, 0.15)",
          }}
        >
          <div className="text-xs sm:text-sm order-2 md:order-1 text-foreground-muted text-center md:text-left">
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
                className="w-[38px] h-[38px] sm:w-[34px] sm:h-[34px] rounded-lg flex items-center justify-center border border-title-red transition-all duration-200 hover:bg-title-red group active:scale-95"
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
        </div>
      </div>
    </footer>
  );
}
