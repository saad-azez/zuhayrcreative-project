"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import UnicornScene from "unicornstudio-react";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";

const IDLE_MS = 15_000;
const PREWARM_MS = 10_000; // mount scene 5 s before idle fires
const WARN_S = 5; // countdown length — notification appears this many s before idle

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
 * Full-screen idle overlay — appears after 15 s of user inactivity and
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
  const { isTouch } = useDeviceDetect();
  const dpi = isTouch ? 1 : 1.5;

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
      const hasCanvas = !!document.querySelector("[data-idle-scene] canvas");
      console.log(
        `[IdleScreen] Revealing overlay — canvas already present: ${hasCanvas}`,
      );
      document.body.classList.add("is-idle");
      requestAnimationFrame(() => setSceneVisible(true));
      document.body.style.overflow = "hidden";
      window.dispatchEvent(new Event("app:scroll-lock"));

      // Confirm mouse events reach window while idle overlay is visible.
      // If you never see this log while moving the mouse over the idle screen,
      // the Unicorn canvas is eating events and needs pointer-events: none.
      let logged = false;
      const onMove = (e: MouseEvent) => {
        if (!logged) {
          logged = true;
          const cursorEl = document.querySelector<HTMLElement>(".gallery-cursor");
          console.log(
            `[IdleScreen] First window.mousemove after idle at (${e.clientX}, ${e.clientY}) — cursor classes: "${cursorEl?.className}" — cursor zIndex: "${cursorEl?.style.zIndex || getComputedStyle(cursorEl!).zIndex}"`,
          );
        }
      };
      window.addEventListener("mousemove", onMove, { passive: true });
      return () => window.removeEventListener("mousemove", onMove);
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
      {/* iPhone-style heads-up notification — appears when 5 s remain on the
          idle countdown; any interaction dismisses it (the timers re-arm). */}
      {warnRemaining !== null && !idle && (
        <div className="idle-notice" role="status" aria-live="polite">
          <Image
            src="/AI-9.png"
            alt=""
            width={38}
            height={38}
            className="idle-notice-icon"
          />
          <div className="idle-notice-body">
            <span className="idle-notice-app">Zuhayr Creative</span>
            <span key={warnRemaining} className="idle-notice-text">
              {WARN_COPY[warnRemaining] ?? "…"}
            </span>
          </div>
          <span className="idle-notice-count" aria-hidden>
            {warnRemaining}
          </span>
          <style>{`
            .idle-notice {
              position: fixed;
              top: clamp(0.75rem, 2.5vh, 1.5rem);
              left: 50%;
              z-index: 9500;
              display: flex;
              align-items: center;
              gap: 0.8rem;
              width: min(92vw, 380px);
              padding: 0.7rem 1rem 0.7rem 0.8rem;
              border-radius: 18px;
              /* Same liquid-glass surface as the "Accepting new projects"
                 badges: white-tinted glass + inset highlight, 12px blur. */
              background: rgba(255, 255, 255, 0.07);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              border: 1px solid rgba(255, 255, 255, 0.14);
              box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.18),
                0 10px 30px rgba(0, 0, 0, 0.35);
              color: #fff;
              pointer-events: none;
              animation: idleNoticeIn 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
            }
            @keyframes idleNoticeIn {
              from { transform: translate(-50%, -140%); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
            .idle-notice-icon {
              border-radius: 9px;
              flex-shrink: 0;
            }
            .idle-notice-body {
              display: flex;
              flex-direction: column;
              gap: 0.15rem;
              min-width: 0;
              flex: 1 1 auto;
            }
            .idle-notice-app {
              font-family: var(--font-geist-mono), ui-monospace, monospace;
              font-size: 0.6rem;
              font-weight: 600;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              color: rgba(255, 255, 255, 0.55);
            }
            .idle-notice-text {
              font-family: var(--font-geist-sans), system-ui, sans-serif;
              font-size: 0.85rem;
              font-weight: 500;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              animation: idleTextSwap 0.3s ease both;
            }
            @keyframes idleTextSwap {
              from { transform: translateY(40%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            .idle-notice-count {
              font-family: var(--font-geist-mono), ui-monospace, monospace;
              font-size: 1.35rem;
              font-weight: 700;
              line-height: 1;
              color: #ff2a45;
              flex-shrink: 0;
              min-width: 1.2em;
              text-align: center;
              animation: idleCountPulse 1s ease-in-out infinite;
            }
            @keyframes idleCountPulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.18); opacity: 0.85; }
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
        // Clip to zero-height while pre-warming so it's invisible but the
        // WebGL context still has valid dimensions and initialises correctly.
        // z-index -9999 caused the browser to skip GPU compositing, leaving
        // plane.canvas null inside the Unicorn SDK.
        clipPath: idle ? "none" : "inset(0 0 100% 0)",
        opacity: sceneVisible ? 1 : 0,
        transition: sceneVisible ? "opacity 0.5s ease" : "none",
        pointerEvents: idle ? "auto" : "none",
      }}
    >
      {/* Scene is always mounted after pre-warm — already initialised when overlay appears */}
      <div
        data-idle-scene
        style={{ position: "absolute", inset: 0, overflow: "hidden" }}
      >
        <UnicornScene
          projectId="NAY1w0DGI03ZW0pL4E62"
          width="100%"
          height="100%"
          scale={1}
          dpi={dpi}
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
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: "clamp(0.65rem, 1vw, 0.8rem)",
              fontWeight: 500,
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
