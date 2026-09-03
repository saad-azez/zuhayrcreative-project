"use client";

import { useEffect, useMemo, useRef } from "react";
import "@/app/styles/chromatic-metal.css";

/* ═══════════════════════════════════════════════════════════════════
   Chromatic Metal — brushed-chrome liquid-metal bands with chromatic
   aberration, as a WebGL/GLSL fragment shader.

   ONE shared WebGL source renders the shader into an offscreen tile on
   a continuous requestAnimationFrame loop; every mounted instance is
   just a 2D canvas that blits from that tile each frame, ring-masked
   into its host's border by CSS. This is deliberate: the site mounts a
   rim on every liquid-glass button (navbar, dock, CTAs, lightbox
   closes — easily 10+ at once), and browsers cap live WebGL contexts
   at ~8–16, evicting the oldest past that. One context serves them
   all; the per-instance cost is a drawImage.

   While a shader rim is mounted on a host, the host's CSS conic rim
   (.liquid-glass::before) stands down via the .cm-host class; if WebGL
   is unavailable the class is never added and the CSS rim remains as
   the fallback.
   ═══════════════════════════════════════════════════════════════════ */

export interface ChromaticMetalControls {
  /** Band contrast, 1 = neutral. Configured: 2.0 (200%). */
  depth: number;
  /** Chromatic aberration strength. Configured: 0.15 (15%). */
  rgbSplit: number;
  /** Band frequency multiplier. Configured: 2.0 (200%). */
  scale: number;
  /** Anisotropic squeeze along the band axis. */
  stretch: number;
  /** Band direction in degrees. Configured: 0 (was −180). */
  angle: number;
  /** Ramp repetitions across the tile. */
  repeats: number;
  /** Static band offset; a further 0 → −100% drift plays per loop. */
  offset: number;
  /** Amplitude of the primary traveling wave. */
  phase: number;
  /** Amplitude of the secondary liquid warp. */
  evolution: number;
  /** Brushed-metal grain amount. */
  roughness: number;
  /** Color ramp, up to 8 stops. First/last should match for a clean wrap. */
  gradient: { color: [number, number, number]; stop: number }[];
}

/* Defaults per the configuration handed over (right-hand values), with
   the ramp mirroring the CSS conic rim's specular whites and dark
   reflections so the shader rim reads as the same chrome, now flowing. */
const DEFAULTS: ChromaticMetalControls = {
  depth: 2.0,
  rgbSplit: 0.15,
  scale: 2.0,
  stretch: 1.0,
  angle: 0,
  repeats: 3,
  offset: -1.0,
  phase: 0.6,
  evolution: 0.5,
  roughness: 0.35,
  gradient: [
    { color: [1.0, 1.0, 1.0], stop: 0.0 },
    { color: [0.55, 0.56, 0.6], stop: 0.14 },
    { color: [0.07, 0.07, 0.09], stop: 0.27 },
    { color: [1.0, 1.0, 1.0], stop: 0.42 },
    { color: [0.38, 0.38, 0.42], stop: 0.55 },
    { color: [0.96, 0.96, 0.98], stop: 0.7 },
    { color: [0.09, 0.09, 0.11], stop: 0.86 },
    { color: [1.0, 1.0, 1.0], stop: 1.0 },
  ],
};

const MAX_STOPS = 8;
/**
 * The shared tile's resolution.
 *
 * It feeds a ~2.5px rim on small controls, and its shader evaluates a
 * seven-stop ramp three times per fragment — so at 512 that is roughly five
 * million smoothstep/mix operations a frame for a hairline. Coarse-pointer
 * devices, which is where the frame budget actually hurts, get a quarter of
 * the fragments; the rim is a couple of pixels wide either way.
 */
const TILE =
  typeof window !== "undefined" &&
  !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ? 256
    : 512;

/**
 * How often the tile is redrawn and re-blitted, in ms.
 *
 * The sheen's own cycle is seven seconds, so 60fps was spending sixty draws
 * and — more expensively — sixty MAIN-THREAD canvas blits per second per
 * subscriber on a gradient that moves a fraction of a degree between frames.
 * There are a dozen subscribers on the landing page. At 24fps the motion is
 * indistinguishable and the main-thread cost drops by well over half, which
 * is exactly what a CPU-bound low-end device needs.
 */
const FRAME_MS = 1000 / 24;
/* Matches the 7s of the CSS rim it replaces. */
const PERIOD_MS = 7000;

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  u_res;
uniform float u_loop;   /* 0..1 loop phase */
uniform float u_depth;
uniform float u_split;
uniform float u_scale;
uniform float u_stretch;
uniform float u_angle;  /* degrees */
uniform float u_repeats;
uniform float u_offset;
uniform float u_phase;
uniform float u_evolution;
uniform float u_rough;
uniform vec3  u_colors[${MAX_STOPS}];
uniform float u_stops[${MAX_STOPS}];
uniform int   u_count;

const float TAU = 6.28318530718;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

/* Ramp sampling with CONSTANT indices only — WebGL 1 forbids indexing
   a uniform array with a variable, so the loop visits every stop by
   its literal index and folds it in with a weight that is zero outside
   its own segment. The tight smoothstep keeps edges hard: chrome. */
vec3 ramp(float t) {
  t = fract(t);
  vec3 c = u_colors[0];
  for (int i = 1; i < ${MAX_STOPS}; i++) {
    if (i < u_count) {
      float a = u_stops[i - 1];
      float b = u_stops[i];
      float f = clamp((t - a) / max(b - a, 1e-4), 0.0, 1.0);
      f = smoothstep(0.2, 0.8, f);
      c = mix(c, u_colors[i], f);
    }
  }
  return c;
}

float bands(vec2 uv) {
  float ang = radians(u_angle);
  vec2 p = uv - 0.5;
  p = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p;
  p.x /= max(u_stretch, 1e-3);
  float T = u_loop * TAU;
  /* Liquid warp. Every time term passes through sin of T, so the frame
     at u_loop=1 equals the frame at u_loop=0 exactly: seamless. */
  float w = sin(p.y * 5.0 + T)             * 0.12 * u_phase
          + sin(p.y * 11.0 - T)            * 0.05 * u_evolution
          + sin((p.x + p.y) * 7.0 + 2.0*T) * 0.04 * u_evolution;
  /* Configured Offset plus a whole-period drift (0 → -100% per loop):
     an integer number of ramp repeats, so the wrap never shows. */
  return (p.x * u_scale + w) * u_repeats + u_offset - u_loop;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float grain = hash(uv * u_res) - 0.5;
  float t = bands(uv) + grain * u_rough * 0.06;

  /* RGB split: the ramp sampled three times at offset coordinates, one
     per channel — red/cyan fringes on one band edge, blue/yellow on
     the other. */
  float d = u_split * 0.3;
  vec3 col = vec3(ramp(t + d).r, ramp(t).g, ramp(t - d).b);

  col = (col - 0.5) * u_depth + 0.5;  /* Depth = band contrast */
  col += grain * u_rough * 0.25;      /* brushed tooth */
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

type Blit = (tile: HTMLCanvasElement) => void;

interface Source {
  tile: HTMLCanvasElement;
  subscribe(fn: Blit): () => void;
  setControls(partial: Partial<ChromaticMetalControls>): void;
}

/* undefined = not attempted yet; null = WebGL unavailable. */
let source: Source | null | undefined;

function createSource(): Source | null {
  const tile = document.createElement("canvas");
  tile.width = tile.height = TILE;
  /* preserveDrawingBuffer: the tile is read back with drawImage after
     the draw, so the buffer must survive. */
  const gl = tile.getContext("webgl", {
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
  }) as WebGLRenderingContext | null;
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(
        "[ChromaticMetal] shader compile failed:",
        gl.getShaderInfoLog(sh)
      );
      return null;
    }
    return sh;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(
      "[ChromaticMetal] program link failed:",
      gl.getProgramInfoLog(prog)
    );
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, TILE, TILE);

  const loc = (n: string) => gl.getUniformLocation(prog, n);
  const U = {
    res: loc("u_res"),
    loop: loc("u_loop"),
    depth: loc("u_depth"),
    split: loc("u_split"),
    scale: loc("u_scale"),
    stretch: loc("u_stretch"),
    angle: loc("u_angle"),
    repeats: loc("u_repeats"),
    offset: loc("u_offset"),
    phase: loc("u_phase"),
    evolution: loc("u_evolution"),
    rough: loc("u_rough"),
    colors: loc("u_colors"),
    stops: loc("u_stops"),
    count: loc("u_count"),
  };
  gl.uniform2f(U.res, TILE, TILE);

  let controls: ChromaticMetalControls = { ...DEFAULTS };
  let dirty = true;

  const uploadControls = () => {
    const g = controls.gradient.slice(0, MAX_STOPS);
    const colors = new Float32Array(MAX_STOPS * 3);
    const stops = new Float32Array(MAX_STOPS).fill(1);
    g.forEach((s, i) => {
      colors.set(s.color, i * 3);
      stops[i] = s.stop;
    });
    gl.uniform3fv(U.colors, colors);
    gl.uniform1fv(U.stops, stops);
    gl.uniform1i(U.count, g.length);
    gl.uniform1f(U.depth, controls.depth);
    gl.uniform1f(U.split, controls.rgbSplit);
    gl.uniform1f(U.scale, controls.scale);
    gl.uniform1f(U.stretch, controls.stretch);
    gl.uniform1f(U.angle, controls.angle);
    gl.uniform1f(U.repeats, controls.repeats);
    gl.uniform1f(U.offset, controls.offset);
    gl.uniform1f(U.phase, controls.phase);
    gl.uniform1f(U.evolution, controls.evolution);
    gl.uniform1f(U.rough, controls.roughness);
  };

  const reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  let lastLoop = -1;
  const draw = () => {
    /* A frozen phase for reduced motion — still chrome, just still. */
    const phase = reduced ? 0.31 : (performance.now() % PERIOD_MS) / PERIOD_MS;
    if (phase === lastLoop && !dirty) return;
    if (dirty) {
      uploadControls();
      dirty = false;
    }
    gl.uniform1f(U.loop, phase);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    lastLoop = phase;
  };

  /* One frame right now, before any subscriber, so nothing ever blanks. */
  draw();

  const subs = new Set<Blit>();
  let raf = 0;

  /**
   * Whether this tile is worth redrawing at all right now.
   *
   * The rim it feeds is a ~2.5px ring on a handful of small controls, but the
   * tile is 512x512 and its shader evaluates a seven-stop ramp three times per
   * fragment — about five million smoothstep/mix operations a frame. It used
   * to run from first mount to last unmount with no gating whatsoever, which
   * made it the largest standing GPU cost on the page.
   *
   * Three cases where every one of those frames is wasted:
   *  - the tab is hidden;
   *  - the nav menu is open, so a full-viewport overlay is drawn over every
   *    rim on the page (the same `menu-open` flag WebGLTextTunnel and
   *    MetallicPaint already respect);
   *  - reduced motion, where the phase is pinned and the tile never changes,
   *    so one frame is the whole animation.
   */
  const shouldRun = () =>
    !document.hidden && !document.body.classList.contains("menu-open");

  let lastFrame = 0;
  const frame = (now: number) => {
    if (!shouldRun()) {
      raf = 0; // stopped; visibilitychange / the menu closing restarts it
      return;
    }
    raf = requestAnimationFrame(frame);
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;
    draw();
    subs.forEach((fn) => fn(tile));
  };

  const start = () => {
    // Reduced motion holds a fixed phase, so the tile is static: the single
    // draw above plus each subscriber's first blit is the entire effect.
    if (reduced || raf || subs.size === 0 || !shouldRun()) return;
    raf = requestAnimationFrame(frame);
  };

  // Both of the pauses above are edge-triggered, so something has to restart
  // it. `app:scroll-unlock` is what the navbar fires as the menu closes.
  document.addEventListener("visibilitychange", start);
  window.addEventListener("app:scroll-unlock", start);
  window.addEventListener("app:menu-close", start);

  return {
    tile,
    subscribe(fn) {
      subs.add(fn);
      fn(tile); // immediate first blit
      if (subs.size === 1) start();
      return () => {
        subs.delete(fn);
        if (subs.size === 0) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      };
    },
    setControls(partial) {
      controls = { ...controls, ...partial };
      dirty = true;
    },
  };
}

function getSource(): Source | null {
  if (source === undefined) {
    try {
      source = createSource();
    } catch (err) {
      console.error("[ChromaticMetal] source init failed:", err);
      source = null;
    }
  }
  return source;
}

interface ChromaticMetalProps {
  /** Ring-masked into the host's border (default) or a full fill. */
  mask?: "border" | "fill";
  /** Border-radius override (Rounding). Defaults to inheriting the host's. */
  rounding?: number;
  /** Partial control overrides. The source is shared: last writer wins. */
  controls?: Partial<ChromaticMetalControls>;
  className?: string;
}

/**
 * Chromatic-metal surface, ring-masked into the parent's border by
 * default. Drop inside any positioned .liquid-glass element; the CSS
 * conic rim on that host yields automatically while this is mounted.
 */
export default function ChromaticMetal({
  mask = "border",
  rounding,
  controls,
  className = "",
}: ChromaticMetalProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Serialize so a caller's inline object literal doesn't re-run the
     effect every render. */
  const controlsKey = useMemo(
    () => JSON.stringify(controls ?? null),
    [controls]
  );

  useEffect(() => {
    const src = getSource();
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!src || !host || !canvas) return; // no WebGL → CSS rim stays

    const parsed = JSON.parse(controlsKey) as
      | Partial<ChromaticMetalControls>
      | null;
    if (parsed) src.setControls(parsed);

    const glassHost = host.parentElement;
    glassHost?.classList.add("cm-host");

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const blit: Blit = (tile) => {
      if (!w || !h) return;
      /* Cover-crop the square tile onto the element's aspect. */
      const s = Math.max(w / tile.width, h / tile.height);
      const sw = w / s;
      const sh = h / s;
      ctx.drawImage(
        tile,
        (tile.width - sw) / 2,
        (tile.height - sh) / 2,
        sw,
        sh,
        0,
        0,
        w,
        h
      );
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      /* offsetWidth/Height, NOT getBoundingClientRect: several hosts
         live inside scaled elements (the dock collapses to scale 0.3),
         and the bounding rect bakes that transform in — a rim measured
         mid-collapse would keep a tiny blurry buffer forever, since
         transforms never re-fire the ResizeObserver. Layout size is
         transform-immune. */
      const cw = host.offsetWidth;
      const ch = host.offsetHeight;
      /* Never 0×0: an unmeasured/hidden host keeps its last real size
         (or the 1×1 floor) instead of collapsing the buffer. */
      const nw = Math.max(1, Math.round(cw * dpr));
      const nh = Math.max(1, Math.round(ch * dpr));
      if (cw > 0 && ch > 0 && (nw !== w || nh !== h)) {
        w = canvas.width = nw;
        h = canvas.height = nh;
        blit(src.tile);
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    const unsubscribe = src.subscribe(blit);

    return () => {
      ro.disconnect();
      unsubscribe();
      glassHost?.classList.remove("cm-host");
    };
  }, [controlsKey]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={`cmetal ${mask === "border" ? "is-border" : ""} ${className}`}
      style={rounding !== undefined ? { borderRadius: rounding } : undefined}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
