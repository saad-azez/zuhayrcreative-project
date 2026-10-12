"use client";

import { useEffect, useRef, useState } from "react";
import { useSceneLease } from "@/app/animations/hooks/useNearViewport";
import { isPhoneDevice, sceneDprCap } from "@/app/lib/device";
import { releaseCanvasContext } from "@/app/lib/webglContexts";

/**
 * The marble seam — the services → gallery transition, after scrolltide's
 * "Marble Scroll" (client's reference: Screen Recording 2026-10-10 220246).
 *
 * ── What the reference does ──
 * Full-bleed pictures, and between them a seam that TEARS: a ragged front
 * travels up the screen with the scroll; behind it, a strip about a quarter
 * of the screen tall where the outgoing picture is cut into uneven vertical
 * columns, each dropped by its own amount (rectangular steps along the
 * edge), the picture inside melting downward into marbled drips and swirls;
 * ahead of it, a few loose rectangular fragments. Fast scrolling tears
 * hardest; as the scroll slows, everything settles clean.
 *
 * ── What this is ──
 * Our sections are live HTML, which a shader cannot melt. So the torn
 * material is a SHEET of marbled brand ramp (the pixel curtain's six
 * stops) that exists only along the boundary: solid at the torn front,
 * fading to nothing a little above it, with see-through pockets in the
 * marble — the transparent version of the old grid wipe. It rides the
 * boundary itself: a zero-height anchor sits between the two sections and
 * the canvas band hangs off it, so it scrolls with the page, frame for
 * frame, with no spacer and no curtain, and the page is never moved.
 *
 * ── Cost ──
 * One WebGL context, built on approach and released when far (useSceneLease
 * — the same lease the footer's scenes hold, GPU check included), handed
 * back to the page's budget on unmount (releaseCanvasContext), and drawn
 * only while the band is on screen. Phones draw at 1x with fewer octaves.
 * Reduced motion gets no shader: a soft band of the ramp, still.
 */

/** How far the band reaches above and below the boundary, in vh. */
const BAND_UP_VH = 45;
const BAND_DOWN_VH = 25;

const BRAND_RAMP = ["#C4010D", "#930008", "#860004", "#800020", "#470015", "#38000E"];

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const frag = (lite: boolean) => `
precision highp float;
uniform vec2  u_res;      // drawing-buffer px
uniform float u_vh;       // one viewport height, in drawing-buffer px
uniform float u_up;       // the boundary's distance from the band's top, buffer px
uniform float u_time;
uniform float u_vel;      // scroll speed, 0..1, smoothed
uniform float u_dir;      // last direction of travel: 1 down, -1 up
uniform vec3  u_ramp[6];

#define OCT ${lite ? 3 : 5}

float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x),
             mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < OCT; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0) * 5.0;
  vec3 c = u_ramp[0];
  for (int i = 0; i < 5; i++) c = mix(c, u_ramp[i + 1], clamp(t - float(i), 0.0, 1.0));
  return c;
}

void main() {
  // Band coordinates in viewport heights: x across, s down from the
  // boundary (negative above it), so the look is the same at any size.
  vec2 px = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  float xn = px.x / u_vh;
  float s = (px.y - u_up) / u_vh;
  float v = u_vel;
  float t = u_time;

  // ── The columns: uneven widths, each dropped by its own amount ──
  // Six to fourteen across the screen, as in the reference — about eleven on
  // a laptop, six on a phone held upright; a warp in x makes the widths
  // uneven. Scrolling up, they are lifted instead of dropped.
  float aspect = u_res.x / u_vh;
  float cols = clamp(aspect * 7.0, 6.0, 14.0) / aspect;
  float c = floor(xn * cols + 0.9 * noise(vec2(xn * 1.4, 3.1)));
  float hc = hash1(c + 1.0);
  float drop = (0.012 + 0.10 * v) * (hc - 0.25) * u_dir;
  // A slice or two within a column slips further (the reference's steps).
  float slice = floor((s - drop) / 0.075 + hc * 7.0);
  float hs = hash2(vec2(c, slice));
  drop += step(0.82, hs) * (0.02 + 0.06 * v) * u_dir;
  float sy = s - drop;

  // ── The torn front ──
  // Ragged at two scales, drifting slowly; drips hang from it, longer when
  // the scroll is fast.
  float front = 0.10 * (fbm(vec2(xn * 1.8, t * 0.04)) - 0.5)
              + 0.035 * (fbm(vec2(xn * 9.0, 4.0 + t * 0.07)) - 0.5);
  float drip = pow(noise(vec2(xn * 16.0, 2.0)), 7.0) * (0.05 + 0.16 * v);
  front += drip * u_dir;
  float d = front - sy;               // > 0 inside the sheet

  // ── The marble: domain-warped, stretched downward near the front (the melt)
  float melt = 1.0 + (1.5 + 3.0 * v) * (1.0 - smoothstep(0.0, 0.22, d));
  vec2 q = vec2(xn * 1.6, sy * 1.6 / melt);
  float w1 = fbm(q * 2.2 + vec2(0.0, t * 0.03));
  float w2 = fbm(q * 2.2 + 3.5 * vec2(w1, w1 * 0.7) + vec2(1.7, 9.2) + v * 0.6);
  float m = fbm(q * 1.8 + 3.8 * vec2(w2, w2 * 1.3));

  vec3 col = ramp(1.0 - m * 1.25);
  // Veins: the marble's pale seams.
  float vein = 1.0 - smoothstep(0.0, 0.035, abs(w2 - 0.52));
  col = mix(col, vec3(1.0, 0.78, 0.74), vein * 0.32);
  // A darker lip right at the tear.
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.018, d));

  // ── How much of the sheet there is ──
  // Crisp along the tear, fading out above the strip, with see-through
  // pockets in the marble so the section shows through.
  float sheet = smoothstep(0.0, 0.004, d);
  float strip = 1.0 - smoothstep(0.12 + 0.06 * v, 0.40, d);
  float pocket = mix(0.35, 1.0, smoothstep(0.32, 0.58, m));
  pocket = mix(pocket, 1.0, 1.0 - smoothstep(0.0, 0.08, d)); // solid at the lip
  float a = sheet * strip * pocket;
  // Missing blocks in the strip, more of them torn out when fast.
  float bh = hash2(vec2(c, floor(sy / 0.05)));
  a *= 1.0 - step(1.0 - (0.04 + 0.12 * v), bh) * (1.0 - smoothstep(0.0, 0.05, d)) ;

  // ── Loose fragments ahead of the tear ──
  float ahead = -d;
  if (ahead > 0.0) {
    float row = floor(s / 0.045);
    float fh = hash2(vec2(c * 1.7, row));
    float density = (0.05 + 0.22 * v) * (1.0 - smoothstep(0.0, 0.12 + 0.08 * v, ahead));
    float frag = step(1.0 - density, fh);
    a = max(a, frag * 0.88);
  }

  a *= 0.94;
  gl_FragColor = vec4(col * a, a);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export default function MarbleSeam() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const near = useSceneLease(anchorRef, { label: "Marble seam" });
  const [still] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  return (
    // The anchor: zero height, exactly on the boundary between the sections.
    <div ref={anchorRef} aria-hidden className="relative w-full" style={{ height: 0 }}>
      {still ? (
        <div
          className="pointer-events-none absolute inset-x-0"
          style={{
            top: `-${BAND_UP_VH * 0.4}vh`,
            height: `${BAND_UP_VH * 0.4 + BAND_DOWN_VH * 0.4}vh`,
            zIndex: 30,
            background:
              "linear-gradient(to bottom, rgba(196,1,13,0) 0%, rgba(147,0,8,0.28) 55%, rgba(56,0,14,0) 100%)",
          }}
        />
      ) : (
        near && <MarbleCanvas />
      )}
    </div>
  );
}

function MarbleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const lite = isPhoneDevice();
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag(lite)));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = U("u_res"), uVh = U("u_vh"), uUp = U("u_up"), uTime = U("u_time");
    const uVel = U("u_vel"), uDir = U("u_dir");
    gl.uniform3fv(U("u_ramp"), new Float32Array(BRAND_RAMP.flatMap(hexToRgb)));
    gl.clearColor(0, 0, 0, 0);

    const dprCap = lite ? 1 : Math.min(1.5, sceneDprCap());
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      const vh = window.innerHeight * dpr;
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uVh, vh);
      gl.uniform1f(uUp, (BAND_UP_VH / 100) * vh);
    };
    size();

    // ── Scroll speed ──
    // Screens per second, read off the page every frame; up fast, down slow,
    // so a flick tears at once and the sheet settles over half a second.
    let lastY = window.scrollY;
    let lastT = performance.now();
    let vel = 0;
    let dir = 1;
    let visible = false;
    let raf = 0;
    const t0 = performance.now();
    const frame = () => {
      raf = 0;
      if (!visible || gl.isContextLost()) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastT) / 1000;
      const y = window.scrollY;
      const speed = Math.abs(y - lastY) / window.innerHeight / dt;
      if (y !== lastY) dir = y > lastY ? 1 : -1;
      lastY = y;
      lastT = now;
      const target = Math.min(1, speed / 2.2);
      vel += (target - vel) * (target > vel ? 0.35 : 1 - Math.exp(-dt * 3.2));
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.uniform1f(uVel, vel);
      gl.uniform1f(uDir, dir);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    };

    // Drawn only while the band is on screen.
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) {
        lastY = window.scrollY;
        lastT = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(canvas);
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    const onLost = (e: Event) => e.preventDefault();
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", onLost);
      releaseCanvasContext(canvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-x-0"
      style={{
        top: `-${BAND_UP_VH}vh`,
        height: `${BAND_UP_VH + BAND_DOWN_VH}vh`,
        width: "100%",
        zIndex: 30,
      }}
    />
  );
}
