"use client";

import { useRef, useEffect } from "react";
import "./DarkVeil.css";

interface DarkVeilProps {
  speed?: number;
  distortion?: number;
  swirl?: number;
  grainMixer?: number;
  grainOverlay?: number;
  colors?: string[];
}

// ── Paper-design vertex shader: outputs v_objectUV in [-0.5, 0.5] ──
// Adapted for Three.js GLSL1 (no #version, varying/gl_Position)
const VERT = /* glsl */ `
varying vec2 v_objectUV;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  v_objectUV = position.xy * 0.5;
}
`;

// ── Paper-design mesh gradient fragment shader (ported to GLSL1) ──
const FRAG = /* glsl */ `
precision highp float;

uniform float u_time;
uniform vec4 u_colors[10];
uniform float u_colorsCount;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_grainMixer;
uniform float u_grainOverlay;

varying vec2 v_objectUV;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float hash21(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float noise(vec2 n, vec2 seedOffset) {
  return valueNoise(n + seedOffset);
}

vec2 getPosition(int i, float t) {
  float a = float(i) * 0.37;
  float b = 0.6 + fract(float(i) / 3.0) * 0.9;
  float c = 0.8 + fract(float(i + 1) / 4.0);
  float x = sin(t * b + a);
  float y = cos(t * c + a * 1.5);
  return 0.5 + 0.5 * vec2(x, y);
}

void main() {
  vec2 uv = v_objectUV + 0.5;
  vec2 grainUV = uv * 1000.0;

  float grain = noise(grainUV, vec2(0.0));
  float mixerGrain = 0.4 * u_grainMixer * (grain - 0.5);

  float firstFrameOffset = 41.5;
  float t = 0.5 * (u_time + firstFrameOffset);

  float radius = smoothstep(0.0, 1.0, length(uv - 0.5));
  float center = 1.0 - radius;
  for (float i = 1.0; i <= 2.0; i += 1.0) {
    uv.x += u_distortion * center / i * sin(t + i * 0.4 * smoothstep(0.0, 1.0, uv.y)) * cos(0.2 * t + i * 2.4 * smoothstep(0.0, 1.0, uv.y));
    uv.y += u_distortion * center / i * cos(t + i * 2.0 * smoothstep(0.0, 1.0, uv.x));
  }

  vec2 uvRotated = uv - 0.5;
  float angle = 3.0 * u_swirl * radius;
  uvRotated = rotate(uvRotated, -angle);
  uvRotated += 0.5;

  vec3 color = vec3(0.0);
  float opacity = 0.0;
  float totalWeight = 0.0;

  for (int i = 0; i < 10; i++) {
    if (i >= int(u_colorsCount)) break;
    vec2 pos = getPosition(i, t) + mixerGrain;
    vec3 colorFraction = u_colors[i].rgb * u_colors[i].a;
    float opacityFraction = u_colors[i].a;
    float dist = length(uvRotated - pos);
    dist = pow(dist, 3.5);
    float weight = 1.0 / (dist + 1e-3);
    color += colorFraction * weight;
    opacity += opacityFraction * weight;
    totalWeight += weight;
  }

  color /= max(1e-4, totalWeight);
  opacity /= max(1e-4, totalWeight);

  float grainOverlay = valueNoise(rotate(grainUV, 1.0) + vec2(3.0));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.0) + vec2(-1.0)), 0.5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2.0 - 1.0;
  vec3 grainOverlayColor = vec3(step(0.0, grainOverlayV));
  float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, 0.8);
  color = mix(color, grainOverlayColor, 0.35 * grainOverlayStrength);

  opacity += 0.5 * grainOverlayStrength;
  opacity = clamp(opacity, 0.0, 1.0);

  gl_FragColor = vec4(color, opacity);
}
`;

// ── Helpers ──
function hexToVec4(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const a = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) / 255 : 1.0;
  return [r, g, b, a];
}

const DEFAULT_COLORS = ["#1a0508", "#2d0a10", "#0d0204", "#3d0f16"];

export default function DarkVeil({
  speed = 0.6,
  distortion = 0.7,
  swirl = 0.2,
  grainMixer = 0,
  grainOverlay = 0,
  colors = DEFAULT_COLORS,
}: DarkVeilProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = await import("three");

      const W = window.innerWidth;
      const H = window.innerHeight;

      // ── Renderer ──
      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        });
        if (!renderer.getContext()) throw new Error("No WebGL context");
      } catch {
        container.style.background = "#0a0304";
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);

      // ── Scene ──
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      // ── Colors → Vector4 array ──
      const colorArr = colors.slice(0, 10).map((c) => {
        const [r, g, b, a] = hexToVec4(c);
        return new THREE.Vector4(r, g, b, a);
      });
      // Pad to 10
      while (colorArr.length < 10) {
        colorArr.push(new THREE.Vector4(0, 0, 0, 0));
      }

      // ── Shader material ──
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          u_time: { value: 0 },
          u_colors: { value: colorArr },
          u_colorsCount: { value: Math.min(colors.length, 10) },
          u_distortion: { value: distortion },
          u_swirl: { value: swirl },
          u_grainMixer: { value: grainMixer },
          u_grainOverlay: { value: grainOverlay },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        depthWrite: false,
        depthTest: false,
      });

      // ── Fullscreen plane ──
      const geo = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);

      // ── Resize ──
      const onResize = () => {
        const nw = window.innerWidth;
        const nh = window.innerHeight;
        renderer.setSize(nw, nh);
      };
      window.addEventListener("resize", onResize);

      // ── Loop ──
      let rafId = 0;
      const startTime = performance.now();

      function animate(now: number) {
        rafId = requestAnimationFrame(animate);
        mat.uniforms.u_time.value = ((now - startTime) / 1000) * speed;
        renderer.render(scene, camera);
      }
      rafId = requestAnimationFrame(animate);

      cleanup = () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", onResize);
        container.removeChild(renderer.domElement);
        renderer.dispose();
        geo.dispose();
        mat.dispose();
      };
    })();

    return () => {
      cleanup?.();
    };
  }, [speed, distortion, swirl, grainMixer, grainOverlay]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: -10,
        overflow: "hidden",
        background: "#0a0304",
      }}
    />
  );
}
