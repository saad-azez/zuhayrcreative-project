"use client";

/**
 * Cursor "splash" on image hover — a water-ripple displacement that follows the
 * pointer across the picture, in the spirit of fromanother.love.
 *
 * Shape of the solution: this is a HOOK, not a wrapper component, and it never
 * touches the host markup. It finds the <img> inside the element you pass, lays
 * a canvas over it, and swaps which of the two is visible on hover. That matters
 * because the vertical gallery moves its <img> with GSAP Flip when a card is
 * opened — wrapping or replacing that element would break the Flip target.
 *
 * Cost: nothing runs until the first hover (no GL context, no texture upload),
 * and the loop stops again once the last ripple has died. Reduced-motion and
 * touch devices opt out entirely.
 *
 * ⚠️ The numbers in SPLASH are a first pass, tuned by eye. They are gathered in
 * one object precisely so they can be matched against the reference video
 * without touching the plumbing below.
 */

import { useEffect } from "react";

export const SPLASH = {
  /** How far the surface is pushed, in UV units. Bigger = deeper distortion. */
  amplitude: 0.045,
  /** Wave density inside one ripple. Bigger = more concentric rings. */
  frequency: 26,
  /** How fast a ring travels outward. */
  speed: 7.5,
  /** Seconds a ripple lives before it has fully decayed. */
  life: 1.1,
  /** How tightly a ripple hugs its origin. Bigger = smaller, sharper splash. */
  falloff: 5.2,
  /** RGB separation across the distortion, 0 disables it. */
  chroma: 0.55,
  /** Pointer travel (in UV units) between spawning ripples. */
  spawnDistance: 0.045,
} as const;

const MAX_RIPPLES = 12;

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uAspect;
// x, y = ripple origin in UV; z = age in seconds (negative = slot unused)
uniform vec3 uRipples[${MAX_RIPPLES}];
uniform float uAmp;
uniform float uFreq;
uniform float uSpeed;
uniform float uLife;
uniform float uFalloff;
uniform float uChroma;
// Reproduces object-fit: cover — crops the texture instead of squashing it.
uniform vec2 uUvScale;

void main() {
  vec2 uv = vUv;
  vec2 disp = vec2(0.0);

  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec3 r = uRipples[i];
    float age = r.z;
    if (age < 0.0 || age > uLife) continue;

    // Correct for the element's aspect so ripples stay circular, not oval.
    vec2 d = uv - r.xy;
    d.x *= uAspect;
    float dist = length(d);

    // A ring travelling outward (sin), fading with both distance from the
    // origin and the ripple's own age — the two envelopes together are what
    // makes it read as a splash settling rather than a pulsing circle.
    float ring = sin(dist * uFreq - age * uSpeed);
    float byDistance = exp(-dist * uFalloff);
    float byAge = 1.0 - (age / uLife);
    disp += normalize(d + 1e-6) * ring * byDistance * byAge * byAge * uAmp;
  }

  // Displace in the ELEMENT's uv space (so ripples land under the cursor),
  // then map through the cover crop to reach texture space.
  vec2 suv = (uv + disp - 0.5) * uUvScale + 0.5;
  vec4 base = texture2D(uTex, suv);
  if (uChroma > 0.0) {
    // Split the channels along the displacement, so the fringe only appears
    // where the surface is actually moving.
    float r = texture2D(uTex, suv + disp * uUvScale * uChroma).r;
    float b = texture2D(uTex, suv - disp * uUvScale * uChroma).b;
    gl_FragColor = vec4(r, base.g, b, base.a);
  } else {
    gl_FragColor = base;
  }
}
`;

interface Ripple {
  x: number;
  y: number;
  born: number;
}

/**
 * @param ref     element that CONTAINS the <img> to affect.
 * @param enabled pass false to opt a call site out (e.g. touch layouts).
 */
export function useSplashHover(
  ref: React.RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    const host = ref.current;
    if (!host || !enabled) return;
    if (typeof window === "undefined") return;
    // Needs a real pointer to follow, and honours reduced motion.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const img = host.querySelector("img");
    if (!img) return;

    let canvas: HTMLCanvasElement | null = null;
    let gl: WebGLRenderingContext | null = null;
    let prog: WebGLProgram | null = null;
    let tex: WebGLTexture | null = null;
    let uni: Record<string, WebGLUniformLocation | null> = {};
    let raf = 0;
    let ripples: Ripple[] = [];
    let hovering = false;
    let lastSpawn = { x: -9, y: -9 };
    let destroyed = false;

    /**
     * Park the canvas exactly on top of the <img>'s own box.
     *
     * Deliberately uses offsetLeft/Top/Width/Height — the LAYOUT box — not
     * getBoundingClientRect(). BCR already has every ancestor transform baked
     * in, and the canvas is a sibling inside those same transforms, so a
     * BCR-derived size gets scaled a second time (the wheel scales each item
     * every frame, and the picture visibly ballooned on hover).
     *
     * The <img> is also not simply filling its container: the gallery's
     * parallax absolutely-positions it at height:88%/width:auto and slides it
     * vertically on scroll. Filling the host instead of tracking the image is
     * what made the picture jump to a different position and stretch.
     */
    const syncTransform = () => {
      if (!canvas) return;
      // GSAP writes inline transforms, so this stays a cheap property read
      // rather than a layout-flushing getComputedStyle every frame.
      canvas.style.transform = img.style.transform || "";
      canvas.style.transformOrigin = img.style.transformOrigin || "";
    };

    const sizeCanvas = () => {
      if (!canvas || !gl) return;
      const w = img.offsetWidth || img.clientWidth;
      const h = img.offsetHeight || img.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.style.inset = "auto";
      canvas.style.left = `${img.offsetLeft}px`;
      canvas.style.top = `${img.offsetTop}px`;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      syncTransform();

      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uni.uAspect) gl.uniform1f(uni.uAspect, w / h);

      // Reproduce `object-fit: cover` in UV space. The wheel images use cover;
      // the gallery's are sized to their own aspect so this resolves to (1,1).
      // Without it a non-square source would be squashed instead of cropped —
      // another way the picture would appear to shift on hover.
      const iw = img.naturalWidth || w;
      const ih = img.naturalHeight || h;
      const boxAspect = w / h;
      const imgAspect = iw / ih;
      const k =
        boxAspect > imgAspect
          ? [1, imgAspect / boxAspect]
          : [boxAspect / imgAspect, 1];
      if (uni.uUvScale) gl.uniform2f(uni.uUvScale, k[0], k[1]);
    };

    /** Built lazily on the first hover — nothing costs anything before that. */
    const init = (): boolean => {
      if (gl) return true;
      if (!img.complete || img.naturalWidth === 0) return false;

      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      Object.assign(canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
        opacity: "0",
        // No fade. The canvas draws the same picture, so the swap is already
        // invisible once the first frame is painted — and a fade only created a
        // window where the image was hidden but the canvas wasn't yet opaque.
      } as CSSStyleDeclaration);

      // The canvas has to sit in the image's own box. If the host isn't a
      // containing block yet, make it one rather than leaving the overlay to
      // escape to some ancestor.
      const hostPos = getComputedStyle(host).position;
      if (hostPos === "static") host.style.position = "relative";
      host.appendChild(canvas);

      const ctx = canvas.getContext("webgl", {
        premultipliedAlpha: true,
        alpha: true,
        antialias: true,
      });
      if (!ctx) {
        canvas.remove();
        canvas = null;
        return false;
      }
      gl = ctx;

      const compile = (type: number, src: string) => {
        const s = gl!.createShader(type)!;
        gl!.shaderSource(s, src);
        gl!.compileShader(s);
        if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS))
          console.error(gl!.getShaderInfoLog(s));
        return s;
      };

      prog = gl.createProgram()!;
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

      for (const n of [
        "uTex",
        "uAspect",
        "uAmp",
        "uFreq",
        "uSpeed",
        "uLife",
        "uFalloff",
        "uChroma",
        "uUvScale",
      ])
        uni[n] = gl.getUniformLocation(prog, n);
      for (let i = 0; i < MAX_RIPPLES; i++)
        uni[`r${i}`] = gl.getUniformLocation(prog, `uRipples[${i}]`);

      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      } catch {
        // A cross-origin image without CORS headers taints the texture and
        // throws here. Degrade to the plain <img> for that one picture rather
        // than leaving a blank canvas over it — the effect is decorative and
        // must never be able to hide the artwork.
        gl.deleteTexture(tex);
        tex = null;
        canvas.remove();
        canvas = null;
        gl = null;
        return false;
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(uni.uTex, 0);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.uniform1f(uni.uAmp, SPLASH.amplitude);
      gl.uniform1f(uni.uFreq, SPLASH.frequency);
      gl.uniform1f(uni.uSpeed, SPLASH.speed);
      gl.uniform1f(uni.uLife, SPLASH.life);
      gl.uniform1f(uni.uFalloff, SPLASH.falloff);
      gl.uniform1f(uni.uChroma, SPLASH.chroma);
      sizeCanvas();
      return true;
    };

    /** One frame, drawn immediately. Split out of the loop so the very first
     *  frame can be painted synchronously before the canvas is ever shown. */
    const paint = () => {
      if (destroyed || !gl || !canvas) return;
      const now = performance.now() / 1000;
      ripples = ripples.filter((r) => now - r.born <= SPLASH.life);

      for (let i = 0; i < MAX_RIPPLES; i++) {
        const r = ripples[i];
        const loc = uni[`r${i}`];
        if (!loc) continue;
        if (r) gl.uniform3f(loc, r.x, r.y, now - r.born);
        else gl.uniform3f(loc, 0, 0, -1);
      }

      // The gallery parallax slides the <img> as the page scrolls, so re-copy
      // its transform every frame the overlay is up — otherwise the canvas
      // would sit still while the picture underneath drifted away from it.
      syncTransform();

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const render = () => {
      if (destroyed || !canvas) return;
      paint();
      // Once the pointer has left AND the water has settled, stop entirely and
      // hand the picture back to the plain <img>. With no ripples left the
      // canvas is pixel-identical to the image, so the swap back is invisible.
      if (!hovering && ripples.length === 0) {
        raf = 0;
        canvas.style.opacity = "0";
        img.style.opacity = "";
        return;
      }
      raf = requestAnimationFrame(render);
    };

    const start = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };

    const onEnter = () => {
      hovering = true;
      if (!init()) {
        // A lazily-loaded image isn't decodable yet, so there is nothing to
        // upload. Rather than silently doing nothing until the visitor happens
        // to hover a second time, retry the moment it lands.
        if (!img.complete) {
          img.addEventListener("load", () => hovering && onEnter(), {
            once: true,
          });
        }
        return;
      }
      sizeCanvas();
      // Paint BEFORE swapping. Showing a freshly-created canvas and hiding the
      // image in the same tick left an empty (black/blank) canvas on screen
      // until the next animation frame — the flash on first hover.
      paint();
      canvas!.style.opacity = "1";
      // Hide the DOM image so the canvas copy isn't drawn twice.
      img.style.opacity = "0";
      start();
    };

    const onMove = (e: PointerEvent) => {
      if (!gl || !canvas) return;
      const r = img.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = 1 - (e.clientY - r.top) / r.height; // GL origin is bottom-left
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      const dx = x - lastSpawn.x;
      const dy = y - lastSpawn.y;
      if (Math.hypot(dx, dy) < SPLASH.spawnDistance) return;
      lastSpawn = { x, y };
      ripples.push({ x, y, born: performance.now() / 1000 });
      if (ripples.length > MAX_RIPPLES) ripples.shift();
      start();
    };

    const onLeave = () => {
      hovering = false;
      lastSpawn = { x: -9, y: -9 };
      start(); // keep drawing until the remaining ripples decay
    };

    // Listeners go on the IMG, not the host. The gallery's picture is only 88%
    // of its container and the lightbox's host is a full-viewport overlay, so
    // host-level hover would arm the effect well outside the actual artwork.
    // opacity:0 does not affect hit-testing, so these keep firing while the
    // image is hidden behind the canvas.
    img.addEventListener("pointerenter", onEnter);
    img.addEventListener("pointermove", onMove);
    img.addEventListener("pointerleave", onLeave);
    const ro = new ResizeObserver(() => sizeCanvas());
    ro.observe(img);

    return () => {
      destroyed = true;
      img.removeEventListener("pointerenter", onEnter);
      img.removeEventListener("pointermove", onMove);
      img.removeEventListener("pointerleave", onLeave);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      img.style.opacity = "";
      if (gl) {
        if (tex) gl.deleteTexture(tex);
        if (prog) gl.deleteProgram(prog);
      }
      canvas?.remove();
      canvas = null;
      gl = null;
      uni = {};
    };
  }, [ref, enabled]);
}
