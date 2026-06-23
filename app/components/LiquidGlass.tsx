"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface LiquidGlassProps {
  /** Corner radius in CSS px — should match the container's border radius. */
  radius?: number;
  /** Glass tint (hex). Subtle; the backdrop-blur does the heavy lifting. */
  tint?: string;
  className?: string;
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

  // Seamless up/down loop: the lit band's centre eases bottom → top → bottom.
  float rise   = 0.5 - 0.5 * cos(iTime * 0.13 * 6.2831853);
  float center = mix(-0.25, 1.25, rise);
  float halfWin = 0.62;

  // Wavy leading edges rolling across the full width.
  float wave = (fbm(vec2(f.x * 5.0, iTime * 0.5)) - 0.5) * 0.18
             + (n2 - 0.5) * 0.05;
  float fyT  = f.y - (n1 - 0.5) * 0.10 + wave;

  // Travelling vertical window of fire spanning the whole width.
  float vmask = smoothstep(center - halfWin, center - halfWin * 0.35, fyT)
              * (1.0 - smoothstep(center + halfWin * 0.35, center + halfWin, fyT));

  float flame = clamp(vmask * (0.55 + 0.8 * n1), 0.0, 1.0);
  flame = pow(flame, 1.2);

  // Gas-flame palette: deep blue base → vivid blue → cyan → white-hot core,
  // with subtle yellow tips (incomplete combustion).
  vec3 fcol = vec3(0.0);
  fcol += uTint                  * smoothstep(0.05, 0.30, flame);
  fcol += vec3(0.10, 0.45, 1.0)  * smoothstep(0.22, 0.55, flame);
  fcol += vec3(0.40, 0.78, 1.0)  * smoothstep(0.52, 0.82, flame);
  fcol += vec3(0.62, 0.88, 1.0)  * smoothstep(0.80, 1.0,  flame);
  float yellowTip = smoothstep(0.12, 0.30, flame)
                  * (1.0 - smoothstep(0.30, 0.52, flame))
                  * smoothstep(0.45, 0.95, f.y);
  fcol += vec3(1.0, 0.66, 0.15) * yellowTip * 0.5;

  // ── Faint glass shell (edges + sheen only, no solid body) ──────────
  float rim  = pow(1.0 - edge, 2.6);
  float band = sin((vUv.x + vUv.y) * 3.14159 + iTime * 1.0);
  float spec = smoothstep(0.9, 1.0, band);

  vec3 col = fcol;
  col += vec3(0.55, 0.7, 1.0) * rim * 0.45;       // cool refractive edge
  col += vec3(1.0)            * spec * 0.2 * edge; // subtle sheen

  float glassA = 0.05;                             // barely-there container
  float alpha = clamp(flame + rim * 0.4 + spec * 0.15 * edge + glassA, 0.0, 1.0) * mask;

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
  tint = "#0A1E8C",
  className = "",
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
      material.uniforms.iTime.value = (now - start) * 0.001;
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
