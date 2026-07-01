"use client";

import { useEffect, useRef, useState } from "react";
import UnicornScene from "unicornstudio-react";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";

const IDLE_MS = 15_000;
const PREWARM_MS = 10_000; // mount scene 5 s before idle fires

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preWarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isTouch } = useDeviceDetect();
  const dpi = isTouch ? 1 : 1.5;

  // ── Idle detection + pre-warm ────────────────────────────────────────
  useEffect(() => {
    if (idle) return;

    const arm = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (preWarmTimerRef.current) clearTimeout(preWarmTimerRef.current);

      preWarmTimerRef.current = setTimeout(() => {
        console.log("[IdleScreen] Pre-warming scene (t=10s, fires 5s before idle)…");
        setPreWarm(true);
      }, PREWARM_MS);

      timerRef.current = setTimeout(() => {
        console.log("[IdleScreen] Idle triggered — overlay becoming visible");
        setIdle(true);
      }, IDLE_MS);
    };

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, arm, { passive: true }),
    );
    arm();

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, arm));
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
      setSceneVisible(false);
      document.body.style.overflow = "";
      window.dispatchEvent(new Event("app:scroll-unlock"));
    }
  }, [idle]);

  // ── Resume ───────────────────────────────────────────────────────────
  const resume = () => {
    console.log("[IdleScreen] Resume clicked — dismissing overlay");
    if (timerRef.current) clearTimeout(timerRef.current);
    setIdle(false);
    // preWarm stays true: scene remains mounted so next idle is instant
  };

  // Nothing to render until the pre-warm window opens
  if (!preWarm) return null;

  return (
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
            {/* Red dot */}
            <span
              aria-hidden
              style={{ position: "relative", display: "flex", width: 6, height: 6, flexShrink: 0 }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "#C4010D",
                  opacity: 0.75,
                  animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
                }}
              />
              <span
                style={{
                  position: "relative",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#C4010D",
                  display: "inline-flex",
                }}
              />
            </span>

            {/* Rolling text — identical to Let's Talk label roll */}
            <span className="idle-resume-text-clip">
              <span className="idle-resume-text-default">Resume</span>
              <span className="idle-resume-text-hover" aria-hidden>Resume</span>
            </span>

            <span className="idle-resume-arrow" aria-hidden>&rarr;</span>
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
            .idle-resume-arrow {
              display: inline-block;
              transition: transform 0.25s ease;
            }
            .idle-resume-btn:hover .idle-resume-arrow {
              transform: translateX(4px);
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
            @keyframes ping {
              75%, 100% { transform: scale(2.2); opacity: 0; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
