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
  // object-fit: contain maps uv OUTSIDE 0..1 — those are the letterbox bars.
  // Without this they would sample the clamped edge pixel and smear it across
  // the bars instead of leaving them empty.
  if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) {
    gl_FragColor = vec4(0.0);
    return;
  }
  gl_FragColor = texture2D(uTex, suv);
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
    let engaged = false;
    // The inline opacity the image had before we hid it. Restoring "" instead
    // would fall back to the stylesheet, and the works-rail lightbox declares
    // `opacity: 0` there (it stays hidden until its FLIP reveals it) — so
    // blanking the inline value made the picture vanish on mouse-out.
    let prevOpacity = "";

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
      // COMPUTED, not the inline value. The scroll parallax writes an inline
      // transform on the image, but once a card is Flipped into the content
      // panel gallery.css overrides it with `transform: none !important` — so
      // the image ignores its own inline value while a canvas copying that
      // value obeyed it, shunting the ripple half a width to the left and
      // clipping it. The computed style is what is actually being applied.
      const cs = getComputedStyle(img);
      canvas.style.transform = cs.transform === "none" ? "" : cs.transform;
      canvas.style.transformOrigin = cs.transformOrigin;
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

      // Reproduce the element's own `object-fit` in UV space, reading it rather
      // than assuming. Both fits matter here: the works-rail images use cover,
      // while the gallery's use contain (gallery.css). Hard-coding cover looked
      // identical in the grid — square art in a square box — but the expanded
      // panel is 16:9, where cover crops exactly what contain letterboxes, so
      // the enlarged picture came out cut off.
      const iw = img.naturalWidth || w;
      const ih = img.naturalHeight || h;
      const boxAspect = w / h;
      const imgAspect = iw / ih;
      const wide = boxAspect > imgAspect;
      const contain = getComputedStyle(img).objectFit === "contain";
      const k = contain
        ? wide
          ? [boxAspect / imgAspect, 1] // bars left/right
          : [1, imgAspect / boxAspect] // bars top/bottom
        : wide
          ? [1, imgAspect / boxAspect] // cover: crop vertically
          : [boxAspect / imgAspect, 1]; // cover: crop horizontally
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
        disengage();
        return;
      }
      raf = requestAnimationFrame(render);
    };

    const start = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };

    /**
     * Hand the picture over to the canvas.
     *
     * Deliberately NOT triggered by pointerenter. An element can arrive under a
     * perfectly stationary cursor — the gallery Flips a card back into the grid
     * right under the pointer when a panel closes — and `pointerenter` fires
     * then just as it would for a real hover. Hiding the <img> at that instant
     * handed the picture to a canvas that had not been sized against the
     * element's post-Flip box yet, so the result was nothing visible at all.
     * Requiring genuine pointer movement means the swap only ever happens while
     * the cursor is actually travelling across the picture, which is also the
     * only time the ripple has anything to follow.
     */
    const engage = (): boolean => {
      if (engaged) return true;
      if (!init()) {
        // A lazily-loaded image isn't decodable yet, so there is nothing to
        // upload. Retry the moment it lands rather than staying dead until the
        // visitor happens to hover a second time.
        if (!img.complete) {
          img.addEventListener("load", () => hovering && engage(), {
            once: true,
          });
        }
        return false;
      }
      engaged = true;
      sizeCanvas();
      // Paint BEFORE swapping. Showing a freshly-created canvas and hiding the
      // image in the same tick left an empty (black/blank) canvas on screen
      // until the next animation frame — the flash on first hover.
      paint();
      canvas!.style.opacity = "1";
      // Hide the DOM image so the canvas copy isn't drawn twice.
      // "0" is never a legitimate resting value — it can only be this hook's
      // own hidden state leaking back in — so refuse to adopt it as the value
      // to restore.
      const current = img.style.opacity;
      prevOpacity = current === "0" ? "" : current;
      img.style.opacity = "0";
      start();
      return true;
    };

    /** Give the picture back to the <img>. Safe to call when not engaged. */
    const disengage = () => {
      if (!engaged) return;
      engaged = false;
      if (canvas) canvas.style.opacity = "0";
      img.style.opacity = prevOpacity;
    };

    /**
     * Hit-tested from the window rather than bound to the <img>.
     *
     * Listening on the image itself only works while the image is the topmost
     * thing under the cursor. In the expanded gallery panel it is not: the
     * content wrapper deliberately stacks its text over the picture and puts
     * `.image_container` at z-index -1, so pointer events land on the wrapper
     * and the image never hears them — the splash simply did not run there.
     * Window-level events with a bounds check are indifferent to stacking, and
     * equally indifferent to the host being physically moved between the grid
     * and the panel.
     */
    const onWindowMove = (e: PointerEvent) => {
      const r = img.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const x = (e.clientX - r.left) / r.width;
      const y = 1 - (e.clientY - r.top) / r.height; // GL origin is bottom-left
      const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;

      if (!inside) {
        if (hovering) {
          hovering = false;
          lastSpawn = { x: -9, y: -9 };
          start(); // keep drawing until the remaining ripples decay
        }
        return;
      }

      hovering = true;
      if (!engage()) return;
      const dx = x - lastSpawn.x;
      const dy = y - lastSpawn.y;
      if (Math.hypot(dx, dy) < SPLASH.spawnDistance) return;
      lastSpawn = { x, y };
      ripples.push({ x, y, born: performance.now() / 1000 });
      if (ripples.length > MAX_RIPPLES) ripples.shift();
      start();
    };

    // Listeners go on the IMG, not the host. The gallery's picture is only 88%
    // of its container and the lightbox's host is a full-viewport overlay, so
    // host-level hover would arm the effect well outside the actual artwork.
    // opacity:0 does not affect hit-testing, so these keep firing while the
    // image is hidden behind the canvas.
    window.addEventListener("pointermove", onWindowMove, { passive: true });
    // Any change to the picture's box re-measures the canvas — and, if the
    // canvas currently owns the picture, hands it straight back.
    //
    // The gallery physically MOVES this host into the content panel when a card
    // is opened (wrapper.appendChild in gallery-animations), which resizes it
    // from a small grid card to the full panel. A canvas engaged at that moment
    // would carry on drawing at the old size — the narrow, hard-cropped slice
    // that appeared where the expanded picture should have been. Yielding on
    // any resize means the real <img> is always what shows during a layout
    // change, and the next cursor movement re-engages against the new geometry.
    // The effect is never switched off, only ever momentarily handed back.
    const ro = new ResizeObserver(() => {
      if (engaged) disengage();
      sizeCanvas();
    });
    ro.observe(img);
    ro.observe(host);

    return () => {
      destroyed = true;
      window.removeEventListener("pointermove", onWindowMove);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      // Only restores if we actually took the picture over, so tearing down an
      // idle hook can never write an opacity the element never had.
      disengage();
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
