"use client";

import { useEffect, useRef, useState } from "react";
import UnicornScene from "unicornstudio-react";
import { Component as BrushLoader } from "@/app/components/ui/loader-brush";
import { AnimatedCanvas } from "@/app/components/ui/animated-canvas";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";
import { useUnicornGuard, useUnicornPerf } from "@/app/lib/unicornPerf";

const IDLE_MS = 20_000;
const PREWARM_MS = 15_000; // mount scene 5 s before idle fires
const WARN_S = 5; // countdown length — notification appears this many s before idle

// Brand red for the side line-fields (the reference effect draws them in a
// single colour).
const BRUSH_LINE_COLOR = "#C4010D";

// One line per remaining second — the notification "talks" the countdown down.
const WARN_COPY: Record<number, string> = {
  5: "You still there?",
  4: "Hello? Anyone home?",
  3: "Okay, getting comfy…",
  2: "Rolling out the big screen…",
  1: "Enjoy the show.",
};

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "wheel",
  "touchstart",
  "touchmove",
] as const;

/**
 * Full-screen idle overlay — appears after 20 s of user inactivity and
 * plays the "Big Screen" Unicorn Studio scene.
 *
 * The scene is pre-warmed at 10 s (5 s before idle) so the WebGL canvas
 * is already initialised by the time the overlay becomes visible. This
 * eliminates the black-screen-then-scene-pop that occurs when the canvas
 * is mounted at the same moment the overlay appears.
 *
 * After the first idle cycle the scene stays mounted (hidden, z-index
 * -9999) so every subsequent idle appearance is instant.
 */
export default function IdleScreen() {
  const [idle, setIdle] = useState(false);
  const [preWarm, setPreWarm] = useState(false);
  const [sceneVisible, setSceneVisible] = useState(false);
  // Countdown shown in the heads-up notification (5 → 1), null when hidden.
  const [warnRemaining, setWarnRemaining] = useState<number | null>(null);
  // The idle cycle only arms after real engagement — never on a fresh
  // load/reload where the visitor hasn't touched the page yet.
  const hasInteractedRef = useRef(false);
  // Shared device-tiered render settings for the idle Unicorn scene.
  const perf = useUnicornPerf();
  // Every other Unicorn scene on the site is wrapped in this guard; the idle
  // scene was the only one without it, so a context eviction here left the
  // overlay permanently black with no way back. No pauseOffscreen: it is a
  // fixed full-viewport overlay, never "scrolled away".
  const sceneWrapRef = useRef<HTMLDivElement>(null);
  const { sceneKey } = useUnicornGuard(sceneWrapRef);

  // ── Idle detection: pre-warm + countdown notification + trigger ──────
  useEffect(() => {
    if (idle) return;

    let preWarmTimer: number | undefined;
    let warnTimer: number | undefined;
    let idleTimer: number | undefined;
    let tick: number | undefined;

    const clearAll = () => {
      if (preWarmTimer) window.clearTimeout(preWarmTimer);
      if (warnTimer) window.clearTimeout(warnTimer);
      if (idleTimer) window.clearTimeout(idleTimer);
      if (tick) window.clearInterval(tick);
      preWarmTimer = warnTimer = idleTimer = tick = undefined;
      setWarnRemaining(null);
    };

    // Arm (or re-arm) the idle cycle. Runs only while the tab is visible and
    // after at least one real interaction, so a reload the visitor walks away
    // from — or a backgrounded tab — never shows the idle screen.
    const arm = () => {
      clearAll();
      if (document.hidden || !hasInteractedRef.current) return;
      preWarmTimer = window.setTimeout(() => setPreWarm(true), PREWARM_MS);
      warnTimer = window.setTimeout(() => {
        setWarnRemaining(WARN_S);
        tick = window.setInterval(() => {
          setWarnRemaining((s) => (s === null ? null : Math.max(1, s - 1)));
        }, 1000);
      }, IDLE_MS - WARN_S * 1000);
      idleTimer = window.setTimeout(() => {
        clearAll();
        setIdle(true);
      }, IDLE_MS);
    };

    const onActivity = (e: Event) => {
      // Scroll events also fire programmatically (Lenis smoothing, the
      // template's scroll-to-top on load), so scrolling may reset a running
      // countdown but doesn't count as the first engagement that enables it.
      if (e.type !== "scroll") hasInteractedRef.current = true;
      arm();
    };

    // No idle screen while the tab is hidden — drop any running countdown,
    // and start a fresh cycle when the visitor returns.
    const onVisibility = () => {
      if (document.hidden) clearAll();
      else arm();
    };

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );
    document.addEventListener("visibilitychange", onVisibility);
    // Deliberately NOT armed on mount — the first interaction starts it.

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach((e) =>
        window.removeEventListener(e, onActivity),
      );
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [idle]);

  // ── Show / hide overlay + scroll lock ───────────────────────────────
  useEffect(() => {
    if (idle) {
      document.body.classList.add("is-idle");
      requestAnimationFrame(() => setSceneVisible(true));
      document.body.style.overflow = "hidden";
      window.dispatchEvent(new Event("app:scroll-lock"));
    } else {
      document.body.classList.remove("is-idle");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the fade alongside the body-class/scroll side effects when idle ends
      setSceneVisible(false);
      document.body.style.overflow = "";
      window.dispatchEvent(new Event("app:scroll-unlock"));
    }
  }, [idle]);

  // ── Resume ───────────────────────────────────────────────────────────
  const resume = () => {
    setIdle(false);
    // preWarm stays true: scene remains mounted so next idle is instant
  };

  return (
    <>
      {/* Paintbrush countdown banner — when 5 s remain, a full-viewport strip
          appears at the top: animated line-sweep canvases on both sides, and
          in the middle a brand-red brush stroke that fades in left → right
          (soft feathered edge, like bristles dragging paint) carrying the
          timer message. Any interaction dismisses it. */}
      {warnRemaining !== null && !idle && (
        <div className="idle-brush" role="status" aria-live="polite">
          <div className="idle-brush-side" aria-hidden>
            {/* Reference line field — breathing brand-red lines sweeping toward
                the brush. Values are the design demo's (count 50, height 0.4,
                speed 0.00002, width 2), only the colour swapped for brand red.
                They had been retuned here to 26 / 0.5 / 0.00006 / 1.5, which is
                what made the field read denser, taller and three times faster
                than the design. */}
            <AnimatedCanvas
              count={50}
              lineColor={BRUSH_LINE_COLOR}
              heightMultiplier={0.4}
              speed={0.00002}
              lineWidth={2}
              className="idle-brush-canvas"
              // LEFT strip takes "right-to-left" — same as the demo's first
              // canvas. `t=0` maps to x=0 there, and t=0 is both the
              // full-height end of the line and (because t = time^5 crowds the
              // distribution toward 0) where the lines bunch up. So the field
              // reads dense and full height against the OUTER viewport edge,
              // thinning and shortening as it travels in toward the brush.
              // These two directions were swapped, which mirrored the whole
              // effect: lines massed at the centre and faded out to the edges.
              direction="right-to-left"
            />
          </div>

          <div className="idle-brush-wipe">
            {/* Original hand-drawn stroke shape: tapered left entry, ragged
                top/bottom edges, split bristle tips trailing off the right. */}
            <svg
              className="idle-brush-svg"
              viewBox="0 0 600 90"
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <linearGradient id="idle-brush-fill" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#5a0018" />
                  <stop offset="0.45" stopColor="#a3010f" />
                  <stop offset="0.8" stopColor="#c4010d" />
                  <stop offset="1" stopColor="#8f0212" />
                </linearGradient>
              </defs>
              <path
                fill="url(#idle-brush-fill)"
                d="M4 46 C26 28 60 18 110 16 C180 12 250 24 330 18 C410 12 480 22 545 20 C566 19 584 30 592 42 C596 48 592 56 580 60 C540 72 470 66 400 74 C330 82 250 70 180 78 C120 84 60 76 28 66 C12 60 2 54 4 46 Z"
              />
              {/* Bristle streaks at the entry and exit of the stroke. */}
              <path
                fill="url(#idle-brush-fill)"
                opacity="0.55"
                d="M548 26 C566 24 582 26 596 30 C584 32 566 32 550 30 Z M540 58 C558 60 576 58 590 54 C578 62 558 64 542 62 Z M10 34 C24 30 38 28 52 29 C38 33 24 35 12 38 Z"
              />
            </svg>

            <div className="idle-brush-msg">
              <span key={warnRemaining} className="idle-brush-text">
                {WARN_COPY[warnRemaining] ?? "…"}
              </span>
              <span className="idle-brush-count" aria-hidden>
                <BrushLoader className="idle-brush-loader" />
                <span key={warnRemaining} className="idle-brush-count-num">
                  {warnRemaining}
                </span>
              </span>
            </div>
          </div>

          <div className="idle-brush-side" aria-hidden>
            {/* Mirror of the left strip, sweeping toward the brush from the
                right viewport edge. */}
            <AnimatedCanvas
              count={50}
              lineColor={BRUSH_LINE_COLOR}
              heightMultiplier={0.4}
              speed={0.00002}
              lineWidth={2}
              className="idle-brush-canvas"
              // RIGHT strip mirrors it — the demo's second canvas.
              direction="left-to-right"
            />
          </div>

          <style>{`
            .idle-brush {
              position: fixed;
              top: clamp(0.5rem, 2vh, 1.25rem);
              left: 0;
              right: 0;
              z-index: 9500;
              height: clamp(56px, 9vh, 84px);
              display: flex;
              align-items: stretch;
              gap: clamp(0.5rem, 2vw, 1.5rem);
              pointer-events: none;
            }
            /* Side strips — the animated line sweeps flanking the brush out
               to both viewport edges. They fade in just after the stroke. */
            .idle-brush-side {
              flex: 1 1 0;
              min-width: 0;
              overflow: hidden;
              animation: idleSideFade 0.8s ease 0.3s both;
            }
            .idle-brush-canvas {
              width: 100%;
              height: 100%;
            }
            @keyframes idleSideFade {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            /* The brush pass: a soft-edged gradient mask (feathered over ~20%
               of its width) travels left → right, so the stroke and the text
               riding on it FADE in behind the moving edge — bristles dragging
               paint, not a hard curtain wipe. */
            .idle-brush-wipe {
              position: relative;
              flex: 0 0 min(70vw, 560px);
              -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 40%, transparent 60%);
              mask-image: linear-gradient(90deg, #000 0%, #000 40%, transparent 60%);
              -webkit-mask-size: 250% 100%;
              mask-size: 250% 100%;
              -webkit-mask-repeat: no-repeat;
              mask-repeat: no-repeat;
              animation: idleBrushWipe 0.9s cubic-bezier(0.65, 0, 0.35, 1) both;
            }
            @keyframes idleBrushWipe {
              from {
                -webkit-mask-position: 100% 0;
                mask-position: 100% 0;
              }
              to {
                -webkit-mask-position: 0% 0;
                mask-position: 0% 0;
              }
            }
            .idle-brush-svg {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
            }
            .idle-brush-msg {
              position: absolute;
              inset: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.9rem;
              padding: 0 3rem;
            }
            .idle-brush-text {
              font-family: var(--font-departure), ui-monospace, monospace;
              font-size: clamp(0.85rem, 1.6vw, 1.05rem);
              font-weight: 600;
              color: #fff;
              text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              animation: idleBrushSwap 0.3s ease both;
            }
            .idle-brush-count {
              position: relative;
              width: clamp(40px, 6vh, 52px);
              height: clamp(40px, 6vh, 52px);
              flex-shrink: 0;
              display: grid;
              place-items: center;
              /* The brush draws its ring in currentColor — white over the
                 red paint stroke. */
              color: #fff;
            }
            .idle-brush-loader {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
            }
            .idle-brush-count-num {
              font-family: var(--font-departure), ui-monospace, monospace;
              font-size: clamp(0.85rem, 1.5vw, 1.05rem);
              font-weight: 700;
              line-height: 1;
              color: #fff;
              text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
              animation: idleBrushSwap 0.3s ease both;
            }
            @keyframes idleBrushSwap {
              from { transform: translateY(45%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @media (prefers-reduced-motion: reduce) {
              .idle-brush-wipe,
              .idle-brush-side,
              .idle-brush-text,
              .idle-brush-count-num {
                animation: none;
              }
              /* Without the wipe animation the mask would park at its hidden
                 start position — clear it so the stroke is simply visible. */
              .idle-brush-wipe {
                -webkit-mask-image: none;
                mask-image: none;
              }
            }
          `}</style>
        </div>
      )}

      {/* Nothing else to render until the pre-warm window opens */}
      {preWarm && (
    <div
      aria-modal={idle ? "true" : undefined}
      role={idle ? "dialog" : undefined}
      aria-label={idle ? "Idle screen — click Resume to continue" : undefined}
      aria-hidden={idle ? undefined : true}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000",
        // Hidden during pre-warm by OPACITY ONLY, on a forced compositing
        // layer. It used to pre-warm under clipPath: inset(0 0 100% 0), which
        // keeps layout dimensions but clips the painted output to zero height —
        // so the compositor is free to skip rasterising the subtree, exactly
        // the failure the earlier z-index:-9999 attempt hit. When it does skip,
        // the Unicorn SDK initialises some planes with a null canvas ("Cannot
        // read properties of null (reading 'canvas')") and those layers — the
        // red lines and noise — never appear, while the ones that did get a
        // canvas (the floating logo) render fine. will-change + translateZ
        // pin a real backing store so every plane initialises against a
        // full-size composited surface.
        opacity: sceneVisible ? 1 : 0,
        willChange: "opacity",
        transform: "translateZ(0)",
        transition: sceneVisible ? "opacity 0.5s ease" : "none",
        pointerEvents: idle ? "auto" : "none",
      }}
    >
      {/* Scene is always mounted after pre-warm — already initialised when overlay appears */}
      <div
        ref={sceneWrapRef}
        data-idle-scene
        style={{ position: "absolute", inset: 0, overflow: "hidden" }}
      >
        <UnicornScene
          key={sceneKey}
          projectId="NAY1w0DGI03ZW0pL4E62"
          width="100%"
          height="100%"
          scale={perf.scale}
          dpi={perf.dpi}
          fps={perf.fps}
          lazyLoad={false}
          sdkUrl={UNICORN_SDK_URL}
        />
      </div>

      {/* RESUME — only in the DOM while the overlay is actually visible */}
      {idle && (
        <>
          <button
            onClick={resume}
            className="idle-resume-btn"
            aria-label="Resume browsing"
            style={{
              position: "fixed",
              bottom: "clamp(1.5rem, 4vh, 3rem)",
              left: "50%",
              zIndex: 10000,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              color: "#ffffff",
              // The site's pixel face, matching the countdown banner that
              // hands over to this screen — the two now read as one sequence
              // rather than the timer being pixel and the button that ends it
              // being Geist Mono. Departure ships a single weight and body
              // turns synthesis off, so no font-weight is declared: asking for
              // 500 here only looked like it did something.
              fontFamily: "var(--font-departure), ui-monospace, monospace",
              fontSize: "clamp(0.65rem, 1vw, 0.8rem)",
              letterSpacing: "0.3em",
              textTransform: "uppercase" as const,
              padding: "0.85rem 2.5rem",
              borderRadius: "10px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.75rem",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.12)",
            }}
          >
            {/* Rolling text — identical to Let's Talk label roll. (Dot and
                arrow removed — the glass pill alone carries the button.) */}
            <span className="idle-resume-text-clip">
              <span className="idle-resume-text-default">Resume</span>
              <span className="idle-resume-text-hover" aria-hidden>Resume</span>
            </span>
          </button>

          <style>{`
            .idle-resume-btn {
              border: 1px solid rgba(255, 255, 255, 0.18);
              background: rgba(255, 255, 255, 0.05);
              transform: translateX(-50%);
              transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease;
            }
            .idle-resume-btn:hover {
              border-color: rgba(196, 1, 13, 0.6);
              background: rgba(196, 1, 13, 0.12);
              transform: translateX(calc(-50% + 4px));
            }
            .idle-resume-text-clip {
              position: relative;
              display: inline-block;
              height: 1.1em;
              overflow: hidden;
              vertical-align: bottom;
            }
            .idle-resume-text-default,
            .idle-resume-text-hover {
              display: block;
              line-height: 1.1em;
              transition: transform 400ms ease-out;
            }
            .idle-resume-text-hover {
              position: absolute;
              inset: 0;
              transform: translateY(100%);
            }
            .idle-resume-btn:hover .idle-resume-text-default {
              transform: translateY(-100%);
            }
            .idle-resume-btn:hover .idle-resume-text-hover {
              transform: translateY(0);
            }
          `}</style>
        </>
      )}
    </div>
      )}
    </>
  );
}
