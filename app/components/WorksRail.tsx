"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import { useSplashHover } from "./useSplashHover";
import "@/app/styles/works-rail.css";

/**
 * ⚠️ PLACEHOLDER projects — swap `src`, `name`, `service`, `year` for the real
 * work. Note the 600×900 PORTRAIT crops: this layout stands the work up in tall
 * slats, and a square source either letterboxes or crops to nothing. Whatever
 * replaces these needs to be shot/cropped 2:3 or taller.
 */
interface Project {
  src: string;
  name: string;
  service: string;
  year: string;
}

const PROJECTS: Project[] = [
  { src: "https://picsum.photos/seed/zc-rail-01/600/900", name: "Forma Digital", service: "Brand Identity", year: "2026" },
  { src: "https://picsum.photos/seed/zc-rail-02/600/900", name: "Nero Vision", service: "Motion Design", year: "2025" },
  { src: "https://picsum.photos/seed/zc-rail-03/600/900", name: "Lumina Arc", service: "Web Experience", year: "2025" },
  { src: "https://picsum.photos/seed/zc-rail-04/600/900", name: "Atlas Foundry", service: "Brand Systems", year: "2024" },
  { src: "https://picsum.photos/seed/zc-rail-05/600/900", name: "Halo Studio", service: "Creative Direction", year: "2024" },
  { src: "https://picsum.photos/seed/zc-rail-06/600/900", name: "Drift Labs", service: "AI Automation", year: "2026" },
  { src: "https://picsum.photos/seed/zc-rail-07/600/900", name: "Solace", service: "Web Design", year: "2025" },
  { src: "https://picsum.photos/seed/zc-rail-08/600/900", name: "Vanta Goods", service: "Brand Identity", year: "2023" },
  { src: "https://picsum.photos/seed/zc-rail-09/600/900", name: "Pulse Health", service: "Product Design", year: "2024" },
  { src: "https://picsum.photos/seed/zc-rail-10/600/900", name: "Orbit Media", service: "Search Growth", year: "2025" },
  { src: "https://picsum.photos/seed/zc-rail-11/600/900", name: "Kestrel", service: "Art Direction", year: "2023" },
  { src: "https://picsum.photos/seed/zc-rail-12/600/900", name: "Mono Atelier", service: "Web Design", year: "2026" },
  { src: "https://picsum.photos/seed/zc-rail-13/600/900", name: "Spectra", service: "Motion Design", year: "2024" },
  { src: "https://picsum.photos/seed/zc-rail-14/600/900", name: "Northbound", service: "Brand Systems", year: "2025" },
];

/**
 * One slat.
 *
 * Deliberately NOT wired to `useSplashHover`, unlike the ferris wheel items it
 * replaces. The hook lazily creates a WebGL context per hovered element, and a
 * single sweep of the cursor along this rail hovers most of the row — measured
 * at 8 live contexts, on top of the ones the Unicorn background, the services
 * tunnel and the globe already hold. Past the browser's context ceiling the
 * oldest are killed and the page starts throwing. The effect earned little
 * here anyway: a ripple that chases the cursor across a slat reads poorly when
 * the slat is itself drifting out from under it. It stays on the enlarged
 * image, which is large, static, and only ever one at a time.
 *
 * `crossOrigin` is kept — the enlarged view reuses this exact already-decoded
 * image, and the splash there uploads it into a texture that a cross-origin
 * image without it would taint.
 */
function Slat({
  project,
  index,
  eager,
  registerRef,
  registerImgRef,
  onSelect,
}: {
  project: Project;
  index: number;
  eager: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  registerImgRef: (el: HTMLDivElement | null) => void;
  onSelect: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      ref={registerRef}
      className="wrail__slat"
      onPointerUp={onSelect}
      style={{ ["--i" as string]: index }}
    >
      {/* The frame clips; the picture inside is oversized and counter-shifts as
          the slat crosses the screen. That inner parallax is what turns "cards
          sliding past" into "moving past objects" — it is the cheapest depth
          cue available and does most of the work here. */}
      <div className="wrail__frame">
        <div className="wrail__shift" ref={registerImgRef}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.src}
            alt={project.name}
            className="wrail__img"
            draggable={false}
            crossOrigin="anonymous"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
          />
        </div>
        {/* Composited dimmer for the depth falloff. A per-frame `filter:
            brightness()` would repaint each slat every frame; animating the
            opacity of a flat overlay stays on the compositor. */}
        <span className="wrail__shade" aria-hidden />
      </div>
      <div className="wrail__cap">
        <span className="wrail__cap-no">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="wrail__cap-name">{project.name}</span>
        <span className="wrail__cap-year">{project.year}</span>
      </div>
    </div>
  );
}

/**
 * Selected work — the "whip rail".
 *
 * Replaces the orbiting ferris wheel, which failed for a reason that was
 * geometric rather than tunable: a circle needs two generous dimensions and a
 * portrait phone only has one. Its radius was `min(h*0.4, w*0.28)`, so width
 * always won and the whole wheel collapsed to a ~109px radius ring of 74px
 * thumbnails on a phone — the hero image of the work section was 148px across.
 * Depth was faked with scale and z-index alone, with no z-axis at all.
 *
 * Tall slats spend HEIGHT, which is the axis a phone has to spare, and the
 * depth here is real: slats sit in a perspective volume, angle toward the
 * vanishing point, recede on Z, dim with distance, and each picture parallaxes
 * inside its own frame.
 *
 * Motion is three layers stacked:
 *   1. a constant drift, so the rail is alive at rest;
 *   2. steer — cursor X (or a finger drag) adds velocity on top;
 *   3. the whip — see WHIP below.
 */
export default function WorksRail() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shiftRefs = useRef<(HTMLDivElement | null)[]>([]);
  const draggedRef = useRef(false); // set during a drag so it doesn't open one
  const originRectRef = useRef<DOMRect | null>(null);
  const lightboxImgRef = useRef<HTMLImageElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();

  const [focusIndex, setFocusIndex] = useState(0);
  const focusRef = useRef(0);
  const [entered, setEntered] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useSplashHover(lightboxRef, selected !== null);

  // Staggered entrance — trigger once when the section scrolls into view.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setEntered(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ── Enlarged view ────────────────────────────────────────────────────
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  useEffect(() => {
    if (selected === null) return;
    document.body.style.overflow = "hidden";
    window.dispatchEvent(new Event("app:scroll-lock"));
    return () => {
      document.body.style.overflow = "";
      window.dispatchEvent(new Event("app:scroll-unlock"));
    };
  }, [selected]);

  // FLIP: scale the already-loaded slat image up from where it sat in the rail
  // to its centred enlarged position — no second fetch.
  useEffect(() => {
    if (selected === null) return;
    const img = lightboxImgRef.current;
    const origin = originRectRef.current;
    if (!img) return;
    if (prefersReducedMotion || !origin) {
      img.style.opacity = "1";
      return;
    }
    const final = img.getBoundingClientRect();
    const sx = origin.width / final.width;
    const sy = origin.height / final.height;
    const dx = origin.left + origin.width / 2 - (final.left + final.width / 2);
    const dy = origin.top + origin.height / 2 - (final.top + final.height / 2);
    // Reveal now. The stylesheet keeps this image at opacity 0 so there is no
    // one-frame flash at the final position before the FLIP starts; from here
    // on, opacity belongs to whoever wants it — specifically the hover splash.
    img.style.opacity = "1";

    // Animate TRANSFORM ONLY, and do not fill forwards.
    //
    // Both of those matter. A running Web Animation outranks inline styles, so
    // an opacity track with `fill: "both"` meant the splash hook could never
    // hide the image to hand the picture to its ripple canvas — the untouched
    // image kept painting underneath, which is why the enlarged view looked
    // static and doubled. Committing the end state instead was worse: it wrote
    // opacity back onto the inline style and clobbered the hook's own value.
    // With opacity out of the keyframes there is nothing to fight over, and
    // with no forwards fill the element simply lands on its CSS transform
    // (none) — which is exactly where the last keyframe put it anyway.
    img.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transform: "translate(0, 0) scale(1, 1)" },
      ],
      {
        duration: 460,
        easing: "cubic-bezier(0.22, 0.9, 0.3, 1.04)",
        fill: "backwards",
      },
    );
  }, [selected, prefersReducedMotion]);

  // ── The rail engine ──────────────────────────────────────────────────
  useEffect(() => {
    if (prefersReducedMotion) return; // static row, see CSS
    const stage = stageRef.current;
    const slats = slatRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!stage || !slats.length) return;
    const N = slats.length;

    // ── Tunables ──
    const DRIFT = 26; // px/sec — the rail is never fully still
    const STEER_MAX = 900; // px/sec added at the very edge of the stage
    const DEADZONE = 0.12; // fraction of half-width where steer stays 0
    const ACCEL_TAU = 0.16; // sec — how fast the rail takes up a new velocity
    const FLING_TAU = 0.55; // sec — flick momentum decay
    const DEPTH = 240; // px pushed back on Z at the edges
    const TILT = 22; // deg turned toward the vanishing point at the edges
    const SHRINK = 0.12; // scale lost at the edges
    const DIM = 0.55; // shade opacity at the edges

    // WHIP. Each slat trails the rail by an amount proportional to the rail's
    // VELOCITY, and how much it trails is staggered by its distance from the
    // pointer: the slat under the cursor keeps up, distant ones fall behind. A
    // spring — not a lerp — carries each one to that trailing position, so a
    // sudden change of direction overshoots and snaps back. That transient
    // overshoot is the whiplash; a plain velocity skew (the usual trick) only
    // ever smears, because it has no state to overshoot with.
    //
    // Keying the trail on velocity rather than on acceleration is what keeps
    // this stable: at a constant drift the steady-state trail is DRIFT * TAU ≈
    // 2px, so the row sits evenly spaced at rest and only fans while something
    // is actually moving it.
    const WHIP_TAU = 0.11; // sec of trail per unit velocity
    const WHIP_STIFF = 150; // spring constant
    const WHIP_DAMP = 11; // < 2*sqrt(STIFF) ⇒ underdamped ⇒ one clean overshoot
    const LAG_MIN = 0.25; // trail multiplier at the pointer
    const LAG_MAX = 1.0; // …and a full stage-width away
    const WHIP_TILT = 0.05; // deg of extra rotateY per px of trail
    // Cursor SPEED, not just position, throws the rail: a quick flick across
    // the stage shoves it even if the cursor ends up back in the dead zone.
    // Position alone can only ever ramp smoothly to a steady speed, which is
    // the one thing a whip is not.
    const FLICK_GAIN = 0.55;
    const FLICK_MAX = 2600;
    // Above this rail speed the centre slat is changing too fast to label.
    const FOCUS_SETTLE_VEL = 420; // px/sec

    let w = 0;
    let slot = 0;
    let slatW = 0;
    let total = 0;
    // Cached so the pointer handler never reads layout. Only a horizontal
    // layout change can move this — the page never scrolls sideways, and
    // vertical scroll doesn't alter a rect's `left`.
    let stageLeft = 0;
    // Resolved once instead of walking the DOM whenever a shade value changes.
    const shades: (HTMLElement | null)[] = [];

    const measure = () => {
      const r = stage.getBoundingClientRect();
      w = r.width;
      stageLeft = r.left;
      // Fractional counts on purpose: the edge slats are always cut, which is
      // what reads as "this continues" rather than "this is all of it".
      const inView = w >= 1200 ? 5.5 : w >= 981 ? 4.5 : w >= 601 ? 2.75 : 1.25;
      slot = w / inView;
      slatW = slot * 0.9;
      total = N * slot;
      for (let i = 0; i < N; i++) {
        slats[i].style.width = `${slatW}px`;
        shades[i] = slats[i].querySelector(".wrail__shade");
      }
    };
    measure();

    // ── State ──
    let railOffset = 0;
    let railVel = 0;
    const whip = new Float32Array(N);
    const whipVel = new Float32Array(N);
    const shadeCache = new Float32Array(N).fill(-1);
    const hiddenCache = new Uint8Array(N);

    // ── Input ──
    let pointerX = w / 2; // where the whip is anchored
    let steer = 0;
    let hovering = false;
    let dragging = false;
    let dragLastX = 0;
    let dragLastT = 0;
    let dragVel = 0;
    let fling = 0;
    let moved = 0;

    let lastPT = 0;

    const onPointerMove = (e: PointerEvent) => {
      const prevX = pointerX;
      pointerX = e.clientX - stageLeft;
      if (dragging) {
        const now = performance.now();
        const dx = e.clientX - dragLastX;
        const dt = (now - dragLastT) / 1000;
        moved += Math.abs(dx);
        railOffset -= dx;
        if (dt > 0) dragVel = -dx / dt;
        dragLastX = e.clientX;
        dragLastT = now;
        if (moved > 8) draggedRef.current = true;
        return;
      }
      if (!hovering || isTouch) return;
      // Steer: signed distance from the stage centre, dead in the middle so a
      // resting cursor doesn't shove the rail around.
      const t = (pointerX / w) * 2 - 1;
      const s = Math.sign(t) * Math.max(0, Math.abs(t) - DEADZONE) /
        (1 - DEADZONE);
      steer = s * STEER_MAX;

      // …and the flick impulse on top. Guarded against the huge synthetic
      // velocity a first event (or a re-entry after the pointer has been away)
      // would otherwise report.
      const now = performance.now();
      const dtp = (now - lastPT) / 1000;
      if (lastPT && dtp > 0 && dtp < 0.1) {
        fling = Math.max(
          -FLICK_MAX,
          Math.min(FLICK_MAX, fling + ((pointerX - prevX) / dtp) * FLICK_GAIN),
        );
      }
      lastPT = now;
    };

    const onEnter = () => {
      hovering = true;
    };
    const onLeave = () => {
      hovering = false;
      steer = 0;
      pointerX = w / 2;
      lastPT = 0; // next entry starts a fresh flick sample
    };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      draggedRef.current = false;
      moved = 0;
      dragVel = 0;
      fling = 0;
      dragLastX = e.clientX;
      dragLastT = performance.now();
      stage.classList.add("is-grabbing");
    };
    const endDrag = (fl: boolean) => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("is-grabbing");
      // A touch gesture does NOT always end in `pointerup` — the browser fires
      // `pointercancel` the moment it claims the drag for a page scroll. The
      // old wheel only listened for pointerup, so `dragging` stayed true and
      // its guard froze the rotation until the next touch. Both are handled,
      // and a cancelled gesture deliberately does not fling.
      fling = fl ? Math.max(-4000, Math.min(4000, dragVel)) : 0;
      dragVel = 0;
    };
    const onUp = () => endDrag(true);
    const onCancel = () => endDrag(false);

    stage.addEventListener("pointerenter", onEnter);
    stage.addEventListener("pointerleave", onLeave);
    stage.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);

    let lastW = window.innerWidth;
    const onResize = () => {
      // Height-only resizes are the mobile URL bar sliding; re-measuring on
      // those would restate every slat's width for nothing.
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      measure();
    };
    window.addEventListener("resize", onResize);

    const mod = (v: number, m: number) => ((v % m) + m) % m;

    let raf = 0;
    let running = true;
    let last = performance.now();

    const frame = (now: number) => {
      if (!running) {
        raf = 0;
        return;
      }
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      if (dragging) {
        // railOffset is written straight from the move handler; the whip still
        // wants a velocity, so hand it the drag's.
        railVel = dragVel;
      } else {
        const vTarget = DRIFT + steer + fling;
        railVel += (vTarget - railVel) * (1 - Math.exp(-dt / ACCEL_TAU));
        railOffset += railVel * dt;
        fling *= Math.exp(-dt / FLING_TAU);
        if (Math.abs(fling) < 1) fling = 0;
      }

      let bestD = Infinity;
      let bestI = 0;

      for (let i = 0; i < N; i++) {
        // Wrap into [-slot, total-slot): a slat leaving the left edge reappears
        // off the right, which is off-screen so long as total > w + slot.
        const x = mod(i * slot - railOffset + slot, total) - slot;
        const cx = x + slatW / 2;

        // Whip — integrated for every slat, on-screen or not, so one that wraps
        // back in arrives already settled instead of snapping into place.
        const lag =
          LAG_MIN +
          (LAG_MAX - LAG_MIN) * Math.min(Math.abs(cx - pointerX) / w, 1);
        const wTarget = -lag * railVel * WHIP_TAU;
        whipVel[i] += (wTarget - whip[i]) * WHIP_STIFF * dt;
        whipVel[i] *= Math.exp(-WHIP_DAMP * dt);
        whip[i] += whipVel[i] * dt;

        const el = slats[i];
        const finalX = x + whip[i];

        // Cull: an off-screen slat is dropped from compositing entirely rather
        // than kept as a live layer. On a phone only ~2 of the 14 are ever in
        // view, and every promoted slat costs slatW × height × 4 bytes.
        if (finalX < -slatW - 60 || finalX > w + 60) {
          if (!hiddenCache[i]) {
            hiddenCache[i] = 1;
            el.style.visibility = "hidden";
          }
          continue;
        }
        if (hiddenCache[i]) {
          hiddenCache[i] = 0;
          el.style.visibility = "";
        }

        const d = (cx - w / 2) / (w / 2); // -1 … 1 across the stage
        const ad = Math.min(Math.abs(d), 1);
        if (ad < bestD) {
          bestD = ad;
          bestI = i;
        }

        const z = -ad * DEPTH;
        const ry = d * TILT + whip[i] * WHIP_TILT;
        const sc = 1 - ad * SHRINK;
        el.style.transform = `translate3d(${finalX}px, 0, ${z}px) rotateY(${ry}deg) scale(${sc})`;

        const shade = Math.round(ad * DIM * 100) / 100;
        if (shadeCache[i] !== shade) {
          shadeCache[i] = shade;
          const s = shades[i];
          if (s) s.style.opacity = String(shade);
        }

        // Inner counter-parallax — the picture drifts against the slat, so the
        // frame reads as a window rather than a printed card.
        const shift = shiftRefs.current[i];
        if (shift)
          shift.style.transform = `translate3d(${-d * slatW * 0.09}px, 0, 0)`;
      }

      // Only re-label once the rail is slow enough for the label to be worth
      // reading. Two reasons, both load-bearing: a spinning rail changes its
      // centre slat every ~100ms, and the foot caption is keyed on this index —
      // so it would re-mount faster than its 0.5s crossfade could finish and
      // simply never become visible. Holding the last value also stops the name
      // strobing through fourteen projects during a flick, which nobody can
      // read anyway. It settles onto the right one as the rail comes to rest.
      if (bestI !== focusRef.current && Math.abs(railVel) < FOCUS_SETTLE_VEL) {
        focusRef.current = bestI;
        setFocusIndex(bestI);
      }
      raf = requestAnimationFrame(frame);
    };

    // Pause entirely while the section is off-screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      },
      { threshold: 0 },
    );
    io.observe(sectionRef.current ?? stage);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      stage.removeEventListener("pointerenter", onEnter);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("resize", onResize);
    };
  }, [prefersReducedMotion, isTouch]);

  const open = useCallback(
    (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggedRef.current) return; // the pointerup that ends a drag
      const frame = (e.currentTarget as HTMLElement).querySelector(
        ".wrail__frame",
      );
      originRectRef.current = (frame ?? e.currentTarget).getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent("app:splash", {
          detail: { x: e.clientX, y: e.clientY },
        }),
      );
      setSelected(i);
    },
    [],
  );

  const focused = PROJECTS[focusIndex];

  return (
    <section
      ref={sectionRef}
      id="work"
      className="wrail"
      aria-label="Selected work"
    >
      <div className="wrail__head">
        <span className="wrail__eyebrow">Selected Work</span>
        <span className="wrail__count">({PROJECTS.length})</span>
      </div>

      <div
        ref={stageRef}
        className={`wrail__stage${entered ? " is-in" : ""}`}
      >
        {PROJECTS.map((p, i) => (
          <Slat
            key={p.name}
            project={p}
            index={i}
            eager={i < 4}
            registerRef={(el) => {
              slatRefs.current[i] = el;
            }}
            registerImgRef={(el) => {
              shiftRefs.current[i] = el;
            }}
            onSelect={open(i)}
          />
        ))}
      </div>

      <div className="wrail__foot" aria-live="polite">
        {/* Keyed on the index so the pair re-mounts and replays its crossfade
            as the rail brings the next project to centre. */}
        <div className="wrail__foot-meta" key={focusIndex}>
          <h3 className="wrail__foot-name">{focused.name}</h3>
          <span className="wrail__foot-service">{focused.service}</span>
        </div>
        <span className="wrail__foot-hint">
          {isTouch ? "Swipe · tap to open" : "Move to steer · click to open"}
        </span>
      </div>

      {/* Portaled to <body> so `fixed` resolves against the viewport — the
          section carries `perspective`, which would otherwise be the containing
          block and leave a gap top and bottom. */}
      {selected !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={lightboxRef}
            className="wrail__lightbox bg-black/30 backdrop-blur-2xl"
            data-lenis-prevent
            role="dialog"
            aria-modal="true"
            aria-label={PROJECTS[selected].name}
            onClick={() => setSelected(null)}
          >
            <button
              type="button"
              className="wrail__lightbox-close"
              aria-label="Close"
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={lightboxImgRef}
              src={PROJECTS[selected].src}
              alt={PROJECTS[selected].name}
              className="wrail__lightbox-img"
              crossOrigin="anonymous"
            />
            <div className="wrail__lightbox-cap">
              <span className="wrail__cap-year">{PROJECTS[selected].year}</span>
              <h3 className="wrail__lightbox-name">
                {PROJECTS[selected].name}
              </h3>
              <span className="wrail__foot-service">
                {PROJECTS[selected].service}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
