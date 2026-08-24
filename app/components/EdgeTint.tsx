"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps iOS Safari's edge bars the same colour as the scene behind them.
 *
 * THE BUG, finally seen rather than inferred (client screenshots, 2026-08-24):
 * Safari paints an opaque band behind the status bar and another behind the
 * toolbar, and tints them from the page. On this site those bands came out
 * near-BLACK while the page under them was a light mauve, so they read as two
 * hard-edged bars framing the site. On zuhayrcreative.org the same bands are
 * dark maroon — the exact colour of its page — so they vanish into it. The
 * reference site is not doing anything clever: its page really is that colour
 * at the edges, so whatever Safari samples, it matches.
 *
 * Ours could not match, for two compounding reasons:
 *
 *   1. `body`'s background-color — which iOS 26 samples for this — is
 *      --page-edge, #1a070d. That is very nearly black, and it was chosen to
 *      match the outermost stop of the base GRADIENT, not the live scene the
 *      WebGL canvas actually paints over it, which is far lighter.
 *   2. The canvas itself reads back pure black (the SDK builds its context
 *      with preserveDrawingBuffer off), so sampling it gave black too. That
 *      is patched at parse time in app/layout.tsx, which is what makes this
 *      component possible at all — before it, every readback here would have
 *      returned #000 and painted the bars black on purpose.
 *
 * So: sample the scene's real colour at the top and bottom edges a few times a
 * second and hand it to Safari three ways — two thin strips on the page's
 * outermost pixels (the stripes test, 25e9072, proved Safari samples those:
 * with colour bands there it painted its bars the exact same green), body's
 * background-color, and theme-color. Whichever of the three it consults, it
 * arrives at the colour actually on screen at that edge.
 *
 * Safety: if the readback comes back black or transparent — patch missing, GL
 * context lost, scene not up yet, ?nobg=1 — this does NOTHING and leaves the
 * static --page-edge in place. Painting a sampled black would be worse than
 * the bug.
 */

/** How often to re-sample. ~7Hz: invisible lag, negligible cost. */
const SAMPLE_MS = 150;
/** Strip height. Enough for Safari's sampler, small enough to hide under a
 *  colour it matches by construction. */
const STRIP_PX = 6;
/** Ignore samples this dark — they mean an unreadable buffer, not a dark
 *  scene. The scene's own darkest edge tone is well above this. */
const BLACK_FLOOR = 12;

type RGB = [number, number, number];

function readEdges(canvas: HTMLCanvasElement): { top: RGB; bottom: RGB } | null {
  const gl = (canvas.getContext("webgl2") ??
    canvas.getContext("webgl")) as WebGLRenderingContext | null;
  if (!gl || gl.isContextLost()) return null;

  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  if (!w || !h) return null;

  const px = new Uint8Array(4);
  // Average across the width so one bright pixel cannot swing the tint.
  const sampleRow = (y: number): RGB | null => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const fx of [0.25, 0.5, 0.75]) {
      const x = Math.min(w - 1, Math.max(0, Math.round(w * fx)));
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      // alpha 0 = nothing was preserved; the buffer is not readable.
      if (px[3] === 0) return null;
      r += px[0];
      g += px[1];
      b += px[2];
      n++;
    }
    const out: RGB = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    return out[0] + out[1] + out[2] < BLACK_FLOOR * 3 ? null : out;
  };

  // WebGL's origin is bottom-left: the last row is the top of the screen.
  const top = sampleRow(h - 2);
  const bottom = sampleRow(1);
  return top && bottom ? { top, bottom } : null;
}

const css = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const hex = (c: RGB) =>
  "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

export default function EdgeTint() {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Restore whatever the stylesheet says when this unmounts or goes quiet,
    // so a failed sample never leaves a stale colour painted on <body>.
    const originalBodyBg = document.body.style.backgroundColor;
    const themeMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const originalTheme = themeMeta?.content ?? null;

    const tick = () => {
      if (document.hidden) return;
      const canvas = document.querySelector<HTMLCanvasElement>(
        "[data-unicorn-bg] canvas",
      );
      // No scene (still loading, ?nobg=1, or a route without one) — leave the
      // stylesheet's own colour alone.
      if (!canvas) return;
      const edges = readEdges(canvas);
      if (!edges) return;

      if (topRef.current) topRef.current.style.backgroundColor = css(edges.top);
      if (bottomRef.current)
        bottomRef.current.style.backgroundColor = css(edges.bottom);
      // iOS 26 reads body's background-color for the bands; it takes one
      // colour, so give it the top edge — the status bar is the band that
      // sits against the brightest part of the scene.
      document.body.style.backgroundColor = css(edges.top);
      if (themeMeta) themeMeta.content = hex(edges.top);
    };

    // First pass once the SDK has had time to put a frame up; the interval
    // then keeps it matched as the scene animates and as sections change.
    const timer = window.setInterval(tick, SAMPLE_MS);
    tick();

    return () => {
      window.clearInterval(timer);
      document.body.style.backgroundColor = originalBodyBg;
      if (themeMeta && originalTheme !== null) themeMeta.content = originalTheme;
    };
  }, []);

  const strip: React.CSSProperties = {
    position: "fixed",
    left: 0,
    right: 0,
    height: STRIP_PX,
    // Above the scene (z -10) but below every piece of content, so this can
    // never cover UI. In these few pixels there is nothing else painted, so
    // the strip is what Safari's sampler sees.
    zIndex: -9,
    pointerEvents: "none",
    // Glide between colours instead of stepping, so Safari's tint eases too.
    transition: "background-color 200ms linear",
  };

  return (
    <>
      <div ref={topRef} aria-hidden data-edge-tint="top" style={{ ...strip, top: 0 }} />
      <div
        ref={bottomRef}
        aria-hidden
        data-edge-tint="bottom"
        style={{ ...strip, bottom: 0 }}
      />
    </>
  );
}
