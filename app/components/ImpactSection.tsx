"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AuroraBackground } from "./AuroraBackground";
import RepeatText from "./RepeatText";
import RollingNumber, { type RollingNumberHandle } from "./RollingNumber";
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
 * The staircase's intended left offsets, px — the layout the stats were
 * designed at. Applied as-is wherever they fit; `fit()` below narrows them
 * only on windows where a stat would otherwise run past the viewport.
 * Below 768px they are fractions of the viewport, as the CSS classes were.
 */
const STAIR_WIDE = [0, 360, 720];
const STAIR_NARROW = [0, 0.1, 0.2]; // × viewport width
/** Closest a number may come to either side of the viewport, px. */
const EDGE = 8;
/**
 * The numbers' repetition trail (RepeatText) — the same echo "BEYOND
 * INFLUENCE" has: copies peel off down and to the right as the section
 * scrolls. Each copy carries its own reels, rolled in step with the solid one.
 * The tail copy ends TRAIL_COPIES × TRAIL_STEP_X font-sizes right of the
 * number, which `fit` counts as part of the number's width.
 */
const TRAIL_COPIES = 6;
const TRAIL_STEP_X = 0.073;

export default function ImpactSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const statsWrapRef = useRef<HTMLDivElement>(null);
  const stat1Ref = useRef<HTMLDivElement>(null);
  const stat2Ref = useRef<HTMLDivElement>(null);
  const stat3Ref = useRef<HTMLDivElement>(null);
  // Every copy's reels, per stat: the solid number and each echo of it.
  const reelCopies = useRef<(RollingNumberHandle | null)[][]>([[], [], []]);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();

  useGSAP(() => {
    if (!sectionRef.current) return;
    const root = sectionRef.current;

    const dur = prefersReducedMotion ? 0.01 : isTouch ? 0.5 : 1.0;
    // Read directly, not from the hook: useGSAP runs once on mount, before
    // useDeviceDetect has replaced its SSR defaults.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const statEls = [stat1Ref, stat2Ref, stat3Ref];
    // One handle per stat that rolls every copy in the trail together.
    const reels = [0, 1, 2].map((i) => ({
      current: {
        set: (v: number, immediate?: boolean) => {
          for (const h of reelCopies.current[i]) h?.set(v, immediate);
        },
      } as RollingNumberHandle,
    }));

    // ── Set initial hidden states immediately — prevents flash before trigger ─
    const heading1 = root.querySelector<HTMLElement>(".heading-1");
    const heading2 = root.querySelector<HTMLElement>(".heading-2");
    const desc1 = root.querySelector<HTMLElement>(".desc-1");
    if (heading1) gsap.set(heading1, { autoAlpha: 0, x: -120, skewX: -6 });
    if (heading2) gsap.set(heading2, { autoAlpha: 0, x: 120, skewX: 6 });
    if (desc1) gsap.set(desc1, { autoAlpha: 0, y: 24 });
    // .desc-2 is the same DOM node as .heading-2 — skip duplicate set

    // The stats arrive FROM ABOVE, straight down. They used to slide in along
    // the diagonal from the lower LEFT (x -80px, skewed), which on a phone put
    // the first number — sitting at the section's 24px gutter — 56px past the
    // left edge of the screen for the length of the entrance. A vertical
    // entrance can never leave the viewport sideways, and it falls in the
    // same direction the digits roll in.
    statEls.forEach((ref) => {
      if (!ref.current) return;
      gsap.set(ref.current, { autoAlpha: 0, y: -48, force3D: true });
      const suffixEl = ref.current.querySelector<HTMLElement>(".stat-suffix");
      const labelEl = ref.current.querySelector<HTMLElement>(".stat-label");
      if (suffixEl) gsap.set(suffixEl, { autoAlpha: 0, scale: 0.4, y: -20 });
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

    // ── Stats entrance: single master timeline, staggered ────────────────────
    const masterTl = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top 60%",
        once: true,
        invalidateOnRefresh: true,
      },
    });

    statEls.forEach((ref, index) => {
      if (!ref.current) return;
      const labelEl = ref.current.querySelector<HTMLElement>(".stat-label");
      const suffixEl = ref.current.querySelector<HTMLElement>(".stat-suffix");
      const o = prefersReducedMotion ? 0 : index * 0.2; // stagger offset in seconds

      masterTl.to(
        ref.current,
        {
          autoAlpha: 1,
          y: 0,
          duration: dur * 1.1,
          ease: "expo.out",
          force3D: true,
        },
        o,
      );

      // Label fade up
      if (labelEl) {
        masterTl.to(
          labelEl,
          { autoAlpha: 1, y: 0, duration: dur * 0.7, ease: "power2.out" },
          o + 0.25,
        );
      }

      // Suffix pop — dropping in, like everything else here
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

    // ── The numbers: odometer reels, driven by the scroll ────────────────────
    // The client's reference (Screen Recording 2026-09-23 171623) is a counter
    // whose digits ROLL one step at a time as the page scrolls — each step a
    // 0.40s cubic ease-out of one digit pitch, the unchanged digits holding
    // still (see RollingNumber). Here each stat counts from 0 to its figure
    // as it travels up the screen: the count is the stat's scroll progress,
    // and every change of it rolls the reels, new digits dropping in from
    // above. Scrolling back counts down and the reels roll the other way.
    // This replaces the loop that counted 0 → target over 2.2s on a timer,
    // over and over, whether or not anyone was scrolling.
    statEls.forEach((ref, index) => {
      const reel = reels[index].current;
      const el = ref.current;
      if (!reel || !el) return;
      const target = stats[index].target;
      if (reduce) {
        reel.set(target, true);
        return;
      }
      reel.set(0, true);
      // Counted in steps that keep every rolling digit readable. By ones, a
      // three-digit figure turns its units reel on every few pixels of
      // scroll, so it is never anything but mid-roll — noise, not a count.
      // In tens (hundreds for four digits) the last digit holds still and
      // the ones above it tick over one at a time, which is the reference's
      // character; the exact figure is still what it lands on.
      const step = target >= 100 ? 10 ** (String(target).length - 2) : 1;
      const countAt = (p: number) =>
        p >= 1 ? target : Math.floor((p * target) / step) * step;
      let first = true;
      ScrollTrigger.create({
        trigger: el,
        // From the stat's top entering the lower part of the screen to it
        // reaching just below the middle: the count finishes while the number
        // is well in view — on a phone too, where the last stat sits near the
        // section's foot — and holds at its figure from there on.
        start: "top 92%",
        end: "top 55%",
        onUpdate: (self) => reel.set(countAt(self.progress)),
        // A load or a jump that lands past (or inside) the range shows the
        // right figure at once instead of spinning up to it off screen.
        onRefresh: (self) => {
          reel.set(countAt(self.progress), first);
          first = false;
        },
      });
    });

    // ── Keeping every number inside the viewport ─────────────────────────────
    // The client's rule: whatever the screen size, and whatever the section is
    // doing, no number may run past either side of the screen. Three things
    // used to push them out:
    //   - the staircase's fixed 360px / 720px steps, which on any window
    //     narrower than ~1100px put the third stat partly or wholly past the
    //     right edge;
    //   - the diagonal glide below, which carries the whole staircase
    //     ±min(16vh, 10vw) sideways, and a per-stat drift on top of it;
    //   - the entrance, now vertical (above).
    // `fit` measures the room each number actually has — its row's width
    // (number + suffix) and its label's, at this font size, in this window —
    // and narrows only what does not fit: a step shrinks just enough for its
    // number to clear the right edge with the glide's travel to spare, and
    // the glide's reach on each side is capped by the tightest stat. Where the
    // designed layout already fits (a desktop from ~1100px up) nothing
    // changes. It runs on every ScrollTrigger refresh (resize, font swap,
    // layout shifts), BEFORE the tweens re-read their values.
    const depthOf = (i: number, wide: boolean) => (1 + i * 0.6) * (wide ? 1 : 0.45);
    const glide = { left: 0, right: 0 };
    const driftScale = [1, 1, 1];
    const fit = () => {
      const vw = document.documentElement.clientWidth;
      const wide = window.matchMedia("(min-width: 768px)").matches;
      const cLeft = root.getBoundingClientRect().left; // untransformed
      const col = root.clientWidth; // the column every stat's box spans
      const travel = reduce
        ? 0
        : Math.min(window.innerHeight * 0.16, window.innerWidth * 0.1);
      const items = statEls.map((r) => r.current);
      const rowOf = (el: HTMLElement) => el.querySelector<HTMLElement>(".stat-row");
      const labelOf = (el: HTMLElement) => el.querySelector<HTMLElement>(".stat-label");

      // ── 1. Natural sizes, measured with every step at 0 ──
      // A label wraps to whatever width its stat is given, so its width
      // depends on the step; measured at step 0 it shows its natural width
      // (its text, capped at 28ch). One batch of writes, then one of reads.
      for (const el of items) {
        if (!el) continue;
        el.style.marginLeft = "0px";
        for (const f of el.querySelectorAll<HTMLElement>(".stat-number, .stat-suffix")) {
          f.style.fontSize = "";
        }
      }
      // A number too big for the window at ANY step (only a very narrow
      // screen, well under 300px) is scaled down to fit, suffix with it.
      const avail = vw - EDGE - Math.max(cLeft, EDGE);
      for (const el of items) {
        const row = el && rowOf(el);
        if (!el || !row) continue;
        const rw = row.offsetWidth;
        if (rw > avail && rw > 0) {
          const k = avail / rw;
          for (const f of el.querySelectorAll<HTMLElement>(".stat-number, .stat-suffix")) {
            f.style.fontSize = `${parseFloat(getComputedStyle(f).fontSize) * k}px`;
          }
        }
      }
      // The number's reach includes its trail: the tail copy ends
      // TRAIL_COPIES × TRAIL_STEP_X font-sizes right of the number itself.
      const trailOf = (el: HTMLElement) => {
        const n = el.querySelector<HTMLElement>(".stat-number");
        if (!n || reduce) return 0;
        const fs = parseFloat(getComputedStyle(n).fontSize) || 0;
        return n.offsetWidth + TRAIL_COPIES * TRAIL_STEP_X * fs;
      };
      const rowW = items.map((el) =>
        el ? Math.max(rowOf(el)?.offsetWidth ?? 0, trailOf(el)) : 0,
      );
      const labelW = items.map((el) => (el && labelOf(el)?.offsetWidth) || 0);

      // ── 2. Each step: the designed one, narrowed only if it must be ──
      // At step m a stat reaches, on the right, its number or its label —
      // and the label is its natural width until the column runs out, then
      // the column's edge — plus the glide's travel and its own drift, which
      // is ±4·depth % of its width (the column less m). Take the largest m
      // up to the designed step that keeps all of that inside the window.
      items.forEach((el, i) => {
        if (!el) return;
        const desired = wide ? STAIR_WIDE[i] : STAIR_NARROW[i] * window.innerWidth;
        const c = reduce ? 0 : 0.04 * depthOf(i, wide);
        const reach = (m: number) =>
          cLeft + m + Math.max(rowW[i], Math.min(labelW[i], col - m)) + travel + c * (col - m);
        let m = Math.max(0, desired);
        while (m > 0 && reach(m) > vw - EDGE) m = Math.max(0, m - 1);
        el.style.marginLeft = `${m}px`;
      });

      // ── 3. The glide and drift, capped by the room actually left ──
      // Re-measured now the steps are set, so a label that re-wrapped is
      // counted at its real width.
      let lRoom = Infinity;
      let rRoom = Infinity;
      items.forEach((el, i) => {
        if (!el) return;
        const m = parseFloat(el.style.marginLeft) || 0;
        const w = Math.max(
          rowOf(el)?.offsetWidth ?? 0,
          labelOf(el)?.offsetWidth ?? 0,
          trailOf(el),
        );
        const drift0 = reduce ? 0 : 0.04 * depthOf(i, wide) * el.offsetWidth;
        const left = cLeft + m - EDGE; // room to the left edge
        const right = vw - EDGE - (cLeft + m + w); // …and to the right
        const drift = Math.max(0, Math.min(drift0, left / 2, right / 2));
        driftScale[i] = drift0 > 0 ? drift / drift0 : 0;
        lRoom = Math.min(lRoom, left - drift);
        rRoom = Math.min(rRoom, right - drift);
      });
      glide.left = Math.max(0, Math.min(travel, lRoom));
      glide.right = Math.max(0, Math.min(travel, rRoom));
    };
    fit();
    ScrollTrigger.addEventListener("refreshInit", fit);

    // ── Diagonal scroll (fromanother.love "our team" feel) ──
    // The whole stat staircase glides a real distance ALONG its 45° axis as the
    // section travels through the viewport — that's the prominent diagonal
    // "scroll". Driven on a wrapper with equal x/y px so the path is a true 45°
    // (xPercent/yPercent would map to width vs height and skew the angle). Each
    // stat then drifts a touch more on top (xPercent/yPercent, independent of
    // its entrance y) so they read as layered depth, not one rigid block.
    // Runs at EVERY width; skipped only for reduced motion.
    //
    // Its reach on each side comes from `fit` — the full min(16vh, 10vw)
    // wherever the numbers have that much room, less where they do not — so
    // the glide can never carry a number off the screen. Both axes use the
    // same figure at each end, so the path stays at 45°.
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
        const { wide, reduce: r } = ctx.conditions as {
          wide: boolean;
          narrow: boolean;
          reduce: boolean;
        };
        if (r) return;
        if (!statsWrapRef.current) return;

        gsap.fromTo(
          statsWrapRef.current,
          { x: () => -glide.left, y: () => -glide.left },
          {
            x: () => glide.right,
            y: () => glide.right,
            ease: "none",
            scrollTrigger: {
              trigger: root,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
              invalidateOnRefresh: true,
            },
          },
        );

        statEls.forEach((ref, i) => {
          if (!ref.current) return;
          const depth = () => depthOf(i, wide) * driftScale[i];
          gsap.fromTo(
            ref.current,
            { xPercent: () => -4 * depth(), yPercent: () => -4 * depth() },
            {
              xPercent: () => 4 * depth(),
              yPercent: () => 4 * depth(),
              ease: "none",
              scrollTrigger: {
                trigger: root,
                start: "top bottom",
                end: "bottom top",
                scrub: 1.4,
                invalidateOnRefresh: true,
              },
            },
          );
        });
      },
    );

    return () => {
      ScrollTrigger.removeEventListener("refreshInit", fit);
      mm.revert();
      for (const r of statEls) if (r.current) r.current.style.marginLeft = "";
    };
  }, []);

  return (
    <section
      // overflow-x-CLIP, not hidden: `hidden` on one axis coerces the other
      // from `visible` to `auto`, which makes this section a scroll container.
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
            {stats.map((stat, i) => (
              // The staircase steps (ml-*) are the designed layout and what
              // the server renders; the effect above narrows them inline only
              // where a number would not otherwise fit the window.
              <div
                key={stat.label}
                ref={[stat1Ref, stat2Ref, stat3Ref][i]}
                className={[
                  "stat-item relative",
                  // Capped in CSS as well, so the server-rendered page (before
                  // the section hydrates and `fit` runs) cannot run a stat
                  // past the right edge either: each step is at most the
                  // column less room for its number and label (~22rem).
                  i === 0 && "ml-0 mb-12 md:mb-20",
                  i === 1 && "ml-[10vw] md:ml-[min(360px,calc(100%-22rem))] mb-12 md:mb-20",
                  i === 2 && "ml-[20vw] md:ml-[min(720px,calc(100%-22rem))]",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/* w-max: the row's box is its content (number + suffix),
                    so the fit can measure exactly how wide the number is. */}
                <div className="stat-row flex w-max items-baseline gap-3">
                  {/* The repetition trail, as before the reels came in —
                      spacing={false}: this sits in a baseline flex row above
                      its label, and reserving the trail's full drop would
                      shove the label a couple of hundred pixels clear of its
                      own number. Every copy is a rolling number, so the echo
                      rolls with the figure it is an echo of. */}
                  <RepeatText
                    as="span"
                    copies={TRAIL_COPIES}
                    stepX={TRAIL_STEP_X}
                    spacing={false}
                    className="stat-number text-[clamp(5rem,12vw,11rem)] font-bold text-foreground tracking-tighter leading-none tabular-nums"
                    renderCopy={(c) => (
                      <RollingNumber
                        ref={(h) => {
                          reelCopies.current[i][c] = h;
                        }}
                        value={stat.target}
                      />
                    )}
                  />
                  <span className="stat-suffix text-[clamp(3rem,7vw,7rem)] font-bold text-maroon-accent leading-none">
                    {stat.suffix}
                  </span>
                </div>
                {/* w-fit: same wrapping as before (the 28ch cap still binds
                    first), but its box is now its text, so the fit can keep
                    it on screen along with its number. */}
                <p className="stat-label w-fit text-lg md:text-xl text-foreground-muted mt-3 max-w-[28ch] leading-snug">
                  {stat.label}
                </p>
              </div>
            ))}
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
