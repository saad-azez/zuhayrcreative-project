"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import UnicornScene from "unicornstudio-react";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";
import MetallicPaint from "./MetallicPaint";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";

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
  const { isTouch } = useDeviceDetect();
  const dpi = isTouch ? 1 : 1.5;

  // The page runs several live WebGL canvases; when the browser hits its
  // per-page context limit it silently evicts the oldest one, leaving that
  // canvas permanently black — which is why this scene sometimes failed to
  // show until a refresh. Watch for the eviction (webglcontextlost fires on
  // the scene's canvas; caught here in the capture phase) and remount the
  // scene with a fresh key so it re-initialises.
  const sceneWrapRef = useRef<HTMLDivElement>(null);
  const [sceneKey, setSceneKey] = useState(0);
  useEffect(() => {
    const el = sceneWrapRef.current;
    if (!el) return;
    let timer: number | undefined;
    const onLost = () => {
      timer = window.setTimeout(() => setSceneKey((k) => k + 1), 400);
    };
    el.addEventListener("webglcontextlost", onLost, true);
    return () => {
      el.removeEventListener("webglcontextlost", onLost, true);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

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
        ref={sceneWrapRef}
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
          key={sceneKey}
          projectId="koIJ3lJZK1zDcpHfWek7"
          width="100%"
          height="100%"
          scale={1}
          dpi={dpi}
          lazyLoad={false}
          sdkUrl={UNICORN_SDK_URL}
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
                        className="h-10 w-auto drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]"
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
              {/* Display word rendered with the liquid-metal shader. Colours are
                  tuned to the navbar flame ramp (maroon #38000E → #800020 → red
                  core #C4010D): a maroon darkColor (visible because brightness <
                  2) plus a red tint push the metal toward the flame red. The
                  container keeps the SVG's 10:3 aspect so the wordmark isn't
                  distorted. A hidden text layer keeps it accessible/selectable. */}
              <span className="relative block w-[min(92vw,760px)] aspect-[10/3]">
                <span className="sr-only">Let&apos;s Talk</span>
                <MetallicPaint
                  imageSrc="/lets-talk.svg"
                  seed={42}
                  scale={4}
                  patternSharpness={1}
                  noiseScale={0.5}
                  speed={0.3}
                  liquid={0.75}
                  mouseAnimation={false}
                  brightness={1.8}
                  contrast={0.55}
                  refraction={0.01}
                  blur={0.015}
                  chromaticSpread={2}
                  fresnel={1}
                  angle={0}
                  waveAmplitude={1}
                  distortion={1}
                  contour={0.2}
                  lightColor="#ffffff"
                  darkColor="#38000e"
                  tintColor="#c4010d"
                />
              </span>

              {/* "Accepting new projects" badge — revealed on hover of the CTA,
                  bouncing in on a liquid-glass pill with a pinging outer ring +
                  pulsing brand-red dot. Outer span handles centering so the
                  bounce transform can't fight the -translate-x. */}
              <span className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 mt-4">
                <span
                  aria-hidden
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/[0.14] bg-white/[0.07] px-3.5 py-2 text-[0.8rem] font-medium normal-case tracking-normal text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md opacity-0 translate-y-2 transition-[opacity,transform] duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-hover:animate-bounce"
                >
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#ff2a45] opacity-90 animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff2a45] shadow-[0_0_10px_2px_rgba(255,42,69,0.9)] animate-pulse" />
                  </span>
                  Accepting new projects
                </span>
              </span>
            </a>
          </div>

          {/* Bottom Bar — logo on top, text stacked below, divider, copyright */}
          <div
            style={fadeUp(300)}
            className="flex flex-col items-center justify-center gap-3 sm:gap-4 pt-6 sm:pt-8 text-center"
          >
            {/* Outer group: hovering logo OR text scales the logo AND colours
                the text link — both activate together as one unit. */}
            <div className="group flex flex-col items-center gap-0.5 sm:gap-1 cursor-pointer">
              {/* Logo — nudged down and sits close to the text below it */}
              <span className="footer-logo mt-3 sm:mt-4 transition-transform duration-300 ease-out group-hover:scale-110">
                <span className="footer-logo__inner">
                  <Image
                    src="/zuhayr-holdings-white.png"
                    alt="Zuhayr Holdings"
                    width={148}
                    height={148}
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
                  className="inline-flex items-center gap-1.5 text-sm sm:text-base text-foreground-muted group-hover:text-title-red transition-colors"
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

