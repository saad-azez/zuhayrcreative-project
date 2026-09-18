"use client";

// "Infinite text tunnel" — vertical-band variant, raw WebGL (no three.js).
//
// How it works (matches the reference look at
// https://teal-university-839938.framer.app/):
//   • The text is drawn once onto an offscreen strip whose height is one
//     "band" (text block + gap), background colour baked in. That strip
//     repeats vertically and scrolls over time.
//   • A falloff mask — zero at the vertical centre, one at the top/bottom
//     edges — drives every distortion, so the centre band stays clean and
//     readable while edge bands warp.
//   • Toward the edges the bands compress vertically (tunnel depth) and the
//     texture expands horizontally, producing the "rushing into a pinch at
//     the top and bottom" perspective.
//   • Chromatic aberration is an 8-step spectral blend along Y (smooth
//     red→green→blue weights), scaled by the same edge mask.
//   • Bloom samples a second, pre-blurred copy of the strip (three stacked
//     canvas blurs) plus luminance-keyed highlights, both biased toward the
//     centre.
//
// The GL context is created once; the strip textures rebuild when the text /
// typography / colours / element size change, so the label can cycle without
// restarting the animation. Numeric "feel" props are 0–100 sliders read each
// frame via a ref (live-tunable). Falls back to plain centred text without
// WebGL.
//
// Usage:
//   <WebGLTextTunnel
//     text="designed imperfect."
//     font="Inter, system-ui, sans-serif"
//     fontWeight={700}
//     fontSize={60}
//     textColor="#FFFFFF"
//     background="#000000"
//     gap={100}
//     animationSpeed={20}
//     stretchX={30}
//     stretchY={50}
//     falloff={50}
//     bloom={30}
//     chromatic={25}
//     width="100%"
//     height="100%"
//   />

import React, { useEffect, useRef, useState } from "react";
import { sceneDprCap } from "@/app/lib/device";
import { releaseCanvasContext } from "@/app/lib/webglContexts";
import { isPhoneDevice } from "@/app/lib/device";

export interface WebGLTextTunnelProps {
  text?: string;
  /**
   * Multiple texts: stacked in order onto the scrolling strip, one band each,
   * so they loop through the tunnel in sequence (while one is readable at the
   * centre, the next is already entering distorted from the top). Overrides
   * `text`. Add more entries and they simply join the loop.
   */
  texts?: string[];
  /** Freeze the scroll (rendering continues) — e.g. while hovered. */
  paused?: boolean;
  /**
   * Stop drawing entirely — for when the canvas is covered or faded out. The
   * GL context and textures are kept, so resuming is instant; only the
   * per-frame draw is skipped, freeing the GPU/main thread for whatever is on
   * top. Different from `paused`, which keeps rendering a frozen image.
   */
  suspended?: boolean;
  /** Fires when the band at the screen centre changes (index into `texts`). */
  onBandChange?: (index: number) => void;
  font?: string;
  fontWeight?: number | string;
  /** Text size in px on the strip texture (reference default: 60). */
  fontSize?: number;
  /** Line height as a multiple of fontSize (reference default: 1.2). */
  lineHeight?: number;
  /** Letter spacing in px. */
  letterSpacing?: number;
  textColor?: string;
  background?: string;
  /** Vertical gap (px) between repeated text bands. */
  gap?: number;
  /** Scroll speed, 0–100 (% of one band per second at 100). */
  animationSpeed?: number;
  /** Horizontal edge expansion, 0–100. */
  stretchX?: number;
  /** Vertical tunnel depth at the edges, 0–100. */
  stretchY?: number;
  /** How sharply the distortion is confined to the edges, 0–100. */
  falloff?: number;
  /** Glow intensity, 0–100. */
  bloom?: number;
  /** Spectral fringe amount, 0–100. */
  chromatic?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// All wrap math is done with mod() in-shader, so plain CLAMP_TO_EDGE NPOT
// textures work fine in WebGL1.
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;      // text strip (bg baked in)
uniform sampler2D uGlowTex;  // pre-blurred copy of the strip
uniform float uTime;         // scroll position, in bands
uniform float uRepeatY;      // how many bands fit in the viewport
uniform float uOpaque;       // 1 = solid background, 0 = composite over page
uniform float uStretchX;     // 0..100
uniform float uStretchY;     // 0..100
uniform float uFalloff;      // 0..100
uniform float uBloom;        // 0..100
uniform float uChroma;       // 0..100

// Zuhayr brand ramp for the chromatic fan — replaces the old pure R/G/B
// rainbow so the aberration fringes read on-brand. Spans a WIDE spread of red
// hues (hot ember -> scarlet -> brand red -> crimson -> deep maroon): the
// earlier ramp sat entirely in the dark half, so averaging the 8 samples
// collapsed it back to a muddy near-grey and the effect barely registered.
vec3 brandChroma(float t) {
  vec3 c0 = vec3(1.0000, 0.4118, 0.1176); // #FF691E  ember
  vec3 c1 = vec3(1.0000, 0.1373, 0.0588); // #FF230F  hot red
  vec3 c2 = vec3(0.9412, 0.0196, 0.0706); // #F00512  scarlet
  vec3 c3 = vec3(0.7686, 0.0039, 0.0510); // #C4010D  brand red
  vec3 c4 = vec3(0.6039, 0.0000, 0.1216); // #9A001F  crimson
  vec3 c5 = vec3(0.3765, 0.0000, 0.1490); // #600026  deep maroon
  float x = clamp(t, 0.0, 1.0) * 5.0;
  if (x < 1.0) return mix(c0, c1, x);
  if (x < 2.0) return mix(c1, c2, x - 1.0);
  if (x < 3.0) return mix(c2, c3, x - 2.0);
  if (x < 4.0) return mix(c3, c4, x - 3.0);
  return mix(c4, c5, x - 4.0);
}

void main() {
  float relY = vUv.y - 0.5;

  // Edge mask: 0 at the vertical centre, 1 at the top/bottom edges. Higher
  // falloff → higher exponent → distortion hugs the edges more tightly.
  float expo = mix(1.2, 12.0, uFalloff / 100.0);
  float mask = clamp(pow(abs(relY) * 2.0, expo), 0.0, 1.0);

  // Horizontal expansion near the edges (texture x compressed → text widens).
  float xExpand = 1.0 + mask * (uStretchX / 100.0) * 10.0;
  float wx = (vUv.x - 0.5) / xExpand + 0.5;

  // Vertical tunnel depth: edge bands squash together toward the pinch.
  float depth = mask * (uStretchY / 100.0) * 15.0;
  float wy = relY / (1.0 + depth);
  float texY = mod(wy * uRepeatY + uTime + 0.5, 1.0);

  // Brand chromatic aberration: 8 samples fanned along Y, each tinted with a
  // stop from the brand ramp (ember -> deep maroon) instead of an R/G/B
  // rainbow. The spatial offset separates the stops into coloured fringes at
  // the pinch; strongest at the edges. The fan is wide enough that adjacent
  // stops land on different parts of the glyph — a narrow fan just resamples
  // the same pixel eight times and averages the colour away.
  float chroma = (uChroma / 100.0) * 0.09 * mask;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float t = float(i) / 7.0;
    float off = (t - 0.5) * chroma * 2.0;
    float sy = mod((wy + off) * uRepeatY + uTime + 0.5, 1.0);
    vec3 s = texture2D(uTex, vec2(wx, sy)).rgb;
    acc += s * brandChroma(t);
  }
  // The ramp averages ~0.78 red / ~0.10 green-blue, so a plain /8 also dims
  // the fringe by ~22%. Renormalise against that mean: the fringe keeps the
  // strip's brightness and spends it on saturation instead.
  vec3 fringe = acc / 8.0 * 1.28;

  // Keep the reading centre legible (near-white where the text straightens
  // out, mask ~0) and let the brand tint take over toward the warped pinch
  // (mask ~1), so the "chroma" now glows on-brand instead of rainbow. The tint
  // rides a softer curve than the geometric warp so red is already showing
  // well before the pinch, where there's still readable glyph to colour.
  vec3 base = texture2D(uTex, vec2(wx, texY)).rgb;
  float tint = pow(mask, 0.55);
  vec3 col = mix(base, fringe, tint);

  // Extra on-brand bleed, keyed to glyph luminance so it lights the type and
  // not the empty strip between bands. Green/blue stay near zero, so this
  // deepens the red rather than washing the warped rows out to white.
  float glyph = dot(base, vec3(0.299, 0.587, 0.114));
  col += vec3(0.95, 0.05, 0.12) * glyph * tint * (uChroma / 100.0) * 0.85;

  // Bloom: blurred-texture aura + luminance highlights, centre-biased. It is
  // multiplied by the same tint, because at these intensities the glow alone
  // pushes the warped rows past 1.0 — untinted it clipped them back to white
  // and erased the colour the aberration had just put there. Tinted, they clip
  // toward hot red instead and the hue survives the blow-out.
  float rawBloom = uBloom / 100.0;
  float bloomI = rawBloom * rawBloom * 0.25;
  vec3 result = col;
  if (bloomI > 0.0) {
    vec2 tc = vec2(wx, texY);
    float n = fract(sin(dot(tc, vec2(12.9898, 78.233))) * 43758.5453);
    vec2 jitter = (vec2(n) - 0.5) * 0.002 * bloomI;
    vec3 blurred = texture2D(uGlowTex, tc + jitter).rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float centerBias = mix(0.4, 1.0, 1.0 - mask);
    vec3 glowTint = mix(vec3(1.0), vec3(1.0, 0.18, 0.24), tint);
    vec3 highlights =
      col * pow(max(lum, 0.0), 1.1) * bloomI * 22.0 * centerBias * glowTint;
    vec3 aura = blurred * bloomI * 12.0 * centerBias * glowTint;
    result = col + highlights + aura;
  }

  // Opaque mode paints alpha 1. Transparent mode outputs premultiplied
  // "light" (alpha = brightest channel) so the glowing text composites
  // over whatever the page renders behind the canvas.
  float a = mix(clamp(max(result.r, max(result.g, result.b)), 0.0, 1.0), 1.0, uOpaque);
  gl_FragColor = vec4(result, a);
}
`;

/**
 * Draw the text strip (one band per text: text block + gap, uniform height so
 * the repeat math stays exact) and a pre-blurred glow copy. Background is
 * baked in so the shader composites nothing.
 */
function makeStripTextures(opts: {
  texts: string[];
  font: string;
  fontWeight: number | string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textColor: string;
  background: string;
  gap: number;
  widthPx: number;
}): {
  strip: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  bandPx: number;
  bandCount: number;
} | null {
  const {
    texts,
    font,
    fontWeight,
    fontSize,
    lineHeight,
    letterSpacing,
    textColor,
    background,
    gap,
    widthPx,
  } = opts;

  const bandCount = Math.max(texts.length, 1);
  const lineH = fontSize * lineHeight;
  const maxLines = texts.reduce((m, t) => Math.max(m, t.split("\n").length), 1);
  const bandPx = Math.max(lineH * maxLines + gap, 1);

  const w = Math.max(Math.round(widthPx), 1);
  const h = Math.max(Math.round(bandPx * bandCount), 1);

  const strip = document.createElement("canvas");
  strip.width = w;
  strip.height = h;
  const ctx = strip.getContext("2d");
  if (!ctx) return null;

  // "transparent" leaves the strip unfilled so the page shows through the
  // canvas (the shader then emits premultiplied light instead of alpha 1).
  if (background !== "transparent") {
    ctx.fillStyle = background;
    ctx.fillRect(-2, -2, w + 4, h + 4);
  }
  ctx.font = `${fontWeight} ${fontSize}px ${font}`;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${letterSpacing}px`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = textColor;
  // Bands are laid out in natural order (texts[0] in the top block). With
  // the flipped GPU upload (UNPACK_FLIP_Y_WEBGL) and time running backwards
  // through the strip, texts[0] is centred first and each next text RISES
  // in from the bottom — the tunnel scrolls bottom → top in array order.
  texts.forEach((t, ti) => {
    const lines = t.split("\n");
    const bandTop = ti * bandPx;
    const blockTop = bandTop + (bandPx - lineH * lines.length) / 2;
    lines.forEach((line, li) => {
      ctx.fillText(line, w / 2, blockTop + lineH * (li + 0.5));
    });
  });

  // Glow copy: the strip stacked at increasing blur radii.
  const glow = document.createElement("canvas");
  glow.width = w;
  glow.height = h;
  const gctx = glow.getContext("2d");
  if (gctx) {
    gctx.filter = "blur(3px)";
    gctx.globalAlpha = 1;
    gctx.drawImage(strip, 0, 0);
    gctx.filter = "blur(8px)";
    gctx.globalAlpha = 0.7;
    gctx.drawImage(strip, 0, 0);
    gctx.filter = "blur(20px)";
    gctx.globalAlpha = 0.4;
    gctx.drawImage(strip, 0, 0);
  }

  return { strip, glow, bandPx, bandCount };
}

export default function WebGLTextTunnel({
  text = "designed imperfect.",
  texts,
  paused = false,
  suspended = false,
  onBandChange,
  font = "Inter, system-ui, sans-serif",
  fontWeight = 700,
  fontSize = 60,
  lineHeight = 1.2,
  letterSpacing = 0,
  textColor = "#FFFFFF",
  background = "#000000",
  gap = 100,
  animationSpeed = 20,
  stretchX = 30,
  stretchY = 50,
  falloff = 50,
  bloom = 30,
  chromatic = 25,
  width = 400,
  height = 400,
  className,
  style,
}: WebGLTextTunnelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  // Element CSS size — texture strip width tracks it (state so the texture
  // rebuild effect reruns; the reference rebuilds on resize too).
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [glFailed, setGlFailed] = useState(false);
  // How many text bands the strip currently holds (drives repeat/time math).
  const bandCountRef = useRef(1);

  // The texts on the strip, as a JSON key: keeps effect deps stable across
  // re-renders that pass a fresh (but identical) array, and round-trips
  // losslessly back to the array inside the texture effect.
  const listKey = JSON.stringify(texts && texts.length ? texts : [text]);

  // Live copy of the per-frame "feel" props, read inside the render loop.
  const propsRef = useRef({
    animationSpeed,
    stretchX,
    stretchY,
    falloff,
    bloom,
    chromatic,
    paused,
    suspended,
  });
  useEffect(() => {
    propsRef.current = {
      animationSpeed,
      stretchX,
      stretchY,
      falloff,
      bloom,
      chromatic,
      paused,
      suspended,
    };
  }, [
    animationSpeed,
    stretchX,
    stretchY,
    falloff,
    bloom,
    chromatic,
    paused,
    suspended,
  ]);

  const onBandChangeRef = useRef(onBandChange);
  useEffect(() => {
    onBandChangeRef.current = onBandChange;
  }, [onBandChange]);

  // ── GL context + render loop (once) ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      // A full-screen quad: multisampling smooths edges it does not have,
      // and on a phone costs ~4x the framebuffer memory (see device.ts).
      antialias: !isPhoneDevice(),
      alpha: true,
      premultipliedAlpha: true,
    });
    if (!gl) {
      setGlFailed(true); // capability probe failed — swap to the non-GL fallback
      return;
    }
    glRef.current = gl;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        console.error(gl.getShaderInfoLog(s));
      return s;
    };

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const names = [
      "uTex",
      "uGlowTex",
      "uTime",
      "uRepeatY",
      "uStretchX",
      "uStretchY",
      "uFalloff",
      "uBloom",
      "uChroma",
      "uOpaque",
    ];
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const n of names) u[n] = gl.getUniformLocation(prog, n);
    uniformsRef.current = u;
    gl.uniform1i(u.uTex, 0);
    gl.uniform1i(u.uGlowTex, 1);

    // Track the element's CSS size → backing store + strip rebuild trigger.
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        setSize({ w, h });
        const dpr = Math.min(window.devicePixelRatio || 1, sceneDprCap());
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    });
    ro.observe(canvas);

    // Scroll position in BANDS (one band = one text + gap). Band units keep
    // the visual speed identical no matter how many texts are on the strip.
    let timeBands = 0;
    let lastIdx = -1;
    let last = performance.now();
    // Off screen, the loop stops outright. It used to run for the whole
    // visit — a full-viewport shader pass every frame while the reader was
    // anywhere on the page, the only scene here with no off-screen gate.
    // The clock is held while it is stopped, so the strip resumes where it
    // left off.
    let onScreen = true;
    let wake = 0;
    const render = (now: number) => {
      if (!onScreen) {
        rafRef.current = 0;
        if (!wake) wake = window.setTimeout(poll, 250);
        return;
      }
      const dt = (now - last) / 1000;
      last = now;
      // While the fullscreen nav menu is open this canvas sits behind its
      // backdrop-blur overlay; any animated frame under a backdrop-filter
      // forces the browser to re-blur the whole viewport. Hold the last
      // frame (and the clock) until the menu closes.
      if (document.body.classList.contains("menu-open")) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      // Covered or faded out — skip the draw entirely and hand the frame budget
      // to whatever is on top. Textures and context are kept, so resuming costs
      // nothing; the clock is held so the strip resumes where it left off.
      if (propsRef.current.suspended) {
        last = now;
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      const p = propsRef.current;
      if (!p.paused) timeBands += dt * (p.animationSpeed / 100);
      const n = bandCountRef.current;

      // uTime is in whole-texture units, decreasing so the strip scrolls
      // bottom → top; the offset centres texts[0] at t=0.
      gl.uniform1f(u.uTime, 0.5 - (timeBands + 0.5) / n);
      gl.uniform1f(u.uStretchX, p.stretchX);
      gl.uniform1f(u.uStretchY, p.stretchY);
      gl.uniform1f(u.uFalloff, p.falloff);
      gl.uniform1f(u.uBloom, p.bloom);
      gl.uniform1f(u.uChroma, p.chromatic);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Which text is at the screen centre? Switches at the seam between
      // bands (halfway through the gap), the natural crossfade point.
      const idx = Math.floor((((timeBands % n) + n) % n) + 0.5) % n;
      if (idx !== lastIdx) {
        lastIdx = idx;
        onBandChangeRef.current?.(idx);
      }
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    // While stopped, a rect read four times a second. IntersectionObserver
    // does not report the move from touching the viewport's edge to being
    // inside it (the ratio sits on its lowest threshold both times), so on
    // some engines the loop could stop under the hero and never restart —
    // the services' names vanished on the client's iPhone.
    const poll = () => {
      wake = 0;
      if (onScreen || rafRef.current) return;
      const r = canvas.getBoundingClientRect();
      if (r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) {
        onScreen = true;
        last = performance.now();
        rafRef.current = requestAnimationFrame(render);
      } else {
        wake = window.setTimeout(poll, 250);
      }
    };

    // Any of it actually showing — not merely touching the viewport's
    // edge, which isIntersecting also counts: sitting exactly under the
    // hero, this ran a full-viewport pass at the top of the page for zero
    // visible pixels.
    const vis = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting && entry.intersectionRect.height > 0;
        if (onScreen && !rafRef.current) {
          last = performance.now();
          rafRef.current = requestAnimationFrame(render);
        }
      },
      { rootMargin: "0px", threshold: [0, 0.02] },
    );
    vis.observe(canvas);

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      window.clearTimeout(wake);
      vis.disconnect();
      ro.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      glRef.current = null;
      // Unmounted (released for memory on a phone): give the context back.
      releaseCanvasContext(canvas);
    };
  }, []);

  // ── Strip textures: rebuild when the texts / type / colours / size change ──
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || size.w === 0 || size.h === 0) return;

    const made = makeStripTextures({
      texts: JSON.parse(listKey) as string[],
      font,
      fontWeight,
      fontSize,
      lineHeight,
      letterSpacing,
      textColor,
      background,
      gap,
      widthPx: size.w,
    });
    if (!made) return;
    bandCountRef.current = made.bandCount;

    const upload = (unit: number, canvas2d: HTMLCanvasElement) => {
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // Canvas rows are top-first but GL samples bottom-up — flip on upload
      // so the text isn't rendered upside down. Premultiply so transparent
      // strips carry glyph coverage in RGB (no white fringes at glyph edges).
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
      // NPOT-safe: wrap handled with mod() in the shader.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return tex;
    };
    const stripTex = upload(0, made.strip);
    const glowTex = upload(1, made.glow);

    // uRepeatY is in whole-texture units: with N bands on the strip, the
    // per-band on-screen size stays the same regardless of N.
    gl.uniform1f(
      uniformsRef.current.uRepeatY,
      size.h / (made.bandPx * made.bandCount),
    );
    gl.uniform1f(
      uniformsRef.current.uOpaque,
      background === "transparent" ? 0 : 1,
    );

    // Each run owns its textures — freed when the strip rebuilds or unmounts.
    return () => {
      gl.deleteTexture(stripTex);
      gl.deleteTexture(glowTex);
    };
  }, [
    listKey,
    font,
    fontWeight,
    fontSize,
    lineHeight,
    letterSpacing,
    textColor,
    background,
    gap,
    size,
  ]);

  // Graceful fallback — no WebGL: plain centred text over the background.
  if (glFailed) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background,
          color: textColor,
          fontFamily: font,
          fontWeight: fontWeight as React.CSSProperties["fontWeight"],
          fontSize,
          whiteSpace: "pre-wrap",
          overflow: "hidden",
          ...style,
        }}
      >
        {texts && texts.length ? texts[0] : text}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height, display: "block", background, ...style }}
    />
  );
}
