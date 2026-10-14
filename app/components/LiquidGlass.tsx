"use client";

import { useEffect, useRef } from "react";
import { hasGPU } from "@/app/lib/gpu";

// Plain WebGL, not three.js. This is one full-screen quad and one fragment
// shader; the renderer, scene, camera and mesh three wrapped around it were
// the only reason three.js — 180KB gzipped — sat in the first-load bundle of
// every route, since this panel lives in the navbar. The shader, the blend
// mode, the pixel ratio and the frame loop are exactly what they were.

interface LiquidGlassProps {
  /** Corner radius in CSS px — should match the container's border radius. */
  radius?: number;
  /** Glass tint (hex). Subtle; the backdrop-blur does the heavy lifting. */
  tint?: string;
  className?: string;
  /**
   * Externally drives the flame band's vertical position each frame.
   * `0` parks the band off the top edge, `1` off the bottom edge — at both
   * extremes the surface underneath is unobscured. When omitted the flame
   * free-runs its own up/down loop (legacy behaviour).
   */
  sweepRef?: { current: number };
  /**
   * Lays the glass pane's dark maroon under the flame, travelling with it.
   * The flame was made to be seen over that pane: its ramp runs from near
   * black to #C4010D, and it is the dark of the pane that makes the streaks
   * read as fire. On the bare toggle there is no pane, and over the page's
   * lighter grounds the same flame was a faint reddish smudge (client, 15
   * Oct: "the fire on the nav bar is not looking the same or as clear as
   * before"). Only where the flame band is, so between sweeps nothing of it
   * is left behind the icon.
   */
  backing?: boolean;
}

// A clip-space quad: with three's orthographic (-1..1) camera and a 2x2 plane
// the model-view-projection was the identity, so this is the same mapping.
const VERT = /* glsl */ `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform float iTime;
uniform vec2  iResolution; // drawing-buffer size (px)
uniform float uRadius;     // CSS px
uniform float uDpr;
uniform vec3  uTint;
uniform float uSweep;      // flame band centre driver: 0 = off top, 1 = off bottom
uniform float uBacking;    // 1: the pane's dark under the flame band (see the prop)

varying vec2 vUv;

// Signed distance to a rounded rectangle (negative inside).
float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),               hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Fractal Brownian motion — stacked noise octaves for fire turbulence.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 res     = iResolution;
  vec2 p       = (vUv - 0.5) * res;     // centred px coords
  vec2 halfRes = res * 0.5;
  float r      = uRadius * uDpr;

  float d = sdRoundRect(p, halfRes, r); // <0 inside

  // Anti-aliased shape mask. With the backing (the bare toggle) the pane's
  // edge is feathered over a few px instead: it only shows while the flame
  // passes, and a crisp edge coming and going would read as a box.
  float aa   = 1.5;
  float mask = uBacking > 0.5
    ? 1.0 - smoothstep(-6.0 * uDpr, 0.0, d)
    : 1.0 - smoothstep(-aa, aa, d);
  if (mask <= 0.0) discard;

  // ── Full-width flame band travelling up and down in waves ──────────
  // Centred coords: fx in [-0.5, 0.5], fy = 0 bottom → 1 top.
  vec2 f = vec2(vUv.x - 0.5, vUv.y);
  float t = iTime * 0.9;                  // flicker speed

  // Full-width fire turbulence (jets spread across the whole width).
  float n1 = fbm(vec2(f.x * 8.0,        f.y * 4.0 - t));
  float n2 = fbm(vec2(f.x * 16.0 + 4.0, f.y * 6.0 - t * 1.7));

  // The lit band's vertical centre is driven externally via uSweep: 0 sweeps
  // it off the top edge, 1 off the bottom edge. The range overshoots both ends
  // far enough that the band fully clears the button — no flame left covering
  // the logo / menu icon at the extremes, so the swap can happen behind it.
  float halfWin = 0.62;
  float center  = mix(1.7, -0.7, uSweep);

  // Wavy leading edges rolling across the full width.
  float wave = (fbm(vec2(f.x * 5.0, iTime * 0.5)) - 0.5) * 0.18
             + (n2 - 0.5) * 0.05;
  float fyT  = f.y - (n1 - 0.5) * 0.10 + wave;

  // Travelling vertical window of fire spanning the whole width.
  float vmask = smoothstep(center - halfWin, center - halfWin * 0.35, fyT)
              * (1.0 - smoothstep(center + halfWin * 0.35, center + halfWin, fyT));

  float flame = clamp(vmask * (0.55 + 0.8 * n1), 0.0, 1.0);
  flame = pow(flame, 1.2);

  // Deep maroon → #C4010D flame ramp. Blended with mix() (not additively) so
  // the hottest core lands exactly on #C4010D and never overshoots into pink.
  vec3 fcol = vec3(0.220, 0.000, 0.055);                                      // #38000E darkest base
  fcol = mix(fcol, vec3(0.502, 0.000, 0.125), smoothstep(0.20, 0.55, flame)); // #800020 maroon
  fcol = mix(fcol, vec3(0.769, 0.004, 0.051), smoothstep(0.50, 1.00, flame)); // #C4010D red core
  fcol *= flame;                                                              // fade to nothing at the edges

  // The flame only. This layer used to paint a glass shell of its own as
  // well — a deep-red refractive edge, a moving sheen, a top glaze and a
  // faint tinted body — over the pane's .liquid-glass, which is why the
  // toggle looked unlike every other glass button. The glass is WRAITH's
  // skin alone now (client, 4 Oct: "they should all come from this").
  float fa = clamp(flame * 0.8, 0.0, 1.0);

  // The pane under it, where the band is: its tint, deepened as the glass
  // deepened it, nearly opaque across the band and soft at its wavy edges.
  float ba = uBacking * 0.9 * smoothstep(0.0, 0.6, vmask);
  vec3 pane = vec3(0.150, 0.004, 0.040);
  float alpha = fa + ba * (1.0 - fa);
  vec3 col = (fcol * fa + pane * ba * (1.0 - fa)) / max(alpha, 1e-4);

  gl_FragColor = vec4(col, alpha * mask);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [1, 1, 1];
  return [
    parseInt(m[1], 16) / 255,
    parseInt(m[2], 16) / 255,
    parseInt(m[3], 16) / 255,
  ];
}

/**
 * Self-contained WebGL "liquid glass" overlay. Renders a rounded-rect glass
 * surface (animated refraction warp + fresnel rim + specular sheen) sized to
 * its parent. Meant to sit over a `backdrop-blur` container, which supplies the
 * real frosted refraction of whatever is behind it.
 */
export default function LiquidGlass({
  radius = 16,
  tint = "#470015",
  className = "",
  sweepRef,
  backing = false,
}: LiquidGlassProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // No GPU, no refraction pass: the CSS backdrop-blur below is the
    // fallback and is what those visitors see anyway (lib/gpu.ts).
    if (!hasGPU()) return;

    const canvas = document.createElement("canvas");
    // Same context attributes three was asked for.
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });
    if (!gl) return; // graceful no-op; CSS backdrop-blur still renders

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    // ── Program ──
    // Built by a function, not inline: a lost-and-restored context comes back
    // with no program, no buffer and no uniforms (three used to rebuild these
    // behind its renderer), so the restore handler below runs it again.
    let program: WebGLProgram | null = null;
    let quad: WebGLBuffer | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uResolution: WebGLUniformLocation | null = null;
    let uSweep: WebGLUniformLocation | null = null;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const build = (): boolean => {
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fsh = compile(gl.FRAGMENT_SHADER, FRAG);
      const p = gl.createProgram();
      if (!vs || !fsh || !p) return false;
      gl.attachShader(p, vs);
      gl.attachShader(p, fsh);
      gl.linkProgram(p);
      // The program keeps what it needs; the shader objects can go.
      gl.deleteShader(vs);
      gl.deleteShader(fsh);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        gl.deleteProgram(p);
        return false;
      }
      gl.useProgram(p);
      program = p;

      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const aPosition = gl.getAttribLocation(p, "position");
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

      // NormalBlending on a non-premultiplied, transparent material, as three
      // set it up: straight alpha over, alpha accumulated the same way.
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
      );
      gl.clearColor(0, 0, 0, 0);

      const u = (name: string) => gl.getUniformLocation(p, name);
      uTime = u("iTime");
      uResolution = u("iResolution");
      uSweep = u("uSweep");
      const [tr, tg, tb] = hexToRgb(tint);
      gl.uniform1f(u("uRadius"), radius);
      gl.uniform1f(u("uDpr"), dpr);
      gl.uniform3f(u("uTint"), tr, tg, tb);
      gl.uniform1f(uTime, 0);
      gl.uniform1f(uSweep, 0);
      gl.uniform1f(u("uBacking"), backing ? 1 : 0);
      return true;
    };

    if (!build()) {
      container.removeChild(canvas);
      return;
    }

    const render = () => {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      render();
    };

    const ro = new ResizeObserver(setSize);
    ro.observe(container);
    setSize();

    let raf = 0;
    let isVisible = true;
    let isPageVisible = !document.hidden;
    const start = performance.now();

    /**
     * Frame budget for the glass. It is a slow refractive sheen on a control
     * the size of a thumbnail, so a coarse-pointer device — where the budget
     * is tight and the panel is smallest — gets half the frames and cannot
     * tell. Fine pointers keep 60.
     */
    const frameMs = window.matchMedia("(hover: hover) and (pointer: fine)")
      .matches
      ? 0
      : 1000 / 30;
    let lastFrame = 0;

    const loop = (now: number) => {
      if (now - lastFrame < frameMs) {
        raf = requestAnimationFrame(loop);
        return;
      }
      lastFrame = now;
      const tSec = (now - start) * 0.001;
      gl.uniform1f(uTime, tSec);
      if (sweepRef) {
        gl.uniform1f(uSweep, sweepRef.current);
      } else {
        // Legacy self-running up/down sweep when no external driver is given.
        const cyc = (tSec / 7.5) % 1;
        const ss = (a: number, b: number, x: number) => {
          const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
          return t * t * (3 - 2 * t);
        };
        gl.uniform1f(uSweep, 1 - (ss(0, 0.25, cyc) - ss(0.5, 0.75, cyc)));
      }
      render();
      raf = requestAnimationFrame(loop);
    };
    // The nav menu covers the whole viewport, so every glass panel under it is
    // rendering into something nobody can see. The same `menu-open` flag the
    // other WebGL layers already respect.
    let menuOpen = document.body.classList.contains("menu-open");
    const tryStart = () => {
      if (isVisible && isPageVisible && !menuOpen && raf === 0) {
        raf = requestAnimationFrame(loop);
      }
    };
    const tryStop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        isVisible ? tryStart() : tryStop();
      },
      { threshold: 0 },
    );
    io.observe(container);

    const onVisibility = () => {
      isPageVisible = !document.hidden;
      isPageVisible ? tryStart() : tryStop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // The MENU's own events, not the scroll lock. `app:scroll-lock` means only
    // "something is holding the page still", and the menu is one of several
    // things that say it: the services detail view, the works strip and the
    // idle screen send it too, with the navbar still in plain view. Keyed on
    // the lock, the toggle's glass and its flame band stopped drawing the
    // moment Expand was pressed (measured: 181 draws in 3s, then 0), leaving
    // the band frozen over the logo/icon swap until Back.
    const onMenu = (e: Event) => {
      menuOpen = e.type === "app:menu-open";
      if (menuOpen) tryStop();
      else tryStart();
    };
    window.addEventListener("app:menu-open", onMenu);
    window.addEventListener("app:menu-close", onMenu);

    // A dropped context used to leave the toggle's glass gone for good — this
    // canvas is one of the first the browser evicts when the page runs past
    // its context budget. Ask for it back, and stop pretending to draw.
    const onLost = (e: Event) => {
      e.preventDefault();
      tryStop();
    };
    const onRestored = () => {
      // Everything GL-side died with the old context. Rebuild, re-measure,
      // and only then draw again.
      if (build()) {
        setSize();
        tryStart();
      }
    };
    const canvasEl = canvas;
    canvasEl.addEventListener("webglcontextlost", onLost);
    canvasEl.addEventListener("webglcontextrestored", onRestored);

    tryStart();

    return () => {
      window.removeEventListener("app:menu-open", onMenu);
      window.removeEventListener("app:menu-close", onMenu);
      canvasEl.removeEventListener("webglcontextlost", onLost);
      canvasEl.removeEventListener("webglcontextrestored", onRestored);
      tryStop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
      // Hand the context back rather than waiting for GC: this page runs
      // close to the browser's context cap (see webglContexts.ts).
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      try {
        container.removeChild(canvas);
      } catch {
        /* ignore */
      }
    };
    // radius/tint are read once on init; intentionally mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    />
  );
}
