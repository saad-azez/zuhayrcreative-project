"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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
 * The diagonal scroll, as in the client's reference (Screen Recording
 * 2026-10-02 193653, fromanother.love's "our story"): nothing pins and
 * nothing fades. The stats ride the page's own scroll up the screen, and as
 * they rise they slide left, so every one of them travels the same diagonal
 * line — coming in over the bottom edge a little in from the right
 * (ENTRY_X across the screen), going out over the top edge at the left
 * (SIDE in). Each stat's sideways place is a function of its height on the
 * screen alone, so the three always sit on that one line, one behind the
 * other, and move exactly with the scroll — as smooth as the page itself.
 */
const ENTRY_X = 0.62;
/** Closest a stat may come to either side of the screen, px. */
const SIDE = 24;
/**
 * The numbers' repetition trail (RepeatText) — the same echo "BEYOND
 * INFLUENCE" has: copies peel off down and to the right as the number rises
 * up the screen. Each copy carries its own reels, rolled in step with the
 * solid one.
 */
const TRAIL_COPIES = 6;
const TRAIL_STEP_X = 0.073;
const TRAIL_STEP_Y = 0.119; // RepeatText's default `step`

export default function ImpactSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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

    // ── Heading entrances ────────────────────────────────────────────────────
    const heading1 = root.querySelector<HTMLElement>(".heading-1");
    const heading2 = root.querySelector<HTMLElement>(".heading-2");
    const desc1 = root.querySelector<HTMLElement>(".desc-1");
    // Initial hidden states set at once — prevents a flash before the trigger.
    if (heading1) gsap.set(heading1, { autoAlpha: 0, x: -40, skewX: -6 });
    if (heading2) gsap.set(heading2, { autoAlpha: 0, x: 40, skewX: 6 });
    if (desc1) gsap.set(desc1, { autoAlpha: 0, y: 24 });

    for (const el of [heading1, heading2]) {
      if (!el) continue;
      gsap.to(el, {
        autoAlpha: 1,
        x: 0,
        skewX: 0,
        duration: dur * 1.3,
        ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    }
    if (desc1) {
      gsap.to(desc1, {
        autoAlpha: 1,
        y: 0,
        duration: dur * 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: desc1, start: "top 92%", once: true },
      });
    }

    // ── The diagonal scroll ──────────────────────────────────────────────────
    const list = listRef.current;
    const items = [stat1Ref, stat2Ref, stat3Ref].map((r) => r.current);
    if (!list || items.some((el) => !el)) return;
    const els = items as HTMLElement[];

    // One call per stat that rolls every copy in its trail together.
    const reelSet = (i: number, v: number, immediate?: boolean) => {
      for (const h of reelCopies.current[i]) h?.set(v, immediate);
    };
    // Counted in steps that keep every rolling digit readable. By ones, a
    // three-digit figure turns its units reel on every few pixels of scroll,
    // so it is never anything but mid-roll — noise, not a count. In tens
    // (hundreds for four digits) the last digit holds still and the ones
    // above it tick over one at a time; the exact figure is still what it
    // lands on.
    const countAt = (i: number, p: number) => {
      const target = stats[i].target;
      const step = target >= 100 ? 10 ** (String(target).length - 2) : 1;
      return p >= 1 ? target : Math.floor((p * target) / step) * step;
    };

    // The inline margins in the markup are only the server render's layout;
    // from here on each stat's place across the screen is its transform.
    for (const el of els) el.style.marginLeft = "0px";
    const setX = els.map((el) => gsap.quickSetter(el, "x", "px"));
    gsap.set(els, { force3D: true });

    // Sizes, re-read whenever the screen or a stat changes size (font swap,
    // rotation, the toolbar collapsing) — never mid-frame.
    let W = 0;
    let H = 0;
    let sizes: { w: number; h: number }[] = [];
    const measure = () => {
      W = document.documentElement.clientWidth;
      H = window.innerHeight;
      // A stat's reach includes its echo trail, which overflows its box: the
      // tail copy is the number shifted TRAIL_COPIES steps right and down.
      sizes = els.map((el) => {
        const n = el.querySelector<HTMLElement>(".stat-number");
        if (!n) return { w: el.offsetWidth, h: el.offsetHeight };
        const fs = parseFloat(getComputedStyle(n).fontSize) || 0;
        return {
          w: Math.max(el.offsetWidth, n.offsetLeft + n.offsetWidth + TRAIL_COPIES * TRAIL_STEP_X * fs),
          h: Math.max(el.offsetHeight, n.offsetTop + n.offsetHeight + TRAIL_COPIES * TRAIL_STEP_Y * fs),
        };
      });
    };

    // Where on the line a stat whose top is `top` px down the screen sits
    // across it: at the entry point when it is just coming in over the
    // bottom edge, at SIDE when it has just gone out over the top. Clamped
    // past both ends, so off screen it never strays sideways either. The
    // entry point is held in from the right edge far enough for the widest
    // stat, trail and all.
    const xAt = (top: number) => {
      const wMax = Math.max(...sizes.map((s) => s.w));
      const hMax = Math.max(...sizes.map((s) => s.h));
      const entry = Math.max(SIDE, Math.min(W * ENTRY_X, W - SIDE - wMax));
      const p = gsap.utils.clamp(0, 1, (top + hMax) / (H + hMax));
      return SIDE + (entry - SIDE) * p;
    };

    const lastCount = [-1, -1, -1];
    const place = (immediate = false) => {
      // Every read, then every write: the tops are untransformed (only x is
      // ever set), so the list's own box gives each stat's place without
      // forcing a layout per stat.
      const r = list.getBoundingClientRect();
      els.forEach((el, i) => {
        const top = r.top + el.offsetTop;
        setX[i](xAt(top) - r.left);
        // The figure rolls up from 0 as it comes in over the bottom edge, and
        // has landed by the time it is halfway up the screen.
        const n = countAt(i, gsap.utils.clamp(0, 1, (H - top) / (H * 0.5)));
        if (n !== lastCount[i]) {
          reelSet(i, n, immediate);
          lastCount[i] = n;
        }
      });
    };

    measure();

    // Reduced motion: the three stand still on the line, as they would sit
    // with the middle one halfway up the screen, at their full figures.
    if (reduce) {
      const r = list.getBoundingClientRect();
      const mid = els[1].offsetTop;
      els.forEach((el, i) => {
        setX[i](xAt(H / 2 + el.offsetTop - mid) - r.left);
        reelSet(i, stats[i].target, true);
      });
      return;
    }

    // Read off live geometry every frame, like RepeatText, while the list is
    // on screen — a cached ScrollTrigger range this far down the page goes
    // stale as the sections above it settle. On desktop the page's scroll is
    // Lenis-smoothed, and this follows that same smoothed position, so the
    // slide sideways stays in step with the rise.
    const update = () => place();
    place(true);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) gsap.ticker.add(update);
        else {
          gsap.ticker.remove(update);
          update(); // settle where it left the screen
        }
      },
      { rootMargin: "50% 0px" },
    );
    io.observe(list);
    const ro = new ResizeObserver(() => {
      measure();
      update();
    });
    ro.observe(list);
    for (const el of els) ro.observe(el);
    const onResize = () => {
      measure();
      update();
    };
    window.addEventListener("resize", onResize);

    return () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      gsap.ticker.remove(update);
    };
  }, []);

  return (
    <section
      // overflow-x-CLIP, not hidden: `hidden` on one axis coerces the other
      // from `visible` to `auto`, which makes this section a scroll container.
      className="relative h-auto py-16 md:py-24 px-6 md:px-12 overflow-x-clip w-full max-w-full"
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

      {/* ── Headings ── BEYOND INFLUENCE on the left, AND IMPACT on the right
          (wide screens only, as before). They sit above the locked screen,
          not on it, so the numbers never pass over any text: by the time the
          screen locks they have scrolled away. */}
      <div ref={sectionRef} className="max-w-400 mx-auto relative z-10 w-full mb-10 md:mb-16">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 lg:gap-12">
          <div className="flex-1">
            {/* Repetition effect — the copies unzip as the section scrolls
                past (see RepeatText.tsx). Kept on the same node that carries
                .heading-1, so the entrance tween above finds it. */}
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
          <div className="heading-2 hidden lg:flex flex-col w-[42%] lg:mt-24">
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
        </div>
      </div>

      {/* ── Stats: the diagonal scroll ──────────────────────────────────────
          Right under the headings, in the page's own flow, one below the
          other; the effect above slides each across the screen as it rises,
          so they travel one diagonal line. Full-bleed — the -mx undoes the
          section's gutters — so that line can use the whole screen's width.
          The headings stay above them all the way: both scroll at the same
          rate, so the gap between them never closes. */}
      <div ref={listRef} className="relative z-10 -mx-6 md:-mx-12">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            ref={[stat1Ref, stat2Ref, stat3Ref][i]}
            className="stat-item relative w-max will-change-transform"
            // One behind the other down the line: about half a screen
            // apart, as the reference spaces its pictures. The margin-left
            // is only the server render's layout, before the effect takes
            // over.
            style={{
              marginBottom: i < stats.length - 1 ? "28svh" : undefined,
              marginLeft: `${12 + i * 16}%`,
            }}
          >
            {/* w-max: the row's box is its content (number + suffix), so
                the run can measure exactly how wide the number is. */}
            <div className="stat-row flex w-max items-baseline gap-3">
              {/* The repetition trail — spacing={false}: this sits in a
                  baseline flex row above its label, and reserving the
                  trail's full drop would shove the label a couple of
                  hundred pixels clear of its own number. Every copy is a
                  rolling number, so the echo rolls with the figure it
                  echoes. Sized off the screen's height as well as its
                  width, so a number and its trail fit the run area. */}
              <RepeatText
                as="span"
                copies={TRAIL_COPIES}
                stepX={TRAIL_STEP_X}
                step={TRAIL_STEP_Y}
                spacing={false}
                style={{ fontSize: "clamp(3.25rem, min(12vw, 18svh), 11rem)" }}
                className="stat-number font-bold text-foreground tracking-tighter leading-none tabular-nums"
                renderCopy={(c) => (
                  <RollingNumber
                    ref={(h) => {
                      reelCopies.current[i][c] = h;
                    }}
                    value={stat.target}
                  />
                )}
              />
              <span
                className="stat-suffix font-bold text-maroon-accent leading-none"
                style={{ fontSize: "clamp(2rem, min(7vw, 10.5svh), 7rem)" }}
              >
                {stat.suffix}
              </span>
            </div>
            <p className="stat-label w-fit text-base md:text-xl text-foreground-muted mt-2 md:mt-3 max-w-[28ch] leading-snug">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
