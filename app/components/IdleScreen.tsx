"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { readHeroVariant } from "@/app/lib/heroVariant";
import UnicornScene from "./UnicornScene";
import { AnimatedCanvas } from "@/app/components/ui/animated-canvas";
import HourglassZ from "./HourglassZ";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";
import ChromaticMetal from "./ChromaticMetal";
import { useUnicornGuard, useUnicornPerf } from "@/app/lib/unicornPerf";

// 30s, per the client (19 Sep; was 20s).
const IDLE_MS = 30_000;
// Mount the scene 8 s before idle fires: 3 s before the countdown banner, not
// with it. At 25 s, the same moment as the banner, the scene's start-up was a
// 0.3 s freeze in the banner's first frames, over the lines building in.
const PREWARM_MS = 22_000;
// The model draft: 25 s (client, 24 Oct: the idle screen there is the
// atelier, worth showing a little sooner), the scene warming 8 s ahead as
// above.
const IDLE_MS_MODEL = 25_000;
const PREWARM_MS_MODEL = 17_000;
const WARN_S = 5; // countdown length — notification appears this many s before idle
/** How long after real input a scroll still counts as the visitor's (momentum). */
const SCROLL_GRACE_MS = 1500;

// Brand red for the side line-fields (the reference effect draws them in a
// single colour).
const BRUSH_LINE_COLOR = "#C4010D";
/** How long the side lines take to build in, as the reference's rules do (see AnimatedCanvas). */
const LINES_BUILD_MS = 350;

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
// In the model draft (?hero=model) the idle screen's show is the atelier
// window (AtelierWindow) instead of the Big Screen scene.
const noSubscribe = () => () => {};
const isModel = () => readHeroVariant() === "model";
const serverModel = () => false;

export default function IdleScreen() {
  const atelier = useSyncExternalStore(noSubscribe, isModel, serverModel);
  const [idle, setIdle] = useState(false);
  const [preWarm, setPreWarm] = useState(false);
  const [sceneVisible, setSceneVisible] = useState(false);
  // Countdown shown in the heads-up notification (5 → 1), null when hidden.
  const [warnRemaining, setWarnRemaining] = useState<number | null>(null);
  // The idle cycle only arms after real engagement — never on a fresh
  // load/reload where the visitor hasn't touched the page yet.
  const hasInteractedRef = useRef(false);
  // The last real input (see onActivity) and where the pointer last was.
  const lastInput = useRef(0);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  // Shared device-tiered render settings for the idle Unicorn scene.
  const perf = useUnicornPerf();
  // Every other Unicorn scene on the site is wrapped in this guard; the idle
  // scene was the only one without it, so a context eviction here left the
  // overlay permanently black with no way back. No pauseOffscreen: it is a
  // fixed full-viewport overlay, never "scrolled away".
  const sceneWrapRef = useRef<HTMLDivElement>(null);
  const { sceneKey } = useUnicornGuard(sceneWrapRef, false, "idle-screen");

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
      const idleMs = atelier ? IDLE_MS_MODEL : IDLE_MS;
      preWarmTimer = window.setTimeout(() => setPreWarm(true), atelier ? PREWARM_MS_MODEL : PREWARM_MS);
      warnTimer = window.setTimeout(() => {
        setWarnRemaining(WARN_S);
        tick = window.setInterval(() => {
          setWarnRemaining((s) => (s === null ? null : Math.max(1, s - 1)));
        }, 1000);
      }, idleMs - WARN_S * 1000);
      idleTimer = window.setTimeout(() => {
        clearAll();
        setIdle(true);
      }, idleMs);
    };

    const onActivity = (e: Event) => {
      // A mousemove with the pointer where it was is not the visitor: the
      // browser sends those itself when the page scrolls or shifts under a
      // still pointer, and each one restarted the 30 s — part of why the idle
      // screen "sometimes doesn't show up" (client, 8 Oct).
      if (e.type === "mousemove") {
        const m = e as MouseEvent;
        const last = lastPointer.current;
        if (last && last.x === m.clientX && last.y === m.clientY) return;
        lastPointer.current = { x: m.clientX, y: m.clientY };
      }
      // Scroll events also fire programmatically (Lenis smoothing, the
      // template's scroll-to-top on load, a section snapping itself into
      // place), so a scroll counts only on the heels of real input — the
      // smooth scroll's momentum after a wheel or a swipe — and never as the
      // first engagement that enables the cycle.
      if (e.type === "scroll") {
        if (performance.now() - lastInput.current > SCROLL_GRACE_MS) return;
      } else {
        hasInteractedRef.current = true;
        lastInput.current = performance.now();
      }
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
    // Not armed on a fresh load — the first interaction starts it. But once
    // the visitor has interacted it is armed straight away: this effect runs
    // again as the idle screen closes, and the Resume click that closed it
    // came BEFORE these listeners were back, so a visitor who resumed and
    // then sat still never got the idle screen again.
    if (hasInteractedRef.current) arm();

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach((e) =>
        window.removeEventListener(e, onActivity),
      );
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [idle, atelier]);

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

  // The atelier in its place (model draft): fetched ahead with the pre-warm,
  // opened when idle fires, and its Resume ends the idle.
  useEffect(() => {
    if (!atelier) return;
    if (preWarm) window.dispatchEvent(new Event("app:atelier-prewarm"));
  }, [atelier, preWarm]);
  useEffect(() => {
    if (!atelier || !idle) return;
    window.dispatchEvent(new CustomEvent("app:atelier-open", { detail: { from: "idle" } }));
    const done = () => setIdle(false);
    window.addEventListener("app:atelier-closed", done);
    return () => window.removeEventListener("app:atelier-closed", done);
  }, [atelier, idle]);

  // ── Resume ───────────────────────────────────────────────────────────
  const resume = () => {
    setIdle(false);
    // preWarm stays true: scene remains mounted so next idle is instant
  };

  return (
    <>
      {/* Countdown banner — when 5 s remain, a full-viewport strip appears at
          the top: animated line-sweep canvases on both sides, building in as
          the client's reference does its rules, and in the middle the Z logo
          as an hourglass (HourglassZ) beside the timer message. It took the
          place of a brand-red brush stroke (client, 19 Oct: "for the red paint
          where the text and timer is, let's change that to an outline of our
          logo and have the color fill inside be pixel looking that goes down
          indicating time running out"). Any interaction dismisses it. */}
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
              buildInMs={LINES_BUILD_MS}
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

          <div className="idle-brush-centre">
            {/* Mounted with the banner, so it runs the whole countdown. */}
            <HourglassZ durationMs={WARN_S * 1000} className="idle-brush-z" refined={atelier} />
            {/* The number beside the hourglass, then the line: both in
                places of their own, so nothing moves as the line changes.
                In the model draft the hourglass stands alone, centred in the
                row (client, 24 Oct: "get rid of the texts and countdown number
                and just have the Z sand timer"); the line is still read out. */}
            {atelier ? (
              <span key={warnRemaining} className="sr-only">
                {WARN_COPY[warnRemaining] ?? "…"}
              </span>
            ) : (
              <div className="idle-brush-msg">
                <span key={`n${warnRemaining}`} className="idle-brush-count-num" aria-hidden>
                  {warnRemaining}
                </span>
                <span key={warnRemaining} className="idle-brush-text">
                  {WARN_COPY[warnRemaining] ?? "…"}
                </span>
              </div>
            )}
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
              buildInMs={LINES_BUILD_MS}
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
            /* Side strips — the animated line sweeps flanking the centre out
               to both viewport edges. They build themselves in (buildInMs). */
            .idle-brush-side {
              flex: 1 1 0;
              min-width: 0;
              overflow: hidden;
            }
            .idle-brush-canvas {
              width: 100%;
              height: 100%;
            }
            /* The centre: the hourglass Z, then the message and the number.
               No plate behind them (the paint is gone), so a shadow keeps the
               white line and type off whatever the page has under them. */
            .idle-brush-centre {
              flex: 0 1 auto;
              min-width: 0;
              display: flex;
              align-items: center;
              gap: clamp(0.75rem, 1.6vw, 1.25rem);
              padding: 0 clamp(0.25rem, 1vw, 0.75rem);
              animation: idleCentreIn 0.3s ease both;
            }
            @keyframes idleCentreIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .idle-brush-z {
              display: block;
              height: 86%;
              /* The mark's own proportions (1818 x 1594). */
              aspect-ratio: 1818 / 1594;
              flex-shrink: 0;
              filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.55));
            }
            .idle-brush-msg {
              min-width: 0;
              display: flex;
              align-items: center;
              gap: 0.9rem;
            }
            /* As wide as the longest line ("Rolling out the big screen…",
               27 characters of a monospace face), whatever this second's is:
               sized to each line, the group re-centred every second and the
               Z jumped sideways with it. A width, not a flex-basis, which
               Chrome leaves out when it sizes the group around its contents;
               it still shrinks on a narrow screen. */
            .idle-brush-text {
              width: 27ch;
              flex: 0 1 auto;
              min-width: 0;
              font-family: var(--font-departure), ui-monospace, monospace;
              font-size: clamp(0.85rem, 1.6vw, 1.05rem);
              font-weight: 600;
              color: #fff;
              text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              animation: idleBrushSwap 0.3s ease both;
            }
            .idle-brush-count-num {
              flex-shrink: 0;
              /* One digit's place, whichever digit. */
              width: 1ch;
              text-align: center;
              font-family: var(--font-departure), ui-monospace, monospace;
              font-size: clamp(1rem, 1.9vw, 1.3rem);
              font-weight: 700;
              line-height: 1;
              color: #fff;
              text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
              animation: idleBrushSwap 0.3s ease both;
            }
            @keyframes idleBrushSwap {
              from { transform: translateY(45%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @media (prefers-reduced-motion: reduce) {
              .idle-brush-centre,
              .idle-brush-text,
              .idle-brush-count-num {
                animation: none;
              }
            }
          `}</style>
        </div>
      )}

      {/* Nothing else to render until the pre-warm window opens */}
      {preWarm && !atelier && (
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
        data-unicorn-scene="idle-screen"
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
          // Held still while hidden. The pre-warm mounts this scene after
          // 15s without a touch and keeps it for the rest of the visit, and
          // it was rendering every frame at opacity 0 — on a phone, where
          // pausing to read is normal, a second full-screen scene running
          // invisibly from the first pause on. The SDK still initialises
          // paused (that is what the pre-warm is for); it draws when shown.
          paused={!sceneVisible}
          lazyLoad={false}
          sdkUrl={UNICORN_SDK_URL}
        />
      </div>

      {/* RESUME — only in the DOM while the overlay is actually visible */}
      {idle && (
        <>
          <button
            onClick={resume}
            className="idle-resume-btn liquid-glass lg-drop lg-gulp"
            aria-label="Resume browsing"
            style={{
              position: "fixed",
              bottom: "clamp(1.5rem, 4vh, 3rem)",
              left: "50%",
              zIndex: 10000,
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
            }}
          >
            <ChromaticMetal />
            {/* Rolling text — identical to Let's Talk label roll. (Dot and
                arrow removed — the glass pill alone carries the button.) */}
            <span className="idle-resume-text-clip">
              <span className="idle-resume-text-default">Resume</span>
              <span className="idle-resume-text-hover" aria-hidden>Resume</span>
            </span>
          </button>

          <style>{`
            /* Skin (frost, border, sheen, grain, metal rim) comes from the
               shared .liquid-glass class; only the centring transform and the
               brand-red hover are this button's own. Being an unlayered
               <style>, these rules beat the skin's @layer components ones —
               which also pins the centring transform against the skin's
               :active scale. */
            .idle-resume-btn {
              /* translate, not transform: the pour it arrives with (lg-drop)
                 animates transform, and would otherwise throw the centring. */
              translate: -50% 0;
              transition: border-color 0.25s ease, background 0.25s ease, translate 0.25s ease;
            }
            .idle-resume-btn:hover {
              border-color: rgba(196, 1, 13, 0.6);
              background: rgba(196, 1, 13, 0.12);
              translate: calc(-50% + 4px) 0;
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
