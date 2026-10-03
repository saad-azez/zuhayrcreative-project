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
 * The numbers' repetition trail (RepeatText) — the same echo "BEYOND
 * INFLUENCE" has: copies peel off down and to the right as the number rises
 * up the screen. Each copy carries its own reels, rolled in step with the
 * solid one.
 */
const TRAIL_COPIES = 6;
const TRAIL_STEP_X = 0.073;
/**
 * The stats' scroll, built the way the client's reference builds it
 * (fromanother.love's team section, Screen Recording 2026-10-02 193653 —
 * read off its live CSS): the screen PINS, and the stats sit stacked in one
 * box at its centre, each offset by `index − progress × last` steps, where a
 * step is one box width plus GAP across and one box height plus GAP down. At
 * progress 0 the first stat is in the centre and the rest stand down and to
 * the right of it, a staircase; as the pinned scroll runs, the whole
 * staircase slides up and to the left together, one step per stat, until the
 * last stat is in the centre — the one before it cut off at the top-left,
 * the next at the bottom-right. Whichever stat is nearest the centre is lit;
 * the others stand at DIM. Inside each, the stat drifts with the scroll's
 * velocity (VELOCITY px per px of speed, both ways), as the reference's
 * pictures do.
 */
const GAP = 32;
const GAP_PHONE = 24;
/** Screens of pinned scroll per step (the reference: 660px a card at 990px tall). */
const STEP_SCROLL = 0.66;
const DIM = 0.3;
const VELOCITY = 0.9;
/** Closest the box may come to either side of the screen, px. */
const SIDE = 16;

export default function ImpactSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const runwayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
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

    // ── The stats: pinned, and the staircase slides through ──────────────────
    const runway = runwayRef.current;
    const stage = stageRef.current;
    const cards = cardsRef.current;
    const items = [stat1Ref, stat2Ref, stat3Ref].map((r) => r.current);
    if (!runway || !stage || !cards || items.some((el) => !el)) return;
    const els = items as HTMLElement[];
    const n = els.length;

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

    // The box every stat sits in: as wide as the widest stat (trail and all)
    // and tall enough for the tallest — squared up toward its width, as the
    // reference's near-square cards are, so the steps run at about 45°, but
    // never more than 45% of the screen's height, so the stats either side of
    // the centre still show at its corners. Re-read on resize, never per frame.
    let H = 0;
    let boxH = 0;
    let gap = GAP;
    const measure = () => {
      const W = document.documentElement.clientWidth;
      H = stage.offsetHeight || window.innerHeight;
      gap = W < 768 ? GAP_PHONE : GAP;
      let w = 0;
      let h = 0;
      for (const el of els) {
        const inner = el.firstElementChild as HTMLElement | null;
        if (!inner) continue;
        const num = inner.querySelector<HTMLElement>(".stat-number");
        const fs = num ? parseFloat(getComputedStyle(num).fontSize) || 0 : 0;
        const trail = num ? num.offsetLeft + num.offsetWidth + TRAIL_COPIES * TRAIL_STEP_X * fs : 0;
        w = Math.max(w, inner.offsetWidth, trail);
        h = Math.max(h, inner.offsetHeight);
      }
      const boxW = Math.min(w, W - 2 * SIDE);
      boxH = Math.max(h, Math.min(boxW, H * 0.45));
      cards.style.setProperty("--w", `${boxW}px`);
      cards.style.setProperty("--h", `${boxH}px`);
      cards.style.setProperty("--gap", `${gap}px`);
    };

    // Reduced motion: no pin, no slide — the middle stat in the centre with
    // the others on the staircase either side, all lit, at their figures.
    if (reduce) {
      measure();
      runway.style.height = "auto";
      stage.style.position = "relative";
      els.forEach((el, i) => {
        el.style.setProperty("--rel", String(i - 1));
        el.style.opacity = "1";
        reelSet(i, stats[i].target, true);
      });
      return;
    }

    // Progress runs 0 → 1 over the pinned stretch of the runway, read off
    // live geometry every frame while it is near the screen (a cached
    // ScrollTrigger range this far down the page goes stale as the sections
    // above it settle).
    let vel = 0;
    let lastY = window.scrollY;
    let active = -1;
    const lastCount = [-1, -1, -1];
    const place = (immediate = false) => {
      const r = runway.getBoundingClientRect();
      const travel = r.height - H;
      const p = travel > 0 ? gsap.utils.clamp(0, 1, -r.top / travel) : 0;
      const t = p * (n - 1);
      // Where the stage stands now (it is sticky), so each stat's centre on
      // screen comes from arithmetic, not from a layout read after writing.
      const stageTop = Math.min(Math.max(r.top, 0), r.top + r.height - H);
      const centre = stageTop + H / 2;

      // The scroll's velocity, eased, for the drift inside each stat.
      const y = window.scrollY;
      vel += (y - lastY - vel) * 0.2;
      lastY = y;
      if (Math.abs(vel) < 0.01) vel = 0;
      cards.style.setProperty("--v", (gsap.utils.clamp(-60, 60, vel) * VELOCITY).toFixed(2));

      const a = Math.round(t);
      els.forEach((el, i) => {
        const rel = i - t;
        el.style.setProperty("--rel", rel.toFixed(4));
        if (a !== active) el.style.opacity = i === a ? "1" : String(DIM);
        // Each figure rolls up from 0 as its stat rises toward the centre,
        // and has landed a little before it gets there.
        const c = centre + rel * (boxH + gap);
        const nNow = countAt(i, gsap.utils.clamp(0, 1, (H - c) / (H * 0.4)));
        if (nNow !== lastCount[i]) {
          reelSet(i, nNow, immediate);
          lastCount[i] = nNow;
        }
      });
      active = a;
    };
    measure();
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
      { rootMargin: "25% 0px" },
    );
    io.observe(runway);
    const resize = () => {
      measure();
      update();
    };
    const ro = new ResizeObserver(resize);
    for (const el of els) if (el.firstElementChild) ro.observe(el.firstElementChild);
    window.addEventListener("resize", resize);

    return () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", resize);
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
          (wide screens only). */}
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

      {/* ── Stats ── The runway buys the pinned scroll; the stage sticks to
          the screen inside it, and the three stats sit stacked in one box at
          its centre, each offset along the staircase by --rel steps (see the
          effect above). Before the script runs, --rel is the stat's index: the
          first in the centre, the rest down and to the right. Full-bleed (the
          -mx undoes the section's gutters) and overflow-hidden, so the stats
          either side of the centre are cut off by the screen's edges, as the
          reference's pictures are. */}
      <div
        ref={runwayRef}
        className="relative z-10 -mx-6 md:-mx-12"
        style={{ height: `calc(100svh + ${((stats.length - 1) * STEP_SCROLL * 100).toFixed(0)}svh)` }}
      >
        <div
          ref={stageRef}
          className="sticky top-0 h-svh overflow-hidden flex items-center justify-center"
        >
          <div
            ref={cardsRef}
            className="grid"
            style={
              {
                "--w": "min(30rem, 80vw)",
                "--h": "min(18rem, 40svh)",
                "--gap": `${GAP}px`,
                "--v": 0,
                width: "var(--w)",
                height: "var(--h)",
                gridTemplate: "1fr / 1fr",
              } as React.CSSProperties
            }
          >
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                ref={[stat1Ref, stat2Ref, stat3Ref][i]}
                className="flex items-center justify-center will-change-transform"
                style={
                  {
                    "--rel": i,
                    gridArea: "1 / 1",
                    transform:
                      "translate3d(calc((100% + var(--gap)) * var(--rel)), calc((100% + var(--gap)) * var(--rel)), 0)",
                    opacity: i === 0 ? 1 : DIM,
                    transition: "opacity 0.45s ease",
                  } as React.CSSProperties
                }
              >
                {/* The drift with the scroll's velocity. */}
                <div
                  className="stat-item relative w-max"
                  style={{ transform: "translate3d(calc(var(--v) * 1px), calc(var(--v) * 1px), 0)" }}
                >
                  <div className="stat-row flex w-max items-baseline gap-3">
                    {/* The repetition trail — spacing={false}: this sits in a
                        baseline flex row above its label, and reserving the
                        trail's full drop would shove the label a couple of
                        hundred pixels clear of its own number. Every copy is a
                        rolling number, so the echo rolls with the figure it
                        echoes. */}
                    <RepeatText
                      as="span"
                      copies={TRAIL_COPIES}
                      stepX={TRAIL_STEP_X}
                      spacing={false}
                      style={{ fontSize: "clamp(3.25rem, 12vw, 11rem)" }}
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
                      style={{ fontSize: "clamp(2rem, 7vw, 7rem)" }}
                    >
                      {stat.suffix}
                    </span>
                  </div>
                  {/* Wraps sooner on a narrow screen (13ch on a phone, 28ch on a
                      desktop), so the long label doesn't make every stat's box
                      wide enough to push its neighbours off a phone's screen. */}
                  <p
                    className="stat-label w-fit text-base md:text-xl text-foreground-muted mt-2 md:mt-3 max-w-[28ch] leading-snug"
                    style={{ maxWidth: "clamp(13ch, 30vw, 28ch)" }}
                  >
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
