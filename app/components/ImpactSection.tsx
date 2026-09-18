"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AuroraBackground } from "./AuroraBackground";
import RepeatText from "./RepeatText";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";

gsap.registerPlugin(ScrollTrigger);

interface StatItem {
  target: number;
  suffix: string;
  label: string;
}

const stats: StatItem[] = [
  {
    target: 250,
    suffix: "+",
    label: "Projects Completed",
  },
  {
    target: 24,
    suffix: "/7",
    label: "Customer Service",
  },
  {
    target: 4,
    suffix: "",
    label: "Continents Operational In",
  },
];

/**
 * Writes the running count into a stat number. The number is a RepeatText, so
 * it holds N stacked copies of itself — setting textContent on the container
 * would blow them away. Every copy has to show the same value.
 */
function setStatValue(el: HTMLElement, value: string) {
  const copies = el.querySelectorAll<HTMLElement>(":scope > span");
  if (!copies.length) {
    el.textContent = value;
    return;
  }
  copies.forEach((copy) => {
    copy.textContent = value;
  });
}

export default function ImpactSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const statsWrapRef = useRef<HTMLDivElement>(null);
  const stat1Ref = useRef<HTMLDivElement>(null);
  const stat2Ref = useRef<HTMLDivElement>(null);
  const stat3Ref = useRef<HTMLDivElement>(null);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();

  useGSAP(() => {
    if (!sectionRef.current) return;

    const dur = prefersReducedMotion ? 0.01 : isTouch ? 0.5 : 1.0;

    const statEls = [stat1Ref, stat2Ref, stat3Ref];

    // ── Set initial hidden states immediately — prevents flash before trigger ─
    const heading1 =
      sectionRef.current.querySelector<HTMLElement>(".heading-1");
    const heading2 =
      sectionRef.current.querySelector<HTMLElement>(".heading-2");
    const desc1 = sectionRef.current.querySelector<HTMLElement>(".desc-1");
    if (heading1) gsap.set(heading1, { autoAlpha: 0, x: -120, skewX: -6 });
    if (heading2) gsap.set(heading2, { autoAlpha: 0, x: 120, skewX: 6 });
    if (desc1) gsap.set(desc1, { autoAlpha: 0, y: 24 });
    // .desc-2 is the same DOM node as .heading-2 — skip duplicate set

    statEls.forEach((ref) => {
      if (!ref.current) return;
      gsap.set(ref.current, {
        autoAlpha: 0,
        x: -80,
        y: 80,
        skewX: -8,
        force3D: true,
      });
      const suffixEl = ref.current.querySelector<HTMLElement>(".stat-suffix");
      const labelEl = ref.current.querySelector<HTMLElement>(".stat-label");
      if (suffixEl) gsap.set(suffixEl, { autoAlpha: 0, scale: 0.4, y: 20 });
      if (labelEl) gsap.set(labelEl, { autoAlpha: 0, y: 16 });
    });

    // ── Heading animations ───────────────────────────────────────────────────
    if (heading1) {
      gsap.to(heading1, {
        autoAlpha: 1,
        x: 0,
        skewX: 0,
        duration: dur * 1.3,
        ease: "expo.out",
        scrollTrigger: {
          trigger: heading1,
          start: "top 88%",
          once: true,
        },
      });
    }

    if (heading2) {
      gsap.to(heading2, {
        autoAlpha: 1,
        x: 0,
        skewX: 0,
        duration: dur * 1.3,
        ease: "expo.out",
        scrollTrigger: {
          trigger: heading2,
          start: "top 88%",
          once: true,
        },
      });
    }

    if (desc1) {
      gsap.to(desc1, {
        autoAlpha: 1,
        y: 0,
        duration: dur * 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: desc1,
          start: "top 92%",
          once: true,
        },
      });
    }

    // ── Stats: single master timeline, staggered via absolute positions ───────
    const masterTl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top 60%",
        once: true,
        invalidateOnRefresh: true,
      },
    });

    statEls.forEach((ref, index) => {
      if (!ref.current) return;

      const numberEl = ref.current.querySelector<HTMLElement>(".stat-number");
      const labelEl = ref.current.querySelector<HTMLElement>(".stat-label");
      const suffixEl = ref.current.querySelector<HTMLElement>(".stat-suffix");
      const stat = stats[index];
      const o = prefersReducedMotion ? 0 : index * 0.2; // stagger offset in seconds

      // Slide in from diagonal (or simple fade on mobile)
      masterTl.to(
        ref.current,
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          skewX: 0,
          duration: dur * 1.1,
          ease: "expo.out",
          force3D: true,
        },
        o,
      );

      // Counter roll-up — loops forever: count 0 → target, hold a few seconds
      // at the target, then count again. Pauses while the section is off-screen.
      if (numberEl) {
        if (prefersReducedMotion) {
          setStatValue(numberEl, stat.target.toString());
        } else {
          const counter = { value: 0 };
          gsap.to(counter, {
            value: stat.target,
            duration: 2.2,
            ease: "power3.out",
            repeat: -1,
            repeatDelay: 3, // hold at the target before counting again
            onUpdate() {
              setStatValue(numberEl, Math.ceil(counter.value).toString());
            },
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 60%",
              end: "bottom top",
              toggleActions: "play pause resume pause",
            },
          });
        }
      }

      // Label fade up
      if (labelEl) {
        masterTl.to(
          labelEl,
          { autoAlpha: 1, y: 0, duration: dur * 0.7, ease: "power2.out" },
          o + 0.25,
        );
      }

      // Suffix pop
      if (suffixEl) {
        masterTl.to(
          suffixEl,
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: dur * 0.7,
            ease: "back.out(2)",
          },
          o + 0.55,
        );
      }
    });

    // ── Diagonal scroll (fromanother.love "our team" feel) ──
    // The whole stat staircase glides a real distance ALONG its 45° axis as the
    // section travels through the viewport — that's the prominent diagonal
    // "scroll". Driven on a wrapper with equal x/y px so the path is a true 45°
    // (xPercent/yPercent would map to width vs height and skew the angle). Each
    // stat then drifts a touch more on top (xPercent/yPercent, independent of
    // its entrance x/y) so they read as layered depth, not one rigid block.
    // Runs at EVERY width; skipped only for reduced motion. It used to be gated
    // to (min-width: 768px), which meant narrow windows and phones lost the
    // diagonal entirely — the section's whole idea. The original reason for the
    // gate was that travel keyed off viewport HEIGHT alone, so on a tall narrow
    // screen the stats slid far enough sideways to fall out of line with the
    // heading. Clamping the travel against viewport WIDTH too fixes that at the
    // source, so the diagonal can run everywhere.
    //
    // Gated with gsap.matchMedia, NOT the isMobile flag: useGSAP runs once on
    // mount, before useDeviceDetect has replaced its SSR default.
    const mm = gsap.matchMedia();
    mm.add(
      {
        // `narrow` looks redundant next to `wide`, but gsap.matchMedia only
        // runs the callback when at least ONE condition matches. With just
        // `wide` + `reduce`, a narrow screen with motion enabled matched
        // neither, so the whole block silently never ran — which is exactly how
        // the diagonal went missing below 768px.
        wide: "(min-width: 768px)",
        narrow: "(max-width: 767px)",
        reduce: "(prefers-reduced-motion: reduce)",
      },
      (ctx) => {
        const { wide, reduce } = ctx.conditions as {
          wide: boolean;
          narrow: boolean;
          reduce: boolean;
        };
        if (reduce) return;
        if (!statsWrapRef.current) return;
        // Travel scales with viewport height so the glide feels consistent
        // across screens, but is capped against width so a narrow screen never
        // slides the staircase off its own column. Recomputed on refresh.
        const travel = () =>
          Math.min(window.innerHeight * 0.16, window.innerWidth * 0.1);
        // The per-stat parallax is a percentage of each stat's OWN width, and
        // on a narrow screen the stats span the full column — so the same
        // percentage throws them much further sideways than on desktop. Damp it.
        const depthScale = wide ? 1 : 0.45;

        gsap.fromTo(
          statsWrapRef.current,
          { x: () => -travel(), y: () => -travel() },
          {
            x: () => travel(),
            y: () => travel(),
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
              invalidateOnRefresh: true,
            },
          },
        );

        statEls.forEach((ref, i) => {
          if (!ref.current) return;
          const depth = (1 + i * 0.6) * depthScale;
          gsap.fromTo(
            ref.current,
            { xPercent: -4 * depth, yPercent: -4 * depth },
            {
              xPercent: 4 * depth,
              yPercent: 4 * depth,
              ease: "none",
              scrollTrigger: {
                trigger: sectionRef.current,
                start: "top bottom",
                end: "bottom top",
                scrub: 1.4,
              },
            },
          );
        });
      },
    );

    return () => mm.revert();
  }, []);

  return (
    <section
      // overflow-x-CLIP, not hidden: `hidden` on one axis coerces the other
      // from `visible` to `auto`, which makes this section a scroll container.
      // The stat numbers' repetition trail hangs below the last stat and past
      // the right edge, and once it cleared the section's bottom padding that
      // `auto` produced a scrollbar inside the section. `clip` clips the same
      // way without ever creating a scroll container.
      className="relative h-auto py-40 md:py-56 px-6 md:px-12 overflow-x-clip w-full max-w-full"
    >
      {/* ── Ambient glows ─────────────────────────────────────────────────
          Radial gradients, NOT blurred discs. These were `filter: blur(120px)`
          and `blur(100px)` on 800px and 600px circles — the only giant blur
          filters on the site. On an iPhone at 3x that is a 360px Gaussian
          over a 2400px layer, re-run whenever the section's animation touches
          it, and the phone's debug log put a 15–26s freeze on exactly this
          section twice, ending in iOS resetting the GPU (every WebGL context
          on the page lost at once). A blurred disc is a radial falloff, and a
          radial-gradient IS that falloff, drawn for free: the stops below
          trace the blurred disc's profile (solid to radius − 2σ, half at the
          radius, gone at radius + 2σ), the box is scaled up by the blur's
          spread so the reach is the same, and the colours and alphas are
          Tailwind's own `bg-maroon-dark/10` and `bg-maroon-accent/5`. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 -left-1/4 w-200 h-200 rounded-full"
          style={{
            background:
              "radial-gradient(circle closest-side, color-mix(in oklab, var(--color-maroon-dark) 10%, transparent) 0%, color-mix(in oklab, var(--color-maroon-dark) 10%, transparent) 25%, color-mix(in oklab, var(--color-maroon-dark) 5%, transparent) 62%, transparent 100%)",
            transform: "scale(1.6)",
          }}
        />
        <div
          className="absolute bottom-1/4 -right-1/4 w-150 h-150 rounded-full"
          style={{
            background:
              "radial-gradient(circle closest-side, color-mix(in oklab, var(--color-maroon-accent) 5%, transparent) 0%, color-mix(in oklab, var(--color-maroon-accent) 5%, transparent) 20%, color-mix(in oklab, var(--color-maroon-accent) 2.5%, transparent) 60%, transparent 100%)",
            transform: "scale(1.67)",
          }}
        />
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div ref={sectionRef} className="max-w-400 mx-auto relative z-10 w-full">
        {/* ── Header block ─────────────────────────────────────────────────── */}
        <div className="mb-20 md:mb-36">
          <div className="flex flex-col lg:flex-row lg:items-start gap-12">
            <div className="flex-1">
              {/* Repetition effect — the copies unzip as the section scrolls
                  past (see RepeatText.tsx). Kept on the same node that carries
                  .heading-1, so the entrance tween above still finds it. */}
              <RepeatText
                as="h2"
                text="BEYOND INFLUENCE"
                className="heading-1 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 tracking-tighter leading-[1.25]"
                style={{ fontFamily: "var(--font-display)", fontSynthesisWeight: "none" }}
              />
              <p className="desc-1 text-base md:text-lg text-foreground-muted max-w-md leading-relaxed">
                Influence goes beyond aesthetics — it shifts perceptions,
                inspires conversation, and sets new standards. We help brands
                express clarity and ambition.
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats: true 45-degree diagonal staircase ─────────────────────── */}
        <div className="relative">
          {/* ── AND IMPACT — floated right, hidden on mobile ── */}
          <div className="heading-2 desc-2 hidden lg:flex flex-col justify-center absolute right-0 -top-40 w-[42%] h-auto pointer-events-none">
            <RepeatText
              as="h2"
              text="AND IMPACT"
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground tracking-tighter leading-[1.25] mb-4"
              style={{ fontFamily: "var(--font-display)", fontSynthesisWeight: "none" }}
            />
            <p className="text-base md:text-lg text-foreground-muted max-w-xs leading-relaxed">
              Where creativity meets consequence — transforming ideas into
              actionable plans and strategy into sustainable growth.
            </p>
          </div>
          {/* Diagonal-scroll group — the three stats glide together along the
              45° track as the section scrolls. The dashed guide line and the
              AND IMPACT label are left OUT of this wrapper, so they hold still
              and the numbers slide along the track (the fromanother.love feel). */}
          <div ref={statsWrapRef} className="will-change-transform">
          {/* Stat 1 — left anchor */}
          <div
            ref={stat1Ref}
            className="stat-item relative ml-0 mb-12 md:mb-20"
          >
            <div className="flex items-baseline gap-3">
              {/* spacing={false}: this sits in a baseline flex row above its
                  label, and reserving the trail's full drop would shove the
                  label a couple of hundred pixels clear of its own number. The
                  trail overflows instead — shortened and damped so it reads as
                  an echo behind the label rather than a collision with it. */}
              <RepeatText
                as="span"
                text="0"
                copies={6}
                spacing={false}
                className="stat-number text-[clamp(5rem,12vw,11rem)] font-bold text-foreground tracking-tighter leading-none tabular-nums"
              />
              <span className="stat-suffix text-[clamp(3rem,7vw,7rem)] font-bold text-maroon-accent leading-none">
                {stats[0].suffix}
              </span>
            </div>
            <p className="stat-label text-lg md:text-xl text-foreground-muted mt-3 max-w-[28ch] leading-snug">
              {stats[0].label}
            </p>
          </div>

          {/* Stat 2 — shifted right + down (45 deg step). The narrow-width step
              is a viewport fraction rather than the desktop's fixed 360px: with
              every stat at ml-0 the staircase collapsed to a plain vertical
              list, leaving the diagonal glide with no diagonal to move along. */}
          <div
            ref={stat2Ref}
            className="stat-item relative ml-[10vw] md:ml-[360px] mb-12 md:mb-20"
          >
            <div className="flex items-baseline gap-3">
              {/* spacing={false}: this sits in a baseline flex row above its
                  label, and reserving the trail's full drop would shove the
                  label a couple of hundred pixels clear of its own number. The
                  trail overflows instead — shortened and damped so it reads as
                  an echo behind the label rather than a collision with it. */}
              <RepeatText
                as="span"
                text="0"
                copies={6}
                spacing={false}
                className="stat-number text-[clamp(5rem,12vw,11rem)] font-bold text-foreground tracking-tighter leading-none tabular-nums"
              />
              <span className="stat-suffix text-[clamp(3rem,7vw,7rem)] font-bold text-maroon-accent leading-none">
                {stats[1].suffix}
              </span>
            </div>
            <p className="stat-label text-lg md:text-xl text-foreground-muted mt-3 max-w-[28ch] leading-snug">
              {stats[1].label}
            </p>
          </div>

          {/* Stat 3 — another step. */}
          <div
            ref={stat3Ref}
            className="stat-item relative ml-[20vw] md:ml-[720px]"
          >
            <div className="flex items-baseline gap-3">
              {/* spacing={false}: this sits in a baseline flex row above its
                  label, and reserving the trail's full drop would shove the
                  label a couple of hundred pixels clear of its own number. The
                  trail overflows instead — shortened and damped so it reads as
                  an echo behind the label rather than a collision with it. */}
              <RepeatText
                as="span"
                text="0"
                copies={6}
                spacing={false}
                className="stat-number text-[clamp(5rem,12vw,11rem)] font-bold text-foreground tracking-tighter leading-none tabular-nums"
              />
              <span className="stat-suffix text-[clamp(3rem,7vw,7rem)] font-bold text-maroon-accent leading-none">
                {stats[2].suffix}
              </span>
            </div>
            <p className="stat-label text-lg md:text-xl text-foreground-muted mt-3 max-w-[28ch] leading-snug">
              {stats[2].label}
            </p>
          </div>
          </div>

          {/* Ghost diagonal guide line — purely decorative */}
          <div
            className="absolute inset-0 pointer-events-none -z-10"
            aria-hidden
          >
            <svg
              className="absolute top-0 left-0 w-full h-full overflow-visible opacity-[0.06]"
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="0"
                x2="100%"
                y2="100%"
                stroke="currentColor"
                strokeWidth="1"
                className="text-maroon-accent"
                strokeDasharray="6 10"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
