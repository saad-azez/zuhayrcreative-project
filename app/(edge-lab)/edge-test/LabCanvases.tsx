"use client";

import { useEffect, useRef } from "react";
import UnicornScene from "unicornstudio-react";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";

/**
 * Round-3 probes. Round 2 convicted ?cv (the real Unicorn background): the
 * same page that renders edge-to-edge bare gets black bars with the scene
 * mounted (device recordings, 2026-08-23 04:49). The SDK's listeners are all
 * passive, so the two remaining theories are:
 *
 *  A. Any full-screen fixed WebGL canvas touching the screen edges makes
 *     Safari box the page in (it cannot continue an unreadable layer behind
 *     its chrome, so it refuses to extend the page at all).
 *  B. Something Unicorn-specific beyond the canvas.
 *
 * RawCanvas (?cvc) tests A with a dumb WebGL canvas — no SDK, just a clear
 * loop. InsetScene (?cvi) tests the FIX for A: the real Unicorn scene, but
 * its wrapper stops 24px short of the top and bottom edges, with a plain DOM
 * gradient behind it owning the outermost pixels.
 *
 *   cvc bars + cvi clean  → theory A confirmed AND the fix works: inset the
 *                           real site's scene the same way.
 *   cvc clean + cv bars   → theory B: hunt inside the SDK next.
 *
 * ROUND-3 OUTCOME (device, 2026-08-23): cvc clean, cvi clean, cv boxed —
 * read as theory A + fix proven. But the 24px inset applied to all five real
 * scenes did NOT cure the real site, which falsifies A outright: the insets
 * were applied in effects that run at hydration, BEFORE the SDK's canvas even
 * exists (it arrives ~1s later from the CDN), so no canvas ever touched the
 * screen edges post-fix — and Safari boxed the page anyway.
 *
 * ROUND 4 (2026-08-24). Whatever triggers the boxing is something the boxed
 * configurations (?cv, and the real site in every variant) share and the
 * clean ones (?cvc, ?cvi, ?fx, old site) lack. Two suspects survive that
 * sieve, both inside UnicornBackground and neither ever tested in isolation:
 *
 *  1. The imperative 100lvh height upgrade. lvh is the LARGE viewport — a
 *     fixed layer that size extends under Safari's collapsed-chrome zones
 *     even while the chrome is expanded. Every boxed variant had it (the
 *     failed inset fix kept `calc(100lvh - 48px)`, still past the small
 *     viewport); clean ?cvi never used lvh; clean ?fx used lvh but is
 *     readable DOM, not WebGL.
 *  2. The perf/guard props (scale, dpi, fps, paused, remount key). Every
 *     boxed variant had them; clean ?cvi rendered a bare UnicornScene.
 *
 * The probes are minimal pairs against the boxed ?cv control — the REAL
 * component with exactly one suspect switched off per URL (see page.tsx).
 * PlainFullBleedScene (?cvp) is the never-tested matrix cell: the real scene
 * full-bleed with NEITHER suspect — bare UnicornScene, dumb 100vh container.
 */

export function RawCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = Math.round(innerWidth * devicePixelRatio);
    canvas.height = Math.round(innerHeight * devicePixelRatio);
    const gl = canvas.getContext("webgl");
    if (!gl) return;
    let raf = 0;
    let t = 0;
    const draw = () => {
      t += 1 / 60;
      // A slow maroon pulse, so it is visibly a LIVE WebGL surface and cannot
      // be optimised away as a static layer.
      const p = 0.5 + 0.5 * Math.sin(t * 0.8);
      gl.clearColor(0.28 + 0.1 * p, 0.0, 0.08 + 0.04 * p, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: -10,
      }}
    />
  );
}

const EDGE_GAP = 24;

export function InsetScene() {
  return (
    <>
      {/* Readable DOM backdrop that owns the screen edges — same palette as
          the scene, so if this works on the real site the join is invisible. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -11,
          background:
            "radial-gradient(120% 120% at 50% 30%, #4a0f1d 0%, #2a0a12 50%, #1a070d 100%)",
        }}
      />
      {/* The real scene, stopping EDGE_GAP short of the top and bottom. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: EDGE_GAP,
          bottom: EDGE_GAP,
          left: 0,
          right: 0,
          zIndex: -10,
          overflow: "hidden",
        }}
      >
        <UnicornScene
          projectId="nHxm08nl2UefH5hUAMVJ"
          width="100%"
          height="100%"
          lazyLoad={false}
          sdkUrl={UNICORN_SDK_URL}
        />
      </div>
    </>
  );
}

/**
 * ?cvp — the matrix cell no round ever tested: the REAL Unicorn scene,
 * full-bleed to every screen edge, but with NEITHER round-4 suspect — a bare
 * UnicornScene (no perf/guard props) in a dumb fixed inset:0 container whose
 * height is the plain small-viewport 100% (no lvh anywhere).
 *
 *   clean → full-bleed SDK canvas per se is innocent; the trigger is one of
 *           the two suspects, and ?cv&nolvh / ?cv&noperf says which.
 *   boxed → the SDK's full-bleed canvas is convicted after all, and the cure
 *           is declarative geometry that stops short of the edges.
 */
export function PlainFullBleedScene() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -10,
        overflow: "hidden",
        background:
          "radial-gradient(120% 120% at 50% 30%, #4a0f1d 0%, #2a0a12 50%, #1a070d 100%)",
      }}
    >
      <UnicornScene
        projectId="nHxm08nl2UefH5hUAMVJ"
        width="100%"
        height="100%"
        lazyLoad={false}
        sdkUrl={UNICORN_SDK_URL}
      />
    </div>
  );
}
