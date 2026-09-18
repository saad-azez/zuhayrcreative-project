"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import { useLocomotiveScroll } from "./LocomotiveScrollProvider";
import WebGLTextTunnel from "./WebGLTextTunnel";
import { useSceneLease } from "@/app/animations/hooks/useNearViewport";
import ChromaticMetal from "./ChromaticMetal";
import "@/app/styles/services-section-v3.css";

interface Service {
  index: string;
  name: string;
  description: string;
  tag: string;
}

const SERVICES: Service[] = [
  {
    index: "00_1",
    tag: "WEB",
    name: "Web Design",
    description:
      "Premium interfaces engineered for clarity, motion, and conversion.",
  },
  {
    index: "00_2",
    tag: "AI",
    name: "AI Automation",
    description:
      "Custom agents and pipelines that compress hours of work into minutes.",
  },
  {
    index: "00_3",
    tag: "SEO",
    name: "Search Growth",
    description:
      "Technical, content, and link strategies that move rankings on intent.",
  },
  {
    index: "00_4",
    tag: "BRAND",
    name: "Brand Systems",
    description:
      "Identities and visual languages that scale across every touchpoint.",
  },
];

/**
 * Detailed services for the "Expand" sideways-scroll view (monopo-style).
 *
 * ⚠️ PLACEHOLDER CONTENT — these sub-services are reasonable guesses grouped
 * under the four general buckets. Replace `items` (and copy) with the real
 * detailed services from the old website once provided.
 */
interface ServiceDetail {
  index: string;
  tag: string;
  name: string;
  blurb: string;
  items: string[];
}

const SERVICE_DETAILS: ServiceDetail[] = [
  {
    index: "01",
    tag: "WEB",
    name: "Web Design & Development",
    blurb: "Interfaces engineered for clarity, motion, and conversion.",
    items: [
      "UI / UX Design",
      "Webflow Development",
      "E-commerce Builds",
      "Landing Pages",
      "Design Systems",
      "Motion & Interaction",
    ],
  },
  {
    index: "02",
    tag: "AI",
    name: "AI Automation",
    blurb: "Custom agents and pipelines that compress hours into minutes.",
    items: [
      "Custom AI Agents",
      "Workflow Automation",
      "Chatbots & Assistants",
      "Data Pipelines",
      "LLM Integrations",
      "Process Audits",
    ],
  },
  {
    index: "03",
    tag: "SEO",
    name: "Search Growth",
    blurb: "Technical, content, and link strategies that move rankings.",
    items: [
      "Technical SEO",
      "Content Strategy",
      "Link Building",
      "Local SEO",
      "Analytics & Reporting",
      "Keyword Research",
    ],
  },
  {
    index: "04",
    tag: "BRAND",
    name: "Brand Systems",
    blurb: "Identities and visual languages that scale everywhere.",
    items: [
      "Logo & Identity",
      "Brand Guidelines",
      "Visual Language",
      "Naming & Messaging",
      "Social Templates",
      "Brand Strategy",
    ],
  },
];

/**
 * Services Section v3.
 * All service names ride a single scrolling WebGL "text tunnel" strip: each
 * name descends distorted from the top, straightens out at the centre, then
 * warps away below while the next one is already arriving — a continuous
 * loop that automatically includes any names added to SERVICES. The meta
 * layer (tag + name + description) crossfades in lock-step with whichever
 * name is centred, and hovering the tunnel freezes the scroll so it can be
 * read. On touch / reduced-motion it falls back to a static list.
 */
export default function ServicesSectionV3() {
  const sectionRef = useRef<HTMLElement>(null);
  // The tunnel's WebGL: built at load, released on a phone once the reader
  // is far away and rebuilt on approach (useSceneLease — memory).
  const tunnelLeased = useSceneLease(sectionRef, { initial: true });
  const stageRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const { isTouch, prefersReducedMotion } = useDeviceDetect();
  // Tunnel runs on every device; only reduced-motion falls back to the list.
  const enableEffects = !prefersReducedMotion;

  // Tunnel type scales with the viewport so names fit the room at every width.
  const [tunnel, setTunnel] = useState({ fontSize: 84, gap: 224 });
  // Back-wall inset, in viewBox percent (the room SVG is 0 0 100 100 with
  // preserveAspectRatio="none", so these are percentages of the frame box).
  // Desktop keeps the original 22% square room. A phone viewport is portrait,
  // so the same 22% leaves a 56%-wide slot only ~218px across — narrower than
  // the tunnel names, which then straddle the wall's vertical edges and read
  // as if the animation and the frame belong to different layouts. Widening
  // and flattening the wall there lands the centred name inside it.
  const [room, setRoom] = useState({ x: 22, y: 22 });
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const fontSize = Math.round(Math.max(38, Math.min(84, vw * 0.075)));
      // Gap comes from viewport HEIGHT, not font size, so the number of bands
      // in view (~4.3, matching desktop) stays constant on every screen. Tying
      // it to the font packed ~7 bands onto a phone, so two names read at once.
      const targetBand = window.innerHeight / 4.3;
      const gap = Math.max(
        Math.round(fontSize * 0.8),
        Math.round(targetBand - fontSize * 1.15),
      );
      setTunnel({ fontSize, gap });
      setRoom(
        vw <= 600
          ? { x: 7, y: 28 }
          : vw <= 980
            ? { x: 14, y: 25 }
            : { x: 22, y: 22 },
      );
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // The tunnel bakes its text into a 2D-canvas texture, so it needs a real
  // font-family STRING — it can't use `var(--font-display)`. Two things follow:
  // the family name is generated by next/font (a hashed `__facade_…`), so it
  // has to be read back off the CSS variable at runtime; and canvas silently
  // rasterises a fallback if the face isn't loaded yet, so the swap waits for
  // document.fonts before rebuilding the strip.
  const [tunnelFont, setTunnelFont] = useState(
    "Georgia, 'Times New Roman', serif",
  );
  useEffect(() => {
    const family = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-facade")
      .trim();
    if (!family) return;
    let cancelled = false;
    const apply = () => {
      if (!cancelled) setTunnelFont(family);
    };
    try {
      // Resolves (or rejects) once the face is ready either way — apply on both
      // so a rejection can't leave the tunnel stuck on the serif fallback.
      document.fonts.load(`400 84px ${family}`).then(apply, apply);
    } catch {
      document.fonts.ready.then(apply);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Which service is currently readable at the tunnel's centre — reported by
  // the tunnel itself (all names live on its scrolling strip and loop in
  // sequence); drives the meta layer crossfade.
  const [activeIdx, setActiveIdx] = useState(0);

  // ── Expanded detailed-services view (cross-slide to a detail screen) ──
  const [expanded, setExpanded] = useState(false);
  // The clipping viewport for the columns row.
  const colsRef = useRef<HTMLDivElement>(null);
  // The row itself. The pan translates THIS — a composited transform, rather
  // than a per-frame scrollLeft write which is integer-snapped and forces a
  // scroll + paint straight after a layout read.
  const trackRef = useRef<HTMLDivElement>(null);
  // Progress rail. Written to directly from the rAF loop: routing pan progress
  // through React state would re-render the whole section every frame.
  const railRef = useRef<HTMLDivElement>(null);
  const railFillRef = useRef<HTMLSpanElement>(null);

  const {
    scrollTo: locoScrollTo,
    isReady: locoReady,
    update: locoUpdate,
  } = useLocomotiveScroll();

  // Open the detail view. Smooth-scroll the section flush with the viewport
  // first so the lock that follows engages on an already-aligned section.
  const ALIGN_S = 0.6;
  const openExpanded = useCallback(() => {
    const el = sectionRef.current;
    // Besides aligning, this cancels any residual Lenis momentum that would
    // otherwise still be drifting when the lock takes hold. Lenis is skipped on
    // touch (locoScrollTo is a no-op there even though locoReady is true), so
    // use native smooth scroll on touch.
    if (!isTouch && locoReady) {
      locoScrollTo("#services", { duration: ALIGN_S });
    } else {
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Open once the alignment scroll has settled.
    window.setTimeout(() => setExpanded(true), ALIGN_S * 1000 + 100);
  }, [isTouch, locoReady, locoScrollTo]);

  // Ways out of the lock other than the Back button: Escape, and anything that
  // asks the page to scroll somewhere else (the nav menu's section links). The
  // latter matters because the lock outlives this component's own UI — without
  // it, picking "Work" from the menu would leave the reader frozen on Services
  // with the destination unreachable.
  const pendingNavRef = useRef<string | number | null>(null);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const onScrollTo = (e: Event) => {
      // Swallow the request and replay it once the lock is off. Letting it
      // through as-is would have the provider scroll a still-frozen document,
      // and the release below would then snap the reader back here anyway.
      const t = (e as CustomEvent<{ target?: string | number }>).detail?.target;
      pendingNavRef.current = t ?? null;
      setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("app:scroll-to", onScrollTo);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("app:scroll-to", onScrollTo);
    };
  }, [expanded]);

  // …and replay it. React runs every cleanup before any effect of the same
  // commit, so the lock is already released by the time this fires; the frame
  // of delay just lets Lenis settle after start().
  useEffect(() => {
    if (expanded || pendingNavRef.current == null) return;
    const target = pendingNavRef.current;
    pendingNavRef.current = null;
    const t = window.setTimeout(
      () =>
        window.dispatchEvent(
          new CustomEvent("app:scroll-to", { detail: { target } }),
        ),
      80,
    );
    return () => window.clearTimeout(t);
  }, [expanded]);

  // ── The expanded view is a real scroll LOCK ──────────────────────────
  // While the detail is open the page itself does not move at all: Lenis is
  // stopped, the document is frozen, and every scroll gesture — wheel, trackpad,
  // finger drag, arrow keys — is re-aimed at the horizontal column pan instead.
  // Running out of columns does NOT release the page. "Back" (or Escape) is the
  // only way out, which is the point: the detail is a destination, not a screen
  // you fall through on the way to the gallery.
  //
  // This replaces the previous approach, where the section grew extra scroll
  // height and mapped page-scroll progress onto the pan. That read well on
  // paper but it is precisely what let a reader carry straight on into the next
  // section, and it needed the section's height — and therefore every
  // ScrollTrigger position on the page — to be recomputed on open, on close and
  // on every resize. With the page frozen, the section's height never changes,
  // so none of that machinery is needed.
  //
  // One mechanism on every device, too. The old pointer/touch split existed
  // only because the pan rode the page scroll and a phone has no wheel; with
  // nothing to ride, both inputs drive the same offset and mobile finally
  // behaves like desktop.
  useEffect(() => {
    if (!expanded) return;
    const section = sectionRef.current;
    const cols = colsRef.current;
    const track = trackRef.current;
    const rail = railRef.current;
    const railFill = railFillRef.current;
    if (!section || !cols || !track) return;

    // ── 1. Freeze the page ──
    // Stop Lenis FIRST, then correct the alignment: the opening scroll is
    // smooth and may still be a pixel or two out when this runs, and snapping
    // while Lenis is live would just be animated away.
    window.dispatchEvent(new Event("app:scroll-lock")); // lenis.stop()
    const drift = section.getBoundingClientRect().top;
    if (Math.abs(drift) > 1) window.scrollTo(0, window.scrollY + drift);
    const lockY = window.scrollY;

    const html = document.documentElement;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    // There is no Lenis on touch (the provider skips it for coarse pointers),
    // so overflow alone leaves native scrolling live — the body has to be
    // pinned. Held at -lockY so the section stays exactly where it is.
    if (isTouch) {
      const b = document.body;
      b.style.position = "fixed";
      b.style.top = `-${lockY}px`;
      b.style.left = "0";
      b.style.right = "0";
      b.style.width = "100%";
    }

    // ── 2. Pan state ──
    let max = 0;
    let target = 0;
    let current = 0;
    let dragging = false;
    let axis: "x" | "y" | null = null;
    const touchOrigin = { x: 0, y: 0 };
    let startPos = 0;
    let startTarget = 0;
    let lastDelta = 0;
    let lastMoveAt = 0;
    let velocity = 0; // px per ms

    const clamp = (v: number) => Math.min(Math.max(v, 0), max);

    // How far the row overflows its viewport. Measured off LAYOUT boxes
    // (offsetWidth / clientWidth), never scrollWidth: the track carries a
    // translate, and a transformed child contributes to a container's
    // scrollable overflow, so scrollWidth would grow as the pan advanced.
    const measure = () => {
      const cs = getComputedStyle(cols);
      const inner =
        cols.clientWidth -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight);
      max = Math.max(0, track.offsetWidth - inner);
      target = clamp(target);
      if (rail) rail.style.opacity = max > 0 ? "1" : "0";
    };
    measure();
    // Again once the 0.6s slide-in has settled — during the transition the
    // detail is still being laid out and the columns can measure short.
    const tMeasure = window.setTimeout(measure, 700);

    // ── 3. Frame loop: `current` chases `target` ──
    let raf = 0;
    let lastT = performance.now();
    let painted = -1;
    const frame = (now: number) => {
      const dt = Math.min(now - lastT, 50);
      lastT = now;
      // A finger drag follows 1:1 — smoothing a direct manipulation reads as
      // lag. Everything else eases, so the wheel feels like the Lenis-smoothed
      // scrolling on the rest of the site rather than a jump cut. The factor is
      // frame-rate corrected: a fixed per-frame value pans roughly twice as
      // fast on a 120Hz screen as on a 60Hz one.
      const k = dragging ? 1 : 1 - Math.pow(1 - 0.16, dt / 16.667);
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.05) current = target;
      if (Math.abs(current - painted) > 0.01) {
        painted = current;
        track.style.transform = `translate3d(${-current}px, 0, 0)`;
        if (railFill)
          railFill.style.transform = `scaleX(${max > 0 ? current / max : 0})`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // ── 4. Inputs ──
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom — leave it to the browser
      e.preventDefault();
      // Trackpads report both axes; take whichever the gesture actually moved.
      const raw =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      // deltaMode 1 = lines, 2 = pages. Chrome always sends pixels, Firefox
      // sends lines — unconverted, Firefox would pan ~3px per notch.
      const scale =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? cols.clientWidth : 1;
      target = clamp(target + raw * scale);
    };

    const onTouchStart = (e: TouchEvent) => {
      const t0 = e.touches[0];
      if (!t0) return;
      dragging = true;
      axis = null;
      startPos = 0;
      startTarget = target;
      lastDelta = 0;
      lastMoveAt = performance.now();
      velocity = 0;
      touchOrigin.x = t0.clientX;
      touchOrigin.y = t0.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const t0 = e.touches[0];
      if (!t0) return;
      const dx = touchOrigin.x - t0.clientX;
      const dy = touchOrigin.y - t0.clientY;
      // Lock the axis on the first decisive movement, the way the browser picks
      // a scroll axis. Summing both axes instead would count a diagonal drag
      // twice and run the pan away from the finger.
      if (!axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        startPos = axis === "x" ? dx : dy;
      }
      e.preventDefault();
      const delta = (axis === "x" ? dx : dy) - startPos;
      target = clamp(startTarget + delta);
      const now = performance.now();
      const dt = now - lastMoveAt;
      if (dt > 0) velocity = (delta - lastDelta) / dt;
      lastDelta = delta;
      lastMoveAt = now;
    };

    const onTouchEnd = () => {
      if (!dragging) return;
      dragging = false;
      axis = null;
      // Hand what is left of the flick to the easing as extra distance, so a
      // quick swipe glides on instead of stopping dead under the finger.
      if (Math.abs(velocity) > 0.05) target = clamp(target + velocity * 260);
      velocity = 0;
    };

    const onKey = (e: KeyboardEvent) => {
      const page = cols.clientWidth * 0.75;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          target = clamp(target + 140);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          target = clamp(target - 140);
          break;
        case "PageDown":
        case " ":
          target = clamp(target + page);
          break;
        case "PageUp":
          target = clamp(target - page);
          break;
        case "Home":
          target = 0;
          break;
        case "End":
          target = max;
          break;
        default:
          return;
      }
      e.preventDefault();
    };

    // Non-passive: these listeners exist to preventDefault. On the section
    // rather than the window because the section covers the whole viewport
    // while locked, and a gesture over the fixed navbar should stay the
    // navbar's business.
    const opts = { passive: false } as const;
    section.addEventListener("wheel", onWheel, opts);
    section.addEventListener("touchstart", onTouchStart, opts);
    section.addEventListener("touchmove", onTouchMove, opts);
    section.addEventListener("touchend", onTouchEnd);
    section.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("keydown", onKey);

    // Width is the only thing that changes the overflow. Height-only resizes
    // are the mobile URL bar sliding in and out, and re-measuring on those
    // visibly jumped the pan.
    let lastW = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      measure();
    };
    window.addEventListener("resize", onResize);

    // ── 5. Release ──
    return () => {
      window.clearTimeout(tMeasure);
      cancelAnimationFrame(raf);
      section.removeEventListener("wheel", onWheel);
      section.removeEventListener("touchstart", onTouchStart);
      section.removeEventListener("touchmove", onTouchMove);
      section.removeEventListener("touchend", onTouchEnd);
      section.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      track.style.transform = "";
      if (railFill) railFill.style.transform = "scaleX(0)";

      const b = document.body;
      b.style.position = "";
      b.style.top = "";
      b.style.left = "";
      b.style.right = "";
      b.style.width = "";
      b.style.overflow = "";
      html.style.overflow = "";
      // Unpinning the body drops the scroll to 0 — put it back BEFORE Lenis
      // resumes, or Lenis animates the whole page from the top.
      window.scrollTo(0, lockY);
      window.dispatchEvent(new Event("app:scroll-unlock")); // lenis.start()
      locoUpdate(); // re-measure against the unfrozen document
    };
  }, [expanded, isTouch, locoUpdate]);

  return (
    <section ref={sectionRef} id="services" className="svv3">
      <div ref={stageRef} className="svv3__stage">
        <div ref={pinRef} className="svv3__pin">
          <div className="svv3__slider" data-expanded={expanded}>
            {/* ── Screen 1: the 3D room ── */}
            <div className="svv3__screen svv3__screen--room">
          {/* ── 3D ROOM frame ── */}
          <svg
            className="svv3__room"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <rect
              x={room.x}
              y={room.y}
              width={100 - room.x * 2}
              height={100 - room.y * 2}
            />
            <line x1="0" y1="0" x2={room.x} y2={room.y} />
            <line x1="100" y1="0" x2={100 - room.x} y2={room.y} />
            <line x1="0" y1="100" x2={room.x} y2={100 - room.y} />
            <line x1="100" y1="100" x2={100 - room.x} y2={100 - room.y} />
          </svg>

          {/* ── Meta layer: tag (name) top-left, name/desc bottom-left ── */}
          <div className="svv3__meta">
            {SERVICES.map((s, i) => (
              <div
                key={s.index}
                className="svv3__meta-slide"
                style={
                  enableEffects
                    ? {
                        opacity: i === activeIdx ? 1 : 0,
                        // Scaled with the tunnel's band rate. At 0.7s against
                        // the faster 1.4s dwell the meta would be mid-crossfade
                        // for half its life, so consecutive services would
                        // never fully resolve; 0.45s keeps the old fade-to-hold
                        // ratio. Retune this if animationSpeed changes again.
                        transition: "opacity 0.45s ease",
                      }
                    : undefined
                }
              >
                {/* Top row: index number left (nudged right so it clears the
                    fixed navbar toggle), bracketed tag right. */}
                <div className="svv3__meta-top">
                  <span className="svv3__meta-index">
                    {s.index.replace("_", "")}
                  </span>
                  <h2 className="svv3__meta-tag">
                    <span className="svv3__bracket">(</span>
                    <span className="svv3__meta-tag-text">{s.tag}</span>
                    <span className="svv3__bracket">)</span>
                  </h2>
                </div>
                <div className="svv3__meta-foot">
                  <h3 className="svv3__meta-name">{s.name}</h3>
                  <p className="svv3__meta-desc">{s.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Expand → detailed services (right edge) ── */}
          {/* The button is only the hit area — it keeps the resting pill's
              footprint while the GLASS inside it morphs on hover (see the
              CSS). If the glass were the button, it would shrink out from
              under the pointer, lose the hover, grow back, and flicker. */}
          <button
            type="button"
            className="svv3__expand-btn"
            onClick={openExpanded}
            aria-haspopup="dialog"
            aria-expanded={expanded}
            /* On the phone layout (the 600px rule in the CSS) this button
               moves to the bottom-right — the corner dock's spot — and the
               two collided; the client: "we should not show the + before
               the services section". So here it is a rival of the dock, as
               the hero's and footer's CTAs are, but only under that same
               breakpoint: on wider screens it sits mid-right and the dock
               keeps its corner. See CornerGlassDock's rivals. */
            data-corner-dock-avoid="(max-width: 600px)"
          >
            <span className="svv3__expand-glass liquid-glass">
              <ChromaticMetal />
              <span className="svv3__expand-label">Expand</span>
              <span className="svv3__expand-arrow" aria-hidden>
                →
              </span>
            </span>
          </button>

          {/* ── Centre service names ──
              Desktop: all names ride the tunnel strip in sequence — while one
              is readable at the centre the next is already descending
              distorted from the top. onBandChange keeps the meta layer synced
              to the centred name. (Hover-pause is currently disabled; pass
              `paused` to WebGLTextTunnel to re-enable it.)
              Touch / reduced-motion: a plain static list (see mobile CSS). */}
          {enableEffects ? (
            <div className="svv3__tunnel">
              {/* Tuned to the reference screenshot: serif type, warp starting
                  close to the centre (low falloff), rows fanning into curved
                  streaks at the edges (high stretchX), squashed to filaments
                  (high stretchY), strong glow, rainbow fringes at the pinches. */}
              {tunnelLeased && (
              <WebGLTextTunnel
                texts={SERVICES.map((s) => s.name)}
                onBandChange={setActiveIdx}
                /* The room fades to opacity 0 behind the detail screen — no
                   reason to keep burning a full-viewport WebGL draw per frame
                   underneath the pan. */
                suspended={expanded}
                font={tunnelFont}
                fontWeight={400}
                fontSize={tunnel.fontSize}
                lineHeight={1.15}
                textColor="#FFFFFF"
                background="transparent"
                gap={tunnel.gap}
                /* Percent of one band per second: 70 puts a service name at
                   the centre roughly every 1.4s, against 2.2s at the previous
                   45. The meta crossfade below is tied to this — it is sized as
                   a fraction of the dwell, so the two move together. */
                animationSpeed={70}
                stretchX={60}
                stretchY={85}
                falloff={15}
                bloom={55}
                chromatic={65}
                width="100%"
                height="100%"
              />
              )}
            </div>
          ) : (
            <div className="svv3__track">
              {SERVICES.map((s) => (
                <div key={s.index} className="svv3__card">
                  <span className="svv3__card-text">{s.name}</span>
                </div>
              ))}
            </div>
          )}
            </div>

            {/* ── Screen 2: detailed services (minimal columns) ── */}
            <div
              className="svv3__screen svv3__screen--detail"
              aria-hidden={!expanded}
              role="dialog"
              aria-modal={expanded}
              aria-label="Detailed services"
            >
              <button
                type="button"
                className="svv3__back"
                onClick={() => setExpanded(false)}
              >
                <span aria-hidden>←</span> Back
              </button>
              <div className="svv3__cols" ref={colsRef}>
                <div className="svv3__cols-track" ref={trackRef}>
                  {SERVICE_DETAILS.map((g) => (
                    <div className="svv3__col" key={g.index}>
                      {/* Services up top, category name below — number removed. */}
                      <ul className="svv3__col-list">
                        {g.items.map((it) => (
                          <li key={it}>{it}</li>
                        ))}
                      </ul>
                      <span className="svv3__col-cat">{g.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* The page is frozen while this is open, so the way out has to be
                  stated rather than discovered — and the rail is the only thing
                  telling a reader how much of the row is left, now that there is
                  no page scrollbar moving. */}
              <div className="svv3__foot">
                <div className="svv3__rail" ref={railRef} aria-hidden>
                  <span className="svv3__rail-fill" ref={railFillRef} />
                </div>
                <p className="svv3__hint">
                  Scroll to explore
                  <span className="svv3__hint-sep" aria-hidden>
                    ·
                  </span>
                  Back to exit
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
