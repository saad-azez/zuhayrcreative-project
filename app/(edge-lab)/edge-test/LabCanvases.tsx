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
