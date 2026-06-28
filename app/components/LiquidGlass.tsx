"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

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
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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

  // Anti-aliased shape mask.
  float aa   = 1.5;
  float mask = 1.0 - smoothstep(-aa, aa, d);
  if (mask <= 0.0) discard;

  // Normalised inward distance from the edge.
  float edge = clamp(-d / min(halfRes.x, halfRes.y), 0.0, 1.0);

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

  // ── Glass shell (refractive edge + glossy sheen) ───────────────────
  float rim  = pow(1.0 - edge, 2.4);
  float band = sin((vUv.x + vUv.y) * 3.14159 + iTime * 1.0);
  float spec = smoothstep(0.88, 1.0, band);
  // Crisp top glaze — bright glassy highlight near the upper edge.
  float glaze = smoothstep(0.82, 1.0, vUv.y) * pow(rim, 0.5);

  vec3 col = fcol;
  col += vec3(0.77, 0.05, 0.06) * rim * 0.5;        // deep-red refractive edge
  col += vec3(1.0)              * spec * 0.26 * edge; // glassy sheen
  col += vec3(1.0)              * glaze * 0.22;       // top glaze highlight

  float glassA = 0.08;                             // faint glass body
  float alpha = clamp(flame + rim * 0.45 + spec * 0.18 * edge + glaze * 0.25 + glassA, 0.0, 1.0) * mask;

  gl_FragColor = vec4(col, alpha);
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
}: LiquidGlassProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        premultipliedAlpha: false,
        powerPreference: "low-power",
      });
      if (!renderer.getContext()) throw new Error("No WebGL context");
    } catch {
      return; // graceful no-op; CSS backdrop-blur still renders
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const [tr, tg, tb] = hexToRgb(tint);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(1, 1) },
        uRadius: { value: radius },
        uDpr: { value: dpr },
        uTint: { value: new THREE.Vector3(tr, tg, tb) },
        uSweep: { value: 0 },
      },
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h, false);
      material.uniforms.iResolution.value.set(
        renderer.domElement.width,
        renderer.domElement.height,
      );
      renderer.render(scene, camera);
    };

    const ro = new ResizeObserver(setSize);
    ro.observe(container);
    setSize();

    let raf = 0;
    let isVisible = true;
    let isPageVisible = !document.hidden;
    const start = performance.now();

    const loop = (now: number) => {
      const tSec = (now - start) * 0.001;
      material.uniforms.iTime.value = tSec;
      if (sweepRef) {
        material.uniforms.uSweep.value = sweepRef.current;
      } else {
        // Legacy self-running up/down sweep when no external driver is given.
        const cyc = (tSec / 7.5) % 1;
        const ss = (a: number, b: number, x: number) => {
          const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
          return t * t * (3 - 2 * t);
        };
        material.uniforms.uSweep.value = 1 - (ss(0, 0.25, cyc) - ss(0.5, 0.75, cyc));
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    const tryStart = () => {
      if (isVisible && isPageVisible && raf === 0) raf = requestAnimationFrame(loop);
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

    tryStart();

    return () => {
      tryStop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      mesh.geometry.dispose();
      material.dispose();
      renderer.dispose();
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
