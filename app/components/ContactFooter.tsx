"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import UnicornScene from "unicornstudio-react";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";
import MetallicPaint from "./MetallicPaint";
import { useUnicornGuard, useUnicornPerf } from "@/app/lib/unicornPerf";

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

  // Shared Unicorn policy: device-tiered dpi/scale/fps, paused while the
  // footer is scrolled offscreen, and context-loss self-healing (the browser
  // evicting a WebGL context is what used to leave this scene permanently
  // black until a refresh).
  const sceneWrapRef = useRef<HTMLDivElement>(null);
  const perf = useUnicornPerf();
  const { sceneKey, paused } = useUnicornGuard(sceneWrapRef, true);

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
    // min-h, not a fixed h: the content is ~1002px tall, so on any viewport
    // shorter than that a fixed 100svh box plus overflow-hidden simply cut the
    // bottom off — at 1440x900 the copyright line sat 102px BELOW the visible
    // area, and at 1280x800 202px below. The box now grows to fit whatever the
    // content needs and only ever clips horizontally (the CTA breaks out to
    // full viewport width). The scene layers are inset-0, so they still cover.
    <footer id="contact-footer" ref={containerRef} className="relative w-full min-h-[100lvh] flex overflow-hidden">
      {/* Footer's own Unicorn Studio scene, faded IN from the top. The top
          ~30% is masked transparent, so there the page-wide UnicornBackground
          shows through and cross-fades into the footer's distinct scene — the
          two backgrounds mix at the seam instead of meeting abruptly, while the
          footer still keeps its own look lower down. */}
      <div
        ref={sceneWrapRef}
        aria-hidden
        // See UnicornBackground — lets ?nobg=1 switch every scene off.
        data-unicorn-scene
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          // Brand-maroon base painted BEHIND the WebGL canvas. If the scene is
          // slow, fails to load, or the browser evicts its context, this shows
          // instead of a black void — the footer stays on-brand red. The scene
          // paints over it once it's up. Masked with the wrapper, so it still
          // cross-fades to the page background at the top seam.
          background:
            "radial-gradient(125% 120% at 50% 38%, #4d101f 0%, #2c0a13 52%, #16070c 100%)",
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
          scale={perf.scale}
          dpi={perf.dpi}
          fps={perf.fps}
          paused={paused}
          lazyLoad
          sdkUrl={UNICORN_SDK_URL}
        />
      </div>

      {/* Fade the footer's bottom to solid BLACK so it hands off to the
          below-footer scene (which rises from a black base) without ever
          exposing the maroon page background at the seam. */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0) 78%, #000 100%)",
        }}
      />

      {/* Content panel — transparent at the top (lets the cross-fade show),
          darkening toward the bottom for text contrast over the scene. */}
      {/* min-h-[100lvh] keeps `justify-between` spreading the blocks across a
          full screen when the content is short, while letting the panel grow
          past it rather than clip when it isn't. `overflow-hidden` is gone from
          here — with a growing box there is nothing to clip vertically, and it
          was the second layer doing the cutting. */}
      <div className="bg-linear-to-b from-transparent via-background/35 to-background/70 flex flex-col justify-between items-center w-full min-h-[100lvh] relative z-10">

        {/* pb clears the safe-area inset on top of its own padding: under
            viewport-fit=cover the page runs to the physical bottom of the
            screen, so the last row would otherwise sit behind Safari's
            floating toolbar. Resolves to the plain padding wherever the inset
            is 0 (desktop, any device without a home indicator). */}
        <div
          className="mx-auto px-4 sm:px-6 md:px-12 py-6 sm:py-8 w-full flex-1 flex flex-col justify-between"
          style={{ paddingBottom: "calc(2rem + var(--safe-bottom))" }}
        >
          {/* Tagline */}
          {/* pt clears the fixed top-left navbar toggle. The tagline is centred
              with a max-w-4xl cap, so below ~1090px viewport its left edge
              reaches back into the toggle's corner and the first word
              disappears behind it (the previous tagline lost its opening
              `"Z` the same way). Past xl the text is inset far enough to clear
              it on its own, so the padding drops away. */}
          <div
            style={fadeUp(0)}
            className="flex flex-col items-center pt-12 xl:pt-0 pb-4 sm:pb-6"
          >
            <div className="w-12 h-px bg-title-red/40 mb-6" />
            {/* Not a pull-quote any more — it addresses the reader directly,
                so the quotation marks are gone and the size steps down a notch
                from base/lg/xl. */}
            <p className="text-foreground text-sm sm:text-base md:text-lg max-w-4xl leading-relaxed tracking-wide text-center font-light italic">
              Crafting digital experiences through design and technology. We
              would love to hear from you, reach out and chat with us if you
              want to collaborate!
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
                        className="group/email relative inline-flex w-fit items-center gap-1.5 text-sm sm:text-base font-normal text-foreground transition-colors duration-300 hover:text-title-red break-all sm:break-normal"
                      >
                        <span className="relative">
                          {item.value}
                          {/* Resting hairline so the address reads as
                              interactive at a glance, with a brand-red rule
                              that wipes across it left→right on hover. */}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -bottom-0.5 left-0 h-px w-full bg-white/20"
                          />
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-title-red transition-transform duration-500 ease-out group-hover/email:scale-x-100"
                          />
                        </span>
                        {/* Arrow slides in on hover — the same idiom as the
                            "A concern of Zuhayr Holdings →" link below. */}
                        <span
                          aria-hidden
                          className="inline-block -translate-x-1 opacity-0 transition-all duration-300 ease-out group-hover/email:translate-x-0 group-hover/email:opacity-100"
                        >
                          &rarr;
                        </span>
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
              {/* Display word rendered with the liquid-metal shader in
                  silver-chrome (client note: the earlier red tint read as fire
                  rather than metal — neutral light/dark with a faint cool-steel
                  tint restores the liquid-metal look). The container keeps the
                  SVG's 10:3 aspect so the wordmark isn't distorted. A hidden
                  text layer keeps it accessible. */}
              {/* Sized against viewport WIDTH only, deliberately.
                  A `78vh` term was added here to keep the footer inside one
                  screen, but it bound on every desktop and on landscape
                  tablets — the two cases where this is the display element —
                  cutting the wordmark to 23vh tall (702px wide at 1440×900,
                  down from 1200px). It also did not achieve what it was for:
                  measured on short viewports (1366×768, 1280×800, 1180×820)
                  the footer content overflows one screen either way, so the
                  cap was paying real display scale for nothing. Vertical fit,
                  if it needs solving, belongs in this column's own spacing. */}
              <span className="relative block w-[min(94vw,1200px)] aspect-[10/3]">
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
                  brightness={2}
                  contrast={0.5}
                  refraction={0.01}
                  blur={0.015}
                  chromaticSpread={2}
                  fresnel={1}
                  angle={0}
                  waveAmplitude={1}
                  distortion={1}
                  contour={0.2}
                  lightColor="#ffffff"
                  darkColor="#000000"
                  tintColor="#dfe6ee"
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
                    width={176}
                    height={176}
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

