"use client";

import { useEffect, useMemo, useRef } from "react";
import "@/app/styles/chromatic-metal.css";
import { isOff } from "@/app/lib/killSwitch";

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

/* ═══════════════════════════════════════════════════════════════════
   The glass cube — the corner dock's + box, per the client's reference
   (recent.design "rolling dial shader", Screen Recording 2026-09-08
   021013): a rounded cube of solid glass, edges throwing rainbow, white
   glints on the corners, the scene behind it seen refracted and dark
   through its core.

   It rides in THIS module because it needs a WebGL context and the page
   is at the browser's cap (see webglContexts.ts): the rims' shared
   context gets a second program, drawn into a strip of the same tile
   canvas above the metal region, and the dock blits that strip into a
   small 2D canvas the way every rim does. No new context.

   The shader raymarches a rounded box. A ray that hits it splits: a
   Fresnel share reflects off the surface into a procedural environment
   (a dark room with a soft ceiling, two hard white glints, a warm lamp
   and a cool fill — the film's palette), and the rest refracts in, runs
   through the glass, and refracts out, once per colour channel at a
   slightly different index so the edges disperse. Rays that leave the
   back of the cube towards the page are not painted at all: their share
   is written as TRANSPARENCY, so the frosted page shows through the
   core, darkened by the glass's absorption along the path. Output is
   premultiplied — what the glass adds, and how much of the page it lets
   through.
   ═══════════════════════════════════════════════════════════════════ */
const CUBE = 256;

const CUBE_FRAG = `
precision highp float;

uniform vec2  u_cres;
uniform vec2  u_corg;   /* the cube viewport's origin: gl_FragCoord is window space */
uniform mat3  u_rot;    /* world -> cube frame */
uniform vec3  u_half;   /* the solid's half-size (before rounding) */
uniform float u_rr;     /* its edge rounding */
uniform float u_tab;    /* 1: a file - a tab on its top-left edge */
uniform float u_fov;    /* the lens: 0.30 for the cube; the file is framed tighter */

const float IOR = 1.5;
const float DISP = 0.022;

/* A CUBE, as in the client's reference: flat faces, straight edges and a
   small rounding on them (0.09 of the edge). The old box was rounded by
   0.31 of its edge so that face-on it matched the flat 52px box - but
   that made it mostly corner, a pillow, and the refraction through those
   big bevels bent its outline into lumps ("the shape is all distorted").
   Half-size 0.345: turned three-quarter it covers about what the old
   face-on box did, and its corners stay inside the drawing area. */
float sdRound(vec3 p, vec3 h, float r) {
  vec3 q = abs(p) - h;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
float sdBox(vec3 p) {
  float d = sdRound(p, u_half, u_rr);
  if (u_tab > 0.5) {
    /* A file: the folder's tab, a short raised lip on the top edge at the
       left, joined smoothly into the body. */
    vec3 tp = p - vec3(-u_half.x * 0.45, u_half.y + u_rr * 0.9, 0.0);
    float tab = sdRound(tp, vec3(u_half.x * 0.42, u_rr * 0.55, u_half.z), u_rr * 0.8);
    float k = 0.05;
    float hh = clamp(0.5 + 0.5 * (tab - d) / k, 0.0, 1.0);
    d = mix(tab, d, hh) - k * hh * (1.0 - hh);
  }
  return d;
}
float map(vec3 p) { return sdBox(u_rot * p); }
vec3 nrm(vec3 p) {
  vec2 e = vec2(0.0012, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)));
}

/* The room the glass reflects and refracts: the flat box's own lighting
   in the round. That box had a bright white rim on the edges facing the
   top-left, a dimmer one with a hint of spectrum on the edges facing the
   bottom-right, and a soft lens glow — so: a broad white key from the
   top-left, a softer white from the bottom-right with warm and cool
   lobes beside it for the spectrum, over a pale ambient. Lights are
   fixed in the camera's frame, so they travel over the bevels as the
   cube turns. */
vec3 env(vec3 d) {
  /* A bright studio, so the bevels read as the flat box's pale rims
     and never go dark. */
  vec3 c = vec3(0.50, 0.49, 0.52);
  c += vec3(1.0) * pow(max(dot(d, normalize(vec3(-0.55, 0.70, 0.45))), 0.0), 14.0) * 1.6;
  c += vec3(1.0) * pow(max(dot(d, normalize(vec3(-0.45, 0.80, 0.40))), 0.0), 160.0) * 4.0;
  c += vec3(1.0) * pow(max(dot(d, normalize(vec3(0.60, -0.55, 0.55))), 0.0), 12.0) * 0.9;
  c += vec3(1.0, 0.55, 0.30) * pow(max(dot(d, normalize(vec3(0.80, -0.35, 0.45))), 0.0), 18.0) * 0.7;
  c += vec3(0.45, 0.70, 1.0) * pow(max(dot(d, normalize(vec3(0.35, -0.80, 0.45))), 0.0), 18.0) * 0.6;
  return c;
}

/* March to the surface. On a miss, p is the point of closest approach
   and dmin how close it came — the silhouette's anti-aliasing. */
bool marchOut(vec3 ro, vec3 rd, out vec3 p, out float dmin) {
  float t = 0.0;
  dmin = 1e9;
  float tmin = 0.0;
  for (int i = 0; i < 72; i++) {
    vec3 q = ro + rd * t;
    float d = map(q);
    if (d < dmin) { dmin = d; tmin = t; }
    if (d < 0.0012) { p = q; return true; }
    t += d;
    if (t > 6.0) break;
  }
  p = ro + rd * tmin;
  return false;
}

vec3 marchIn(vec3 ro, vec3 rd) {
  float t = 0.01;
  vec3 p = ro;
  for (int i = 0; i < 48; i++) {
    p = ro + rd * t;
    float d = -map(p);
    if (d < 0.0012) break;
    t += max(d, 0.004);
  }
  return p;
}

/* In through the front, through the glass, out the back — with one
   internal bounce if the exit is total internal reflection. Returns the
   leaving direction; len is the path length inside. */
vec3 transmit(vec3 p1, vec3 rd, vec3 n1, float ior, out float len) {
  vec3 rdi = refract(rd, n1, 1.0 / ior);
  vec3 p2 = marchIn(p1, rdi);
  len = length(p2 - p1);
  vec3 n2 = nrm(p2);
  vec3 rdo = refract(rdi, -n2, ior);
  if (dot(rdo, rdo) < 0.5) {
    vec3 rdr = reflect(rdi, n2);
    vec3 p3 = marchIn(p2, rdr);
    len += length(p3 - p2);
    vec3 n3 = nrm(p3);
    rdo = refract(rdr, -n3, ior);
    if (dot(rdo, rdo) < 0.5) rdo = reflect(rdr, n3);
  }
  return rdo;
}

void main() {
  vec2 uv = ((gl_FragCoord.xy - u_corg) / u_cres) * 2.0 - 1.0;
  vec3 ro = vec3(0.0, 0.0, 3.2);
  vec3 rd = normalize(vec3(uv * u_fov, -1.0));
  vec3 p1;
  float dmin;
  bool hit = marchOut(ro, rd, p1, dmin);
  /* A pixel's footprint at the cube, in world units. */
  float px = u_fov * 2.7 * 2.0 / u_cres.x;
  if (!hit && dmin > px) { gl_FragColor = vec4(0.0); return; }
  float cover = hit ? 1.0 : 1.0 - dmin / px;
  vec3 n1 = nrm(p1);
  float cosI = clamp(dot(-rd, n1), 0.0, 1.0);
  float F = 0.05 + 0.95 * pow(1.0 - cosI, 5.0);

  vec3 col = F * env(reflect(rd, n1));
  float through = 0.0;
  /* Near-clear glass with a touch of body, so the long paths through
     the bevels go a shade darker — the flat box's refraction band. */
  vec3 k = vec3(0.10, 0.11, 0.13);
  for (int c = 0; c < 3; c++) {
    float ior = IOR + float(c - 1) * DISP;
    float len;
    vec3 rdo = transmit(p1, rd, n1, ior, len);
    float T = exp(-len * k[c]);
    /* Leaving towards the page: let the page through instead of painting.
       The faces are all page — the frosted skin under the cube is what
       shows there, the same skin the flat box wore. */
    float page = smoothstep(-0.1, 0.7, -rdo.z);
    col[c] += (1.0 - F) * T * env(rdo)[c] * (1.0 - page);
    through += (1.0 - F) * T * page / 3.0;
  }
  /* A floor on the alpha: a faint body to the glass, and a silhouette
     the dock can trace from the alpha channel. */
  gl_FragColor = vec4(col, max(1.0 - through, 0.1)) * cover;
}
`;

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
  /** Where the metal lives on the tile (the cube strip sits above it). */
  metal: { x: number; y: number; w: number; h: number };
  /** Where the cube lives on the tile. */
  cube: { x: number; y: number; w: number; h: number };
  /** Where the file lives on the tile. */
  file: { x: number; y: number; w: number; h: number };
  subscribeFile(fn: Blit): () => void;
  /** The file: formed (0 flat .. 1 solid), opened (0..1), lean (-1..1). */
  setFile(p: Partial<{ form: number; open: number; x: number; y: number }>): void;
  subscribe(fn: Blit): () => void;
  /** Blits of the cube strip; drawn only while someone is subscribed. */
  subscribeCube(fn: Blit): () => void;
  /** The cube leans towards the pointer: -1..1 on each axis, eased. */
  setCubeTilt(x: number, y: number): void;
  setControls(partial: Partial<ChromaticMetalControls>): void;
}

/* undefined = not attempted yet; null = the last attempt failed. */
let source: Source | null | undefined;
/** When the last attempt failed, so a later one is allowed to try again. */
let lastFailAt = 0;
/**
 * How long a failure stands before another attempt is allowed.
 *
 * `null` used to be permanent, and that is the bug this fixes. This tile is
 * ONE WebGL context shared by every chrome rim on the page and by the corner
 * dock's glass cube, and it is asked for while the page is at its busiest —
 * measured on the landing page, 19 contexts requested against a browser limit
 * near 16. Lose that race once, at boot, and the answer was cached forever:
 * no rims and no cube for the rest of the visit, on a page where a second
 * later there would have been room. A refusal is a moment, not a verdict.
 */
const RETRY_AFTER_MS = 4000;

function createSource(): Source | null {
  const tile = document.createElement("canvas");
  tile.width = TILE;
  /* The cube strip sits above the metal tile, image-wise: GL's y runs
     up from the bottom, so the metal is viewport (0,0) and the cube is
     viewport (0,TILE), which drawImage sees at the top of the canvas. */
  /* ...and the file strip above that: image-wise file, cube, metal. */
  tile.height = TILE + CUBE * 2;
  /* preserveDrawingBuffer: the tile is read back with drawImage after
     the draw, so the buffer must survive. */
  const gl = tile.getContext("webgl", {
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
  }) as WebGLRenderingContext | null;
  if (!gl) return null;

  /* The browser evicting this context used to be the end of every chrome rim
     and the dock's cube for the rest of the visit: the singleton stayed
     cached, holding a dead context, and drew nothing forever after. Losing it
     now simply retires the singleton, so the next thing that asks builds a
     fresh one. preventDefault() keeps the door open for the browser to hand
     the context back rather than declaring it gone. */
  tile.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    if (source && source.tile === tile) {
      source = undefined;
      lastFailAt = 0;
    }
  });

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

  const link = (fragSrc: string, label: string) => {
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    /* Both programs share the one quad, so pin a_pos to attribute 0. */
    gl.bindAttribLocation(prog, 0, "a_pos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(
        `[ChromaticMetal] ${label} program link failed:`,
        gl.getProgramInfoLog(prog)
      );
      return null;
    }
    return prog;
  };
  const prog = link(FRAG, "metal");
  if (!prog) return null;
  /* The cube is optional: if its shader fails the rims still work. */
  const cubeProg = link(CUBE_FRAG, "cube");
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
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
    gl.useProgram(prog);
    gl.viewport(0, 0, TILE, TILE);
    if (dirty) {
      uploadControls();
      dirty = false;
    }
    gl.uniform1f(U.loop, phase);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    lastLoop = phase;
  };

  /* ── The cube ──
     A piece set at a three-quarter pose in a display case, plus a lean
     towards the pointer. It USED to turn continuously about a tilted
     axis, and the client read that as the + box "getting smaller and
     bigger": a rounded cube's silhouette swings about 16% between
     face-on and corner-on (measured 50–58px on the 52px seed), and its
     bright bevel highlights sweep over the white + and eat its arms, so
     the glyph itself seemed to shrink and grow. So the pose is fixed —
     yaw and roll chosen so the front face, where the + sits, dominates
     and the top and one side show enough to read as a cube — with only
     a hair of breathing on the pitch (under a pixel of silhouette). The
     lean is the interaction; the light still travels the bevels as the
     cube leans. u_rot takes world points into the cube's frame, so it is
     the inverse (transpose) of the cube's own rotation. */
  /* Three-quarter, as the reference's cube mostly sits: the top and one
     side show clearly so it reads as a solid, not a flat tile. */
  const POSE = { yaw: 0.62, pitch: 0.55, roll: 0.32 };
  /* It TUMBLES, as the reference does (client, 20 Sep): a steady turn
     about a tilted axis, about a turn every five seconds, with the pitch
     and roll swinging slowly so no two passes look alike.

     The client's old complaint about a turning cube - that the + seemed to
     get "smaller and bigger" - was the silhouette of a rounded cube
     swinging about 16% between face-on and corner-on. That is fixed here
     rather than by standing still: the solid is scaled every frame by the
     pose's own silhouette, so what the screen sees stays one size. For a
     rounded box the half-width along a screen axis is the support function
     a(|dx|+|dy|+|dz|) + r, with d that axis in the cube's frame - the
     first two columns of u_rot. */
  const HALF = 0.265;
  const ROUND = 0.08;
  /* The size to hold: the half-extent the cube had at the pose it used to
     stand still at (yaw .62, pitch .55, roll .32) - so the tumbling cube
     is exactly the size the box was before it moved. */
  const SIL = 0.4762;
  const support = (r: Float32Array, c: number) => {
    const d0 = Math.abs(r[c]), d1 = Math.abs(r[c + 3]), d2 = Math.abs(r[c + 6]);
    return HALF * (d0 + d1 + d2) + ROUND;
  };
  const CU = cubeProg
    ? {
        res: gl.getUniformLocation(cubeProg, "u_cres"),
        org: gl.getUniformLocation(cubeProg, "u_corg"),
        rot: gl.getUniformLocation(cubeProg, "u_rot"),
        half: gl.getUniformLocation(cubeProg, "u_half"),
        rr: gl.getUniformLocation(cubeProg, "u_rr"),
        tab: gl.getUniformLocation(cubeProg, "u_tab"),
        fov: gl.getUniformLocation(cubeProg, "u_fov"),
      }
    : null;
  if (cubeProg && CU) {
    gl.useProgram(cubeProg);
    gl.uniform2f(CU.res, CUBE, CUBE);
  }
  /* R = Rz(roll) * Rx(pitch) * Ry(yaw); written transposed into `out`. */
  const setRot = (out: Float32Array, yaw: number, pitch: number, roll: number) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const r00 = cr * cy + sr * sp * sy, r01 = -sr * cp, r02 = -cr * sy + sr * sp * cy;
    const r10 = sr * cy - cr * sp * sy, r11 = cr * cp, r12 = -sr * sy - cr * sp * cy;
    const r20 = cp * sy, r21 = sp, r22 = cp * cy;
    out.set([r00, r10, r20, r01, r11, r21, r02, r12, r22]);
  };
  /* One solid into one strip of the tile. */
  const drawSolid = (y0: number, r: Float32Array, half: [number, number, number], rr: number, tab: number, fov: number) => {
    if (!cubeProg || !CU) return;
    gl.useProgram(cubeProg);
    gl.viewport(0, y0, CUBE, CUBE);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, y0, CUBE, CUBE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
    gl.uniform2f(CU.org, 0, y0);
    gl.uniformMatrix3fv(CU.rot, false, r);
    gl.uniform3f(CU.half, half[0], half[1], half[2]);
    gl.uniform1f(CU.rr, rr);
    gl.uniform1f(CU.tab, tab);
    gl.uniform1f(CU.fov, fov);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  const rot = new Float32Array(9);
  const drawCube = () => {
    if (!cubeProg || !CU) return;
    tilt.x += (tilt.tx - tilt.x) * 0.12;
    tilt.y += (tilt.ty - tilt.y) * 0.12;
    const t = reduced ? 2.1 : performance.now() / 1000;
    const yaw = POSE.yaw + (reduced ? 0 : t * 1.15) + tilt.x * 0.35;
    const pitch = POSE.pitch + Math.sin(t * 0.37) * 0.22 - tilt.y * 0.3;
    const roll = POSE.roll + Math.sin(t * 0.23) * 0.16;
    setRot(rot, yaw, pitch, roll);
    /* One size on screen whatever the pose (see POSE above). */
    const g = (support(rot, 0) + support(rot, 1)) / 2;
    const k = SIL / g;
    drawSolid(TILE, rot, [HALF * k, HALF * k, HALF * k], ROUND * k, 0, 0.30);
  };

  /* ── The file ──
     The folder button's 3D form: a slab of the same glass, portrait like
     the flat envelope (50x62), thin, with a folder's tab on its top edge.
     `form` (0..1) turns it from face-on - where its outline IS the flat
     shape it grows out of - to its three-quarter pose, so a flat file
     becomes a solid one; `open` (0..1) tips it back like a folder opened
     to let what is inside out. */
  const file = { form: 0, open: 0, tf: 0, to: 0, x: 0, y: 0, tx: 0, ty: 0 };
  const fileRot = new Float32Array(9);
  const drawFile = () => {
    if (!cubeProg || !CU) return;
    file.form += (file.tf - file.form) * 0.14;
    file.open += (file.to - file.open) * 0.16;
    file.x += (file.tx - file.x) * 0.12;
    file.y += (file.ty - file.y) * 0.12;
    const f = file.form * file.form * (3 - 2 * file.form);
    const t = reduced ? 2.1 : performance.now() / 1000;
    const yaw = f * (-0.48 + file.x * 0.3) + Math.sin(t * 0.37) * 0.02 * f;
    const pitch = f * 0.34 - file.open * 0.62 - file.y * 0.25 * f;
    const roll = f * -0.06;
    setRot(fileRot, yaw, pitch, roll);
    /* Framed so the face-on file is the flat 50x62 envelope on an 84px
       canvas: 0.51 x 0.63 units at 98px a unit. */
    drawSolid(TILE + CUBE, fileRot, [0.205, 0.265, 0.035 + 0.025 * f], 0.05, 1, 0.134);
  };

  /* One frame right now, before any subscriber, so nothing ever blanks. */
  draw();

  const subs = new Set<Blit>();
  const cubeSubs = new Set<Blit>();
  const fileSubs = new Set<Blit>();
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
    if (subs.size) {
      draw();
      subs.forEach((fn) => fn(tile));
    }
    if (cubeSubs.size) {
      drawCube();
      cubeSubs.forEach((fn) => fn(tile));
    }
    if (fileSubs.size) {
      drawFile();
      fileSubs.forEach((fn) => fn(tile));
    }
  };

  const start = () => {
    // Reduced motion holds a fixed phase, so the tile is static: the single
    // draw above plus each subscriber's first blit is the entire effect.
    if (reduced || raf || subs.size + cubeSubs.size + fileSubs.size === 0 || !shouldRun()) return;
    raf = requestAnimationFrame(frame);
  };

  // Both of the pauses above are edge-triggered, so something has to restart
  // it. `app:scroll-unlock` is what the navbar fires as the menu closes.
  document.addEventListener("visibilitychange", start);
  window.addEventListener("app:scroll-unlock", start);
  window.addEventListener("app:menu-close", start);

  const stopIfIdle = () => {
    if (subs.size + cubeSubs.size + fileSubs.size === 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  return {
    tile,
    metal: { x: 0, y: CUBE * 2, w: TILE, h: TILE },
    cube: { x: 0, y: CUBE, w: CUBE, h: CUBE },
    file: { x: 0, y: 0, w: CUBE, h: CUBE },
    subscribe(fn) {
      subs.add(fn);
      fn(tile); // immediate first blit
      start();
      return () => {
        subs.delete(fn);
        stopIfIdle();
      };
    },
    subscribeCube(fn) {
      if (!cubeProg) return () => {};
      cubeSubs.add(fn);
      drawCube();
      fn(tile);
      start();
      return () => {
        cubeSubs.delete(fn);
        stopIfIdle();
      };
    },
    setCubeTilt(x, y) {
      tilt.tx = x;
      tilt.ty = y;
    },
    subscribeFile(fn) {
      if (!cubeProg) return () => {};
      fileSubs.add(fn);
      drawFile();
      fn(tile);
      start();
      return () => {
        fileSubs.delete(fn);
        stopIfIdle();
      };
    },
    setFile(p) {
      if (p.form !== undefined) file.tf = p.form;
      if (p.open !== undefined) file.to = p.open;
      if (p.x !== undefined) file.tx = p.x;
      if (p.y !== undefined) file.ty = p.y;
    },
    setControls(partial) {
      controls = { ...controls, ...partial };
      dirty = true;
    },
  };
}

/**
 * The dock's glass cube: subscribe a 2D canvas to the cube strip of the
 * shared tile. Returns the unsubscribe, or null when WebGL (or the cube
 * shader) is unavailable, so the caller can keep a flat fallback.
 */
export function subscribeGlassCube(
  canvas: HTMLCanvasElement,
  size: () => number,
  /** After each blit, with the canvas's 2D context and its pixel size. */
  onBlit?: (ctx: CanvasRenderingContext2D, px: number) => void
): {
  stop: () => void;
  tilt: (x: number, y: number) => void;
  /** Draw only while the cube is on screen; off, it costs nothing. */
  setActive: (on: boolean) => void;
} | null {
  const src = getSource();
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!src || !ctx) return null;
  let px = 0;
  const blit: Blit = (tile) => {
    const want = Math.max(1, Math.round(size()));
    if (want !== px) {
      px = canvas.width = canvas.height = want;
    }
    const c = src.cube;
    ctx.clearRect(0, 0, px, px);
    ctx.drawImage(tile, c.x, c.y, c.w, c.h, 0, 0, px, px);
    onBlit?.(ctx, px);
  };
  let unsub: (() => void) | null = null;
  const setActive = (on: boolean) => {
    if (on && !unsub) unsub = src.subscribeCube(blit);
    else if (!on && unsub) {
      unsub();
      unsub = null;
    }
  };
  return {
    stop: () => setActive(false),
    tilt: src.setCubeTilt,
    setActive,
  };
}

/**
 * The dock's glass file (the folder button's 3D form): subscribe a 2D
 * canvas to the file strip. Null when WebGL or the shader is missing.
 */
export function subscribeGlassFile(
  canvas: HTMLCanvasElement,
  size: () => number,
  onBlit?: (ctx: CanvasRenderingContext2D, px: number) => void
): {
  set: (p: Partial<{ form: number; open: number; x: number; y: number }>) => void;
  setActive: (on: boolean) => void;
} | null {
  const src = getSource();
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!src || !ctx) return null;
  let px = 0;
  const blit: Blit = (tile) => {
    const want = Math.max(1, Math.round(size()));
    if (want !== px) px = canvas.width = canvas.height = want;
    const c = src.file;
    ctx.clearRect(0, 0, px, px);
    ctx.drawImage(tile, c.x, c.y, c.w, c.h, 0, 0, px, px);
    onBlit?.(ctx, px);
  };
  let unsub: (() => void) | null = null;
  const setActive = (on: boolean) => {
    if (on && !unsub) unsub = src.subscribeFile(blit);
    else if (!on && unsub) {
      unsub();
      unsub = null;
    }
  };
  return { set: (p) => src.setFile(p), setActive };
}

function getSource(): Source | null {
  const staleFailure =
    source === null && Date.now() - lastFailAt > RETRY_AFTER_MS;
  if (source === undefined || staleFailure) {
    try {
      source = createSource();
    } catch (err) {
      console.error("[ChromaticMetal] source init failed:", err);
      source = null;
    }
    if (source === null) lastFailAt = Date.now();
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
    if (isOff("rim")) return; // debug kill switch
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
      /* Cover-crop the square metal region onto the element's aspect. */
      const m = src.metal;
      const s = Math.max(w / m.w, h / m.h);
      const sw = w / s;
      const sh = h / s;
      ctx.drawImage(
        tile,
        m.x + (m.w - sw) / 2,
        m.y + (m.h - sh) / 2,
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
