"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const CONTACT_ITEMS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    label: "Call Us",
    value: "+62 523 736 1221",
    href: "tel:+625237361221",
    copyText: "+625237361221",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    label: "Email Us",
    value: "hello.nomore@gmail.com",
    href: "mailto:hello.nomore@gmail.com",
    copyText: "hello.nomore@gmail.com",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    label: "Support",
    value: "support-nomore@gmail.com",
    href: "mailto:support-nomore@gmail.com",
    copyText: "support-nomore@gmail.com",
  },
];

const SOCIAL_LINKS = [
  {
    icon: "X",
    href: "https://x.com",
    ariaLabel: "Follow us on X (Twitter)",
    svg: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    icon: "IG",
    href: "https://instagram.com",
    ariaLabel: "Follow us on Instagram",
    svg: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  },
  {
    icon: "LI",
    href: "https://linkedin.com",
    ariaLabel: "Connect with us on LinkedIn",
    svg: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  {
    icon: "YT",
    href: "https://youtube.com",
    ariaLabel: "Subscribe to our YouTube channel",
    svg: "M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z",
  },
];

export default function ContactFooter() {
  const containerRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
        gsap.set([topBarRef.current, headingRef.current, ctaRef.current, bottomBarRef.current], {
          opacity: 1,
          y: 0,
          scale: 1,
        });
        return;
      }

      gsap.set(topBarRef.current, { opacity: 0, y: 30 });
      gsap.set(headingRef.current, { opacity: 0, y: 50 });
      gsap.set(ctaRef.current, { opacity: 0, scale: 0.95 });
      gsap.set(bottomBarRef.current, { opacity: 0, y: 20 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 70%",
          end: "top 20%",
          scrub: 0.8,
        },
      });

      tl.to(topBarRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power2.out",
      })
        .to(
          headingRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power2.out",
          },
          "-=0.3",
        )
        .to(
          ctaRef.current,
          {
            opacity: 1,
            scale: 1,
            duration: 0.6,
            ease: "back.out(1.2)",
          },
          "-=0.4",
        )
        .to(
          bottomBarRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: "power2.out",
          },
          "-=0.3",
        );
    },
    { scope: containerRef },
  );

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <footer
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{
        background: "var(--background)",
      }}
      role="contentinfo"
      aria-label="Contact information and footer"
    >
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 50%, rgba(220, 20, 60, 0.08) 0%, transparent 50%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-28 relative z-10">
        <div
          ref={topBarRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 will-change-transform"
        >
          {CONTACT_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="group relative p-6 rounded-2xl border border-transparent hover:border-title-red/20 transition-all duration-300 hover:bg-title-red/5"
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-title-red/10 flex items-center justify-center text-title-red group-hover:bg-title-red group-hover:text-white transition-all duration-300">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold tracking-wide uppercase text-title-red mb-2">
                    {item.label}
                  </p>
                  <a
                    href={item.href}
                    className="text-base font-medium text-foreground hover:text-title-red transition-colors duration-200 break-all focus:outline-none focus:ring-2 focus:ring-title-red focus:ring-offset-2 focus:ring-offset-background rounded"
                  >
                    {item.value}
                  </a>
                </div>
              </div>

              <button
                onClick={() => handleCopy(item.copyText, idx)}
                className="absolute top-4 right-4 p-2 rounded-lg text-foreground-muted hover:text-title-red hover:bg-title-red/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-title-red focus:ring-offset-2 focus:ring-offset-background"
                aria-label={`Copy ${item.label}`}
                title={copiedIndex === idx ? "Copied!" : "Copy to clipboard"}
              >
                {copiedIndex === idx ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mb-16">
          <div ref={headingRef} className="mb-8 will-change-transform">
            <h2
              className="text-[clamp(2.5rem,8vw,5rem)] font-black tracking-tight leading-[1.1] mb-4"
              style={{
                fontFamily: "var(--font-geist-sans)",
                background: "linear-gradient(135deg, var(--title-red) 0%, rgba(220, 20, 60, 0.6) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Let&apos;s Work Together
            </h2>
            <p className="text-lg md:text-xl text-foreground-muted max-w-2xl mx-auto leading-relaxed">
              Have a project in mind? We&apos;d love to hear about it. Get in touch and let&apos;s create something amazing.
            </p>
          </div>

          <a
            ref={ctaRef}
            href="mailto:hello.nomore@gmail.com"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-title-red text-white font-semibold text-lg hover:bg-title-red/90 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-title-red/30 focus:outline-none focus:ring-4 focus:ring-title-red focus:ring-offset-4 focus:ring-offset-background will-change-transform"
            aria-label="Send us an email to start your project"
          >
            <span>Start Your Project</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </a>
        </div>

        <div
          ref={bottomBarRef}
          className="flex flex-col md:flex-row items-center justify-between gap-8 pt-8 will-change-transform"
          style={{
            borderTop: "1px solid rgba(220, 20, 60, 0.15)",
          }}
        >
          <div className="text-sm order-2 md:order-1 text-foreground-muted text-center md:text-left">
            Designed by{" "}
            <a
              href="#"
              className="font-semibold hover:text-title-red transition-colors duration-200 focus:outline-none focus:underline"
            >
              Voxtion
            </a>
            {" · "}
            Powered by{" "}
            <a
              href="#"
              className="font-semibold hover:text-title-red transition-colors duration-200 focus:outline-none focus:underline"
            >
              Webflow
            </a>
          </div>

          <div className="flex items-center gap-3 order-1 md:order-2" role="list" aria-label="Social media links">
            {SOCIAL_LINKS.map((social, idx) => (
              <a
                key={idx}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.ariaLabel}
                className="w-11 h-11 rounded-xl flex items-center justify-center border-2 border-title-red/30 text-title-red hover:bg-title-red hover:text-white hover:border-title-red transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-title-red focus:ring-offset-2 focus:ring-offset-background"
                role="listitem"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  aria-hidden="true"
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
