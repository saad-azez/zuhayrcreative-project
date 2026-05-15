"use client";

import { useRef, useEffect } from "react";

interface DarkVeilProps {
  speed?: number;
  distortion?: number;
  swirl?: number;
  grainMixer?: number;
  grainOverlay?: number;
  colors?: string[];
  // Ripple controls
  rippleStrength?: number; // how much the heightmap displaces the paper UV (default 0.03)
  rippleViscosity?: number; // wave decay, 0–1, higher = longer-lasting waves (default 0.97)
  rippleSize?: number; // pointer splash radius in pixels (default 25)
}

// ─────────────────────────────────────────────
// Vertex shader — unchanged from original DarkVeil
// ─────────────────────────────────────────────
const VERT = /* glsl */ `
varying vec2 v_objectUV;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  v_objectUV = position.xy * 0.5;
}
`;

// ─────────────────────────────────────────────
// Fragment shader — DarkVeil paper shader extended with
// heightmap-driven ripple displacement.
//
// New uniform: u_heightmap (sampler2D)
//   .r channel = current wave height  (written by GPUComputationRenderer)
// New uniform: u_rippleStrength (float)
//   scales the UV displacement applied before all paper calculations.
// ─────────────────────────────────────────────
const FRAG = /* glsl */ `
precision highp float;

uniform float u_time;
uniform vec4  u_colors[10];
uniform float u_colorsCount;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_grainMixer;
uniform float u_grainOverlay;

// ── Ripple ──────────────────────────────────
uniform sampler2D u_heightmap;
uniform float     u_rippleStrength;

varying vec2 v_objectUV;

#define TWO_PI 6.28318530718
#define PI     3.14159265358979323846

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
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float noise(vec2 n, vec2 seedOffset) {
  return valueNoise(n + seedOffset);
}

vec2 getPosition(int i, float t) {
  float a = float(i) * 0.37;
  float b = 0.6 + fract(float(i) / 3.0) * 0.9;
  float c = 0.8 + fract(float(i + 1) / 4.0);
  return 0.5 + 0.5 * vec2(sin(t * b + a), cos(t * c + a * 1.5));
}

void main() {
  // ── Map object UV [-0.5, 0.5] → [0, 1] for heightmap lookup ──
  vec2 screenUV = v_objectUV + 0.5;

  // ── Sample heightmap; derive gradient for displacement direction ──
  // We sample the height at 4 neighbouring texels to approximate ∇h,
  // then nudge screenUV perpendicular to the wave slope — this produces
  // a refraction-like distortion rather than a simple translation.
  float texStep = 1.0 / 512.0; // matches FBO_W = 512
  float hC = texture2D(u_heightmap, screenUV).r;
  float hL = texture2D(u_heightmap, screenUV + vec2(-texStep, 0.0)).r;
  float hR = texture2D(u_heightmap, screenUV + vec2( texStep, 0.0)).r;
  float hD = texture2D(u_heightmap, screenUV + vec2(0.0, -texStep)).r;
  float hU = texture2D(u_heightmap, screenUV + vec2(0.0,  texStep)).r;
  vec2 grad = vec2(hR - hL, hU - hD);

  // Apply ripple displacement to screenUV before paper calculations
  vec2 rippleUV = screenUV + grad * u_rippleStrength;

  // Re-derive object-space UV from displaced screenUV
  vec2 uv = rippleUV; // [0,1] space — used for all subsequent paper logic

  vec2 grainUV = uv * 1000.0;
  float grain = noise(grainUV, vec2(0.0));
  float mixerGrain = 0.4 * u_grainMixer * (grain - 0.5);

  float firstFrameOffset = 41.5;
  float t = 0.5 * (u_time + firstFrameOffset);

  float radius = smoothstep(0.0, 1.0, length(uv - 0.5));
  float center = 1.0 - radius;

  // Paper distortion (original)
  for (float i = 1.0; i <= 2.0; i += 1.0) {
    uv.x += u_distortion * center / i * sin(t + i * 0.4 * smoothstep(0.0, 1.0, uv.y))
                                     * cos(0.2 * t + i * 2.4 * smoothstep(0.0, 1.0, uv.y));
    uv.y += u_distortion * center / i * cos(t + i * 2.0 * smoothstep(0.0, 1.0, uv.x));
  }

  vec2 uvRotated = uv - 0.5;
  float angle = 3.0 * u_swirl * radius;
  uvRotated = rotate(uvRotated, -angle);
  uvRotated += 0.5;

  vec3  color      = vec3(0.0);
  float opacity    = 0.0;
  float totalWeight = 0.0;

  for (int i = 0; i < 10; i++) {
    if (i >= int(u_colorsCount)) break;
    vec2  pos           = getPosition(i, t) + mixerGrain;
    vec3  colorFraction = u_colors[i].rgb * u_colors[i].a;
    float opacityFraction = u_colors[i].a;
    float dist   = length(uvRotated - pos);
    dist         = pow(dist, 3.5);
    float weight = 1.0 / (dist + 1e-3);
    color        += colorFraction * weight;
    opacity      += opacityFraction * weight;
    totalWeight  += weight;
  }

  color   /= max(1e-4, totalWeight);
  opacity /= max(1e-4, totalWeight);

  float grainOverlay = valueNoise(rotate(grainUV, 1.0) + vec2(3.0));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.0) + vec2(-1.0)), 0.5);
  grainOverlay = pow(grainOverlay, 1.3);
  float grainOverlayV = grainOverlay * 2.0 - 1.0;
  vec3  grainOverlayColor = vec3(step(0.0, grainOverlayV));
  float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, 0.8);
  color = mix(color, grainOverlayColor, 0.35 * grainOverlayStrength);

  // Subtle specular highlight where wave crests are highest
  float crest = smoothstep(0.2, 1.0, abs(hC) * 4.0);
  color += vec3(0.28, 0.03, 0.02) * crest * 0.24;

  opacity += 0.5 * grainOverlayStrength;
  opacity  = clamp(opacity, 0.0, 1.0);

  gl_FragColor = vec4(color, opacity);
}
`;

// ─────────────────────────────────────────────
// GPU heightmap physics shader (wave equation)
// Pixel-space distance calculation — matches the HTML reference exactly,
// producing aspect-ratio-correct circular splashes at any viewport size.
// ─────────────────────────────────────────────
const HEIGHTMAP_FRAG = /* glsl */ `
uniform vec2  u_mousePos;    // [0,1] UV space
uniform float u_mouseSize;   // splash radius in pixels
uniform float u_viscosity;
uniform float u_waveHeight;
uniform vec2  u_resolution;  // viewport size in pixels

void main() {
  vec2  cs = 1.0 / resolution.xy;
  vec2  uv = gl_FragCoord.xy * cs;

  vec4 hm = texture2D(heightmap, uv);
  vec4 n  = texture2D(heightmap, uv + vec2(0.0,  cs.y));
  vec4 s  = texture2D(heightmap, uv + vec2(0.0, -cs.y));
  vec4 e  = texture2D(heightmap, uv + vec2( cs.x, 0.0));
  vec4 w  = texture2D(heightmap, uv + vec2(-cs.x, 0.0));

  float nh = ((n.x + s.x + e.x + w.x) * 0.5 - hm.y) * u_viscosity;

  // Convert UV → pixel space for aspect-ratio-correct distance.
  // Matches the HTML reference: (uv - 0.5) * resolution - mousePos
  vec2 pixelPos   = (uv - 0.5) * u_resolution;
  vec2 mousePixel = (u_mousePos - 0.5) * u_resolution;
  float dist = length(pixelPos - mousePixel);
  float mp = clamp(dist * 3.14159 / u_mouseSize, 0.0, 3.14159);
  nh += (cos(mp) + 1.0) * u_waveHeight;

  hm.y = hm.x;
  hm.x = nh;
  gl_FragColor = hm;
}
`;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function hexToVec4(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const a = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) / 255 : 1.0;
  return [r, g, b, a];
}

const DEFAULT_COLORS = ["#2c0712", "#000000", "#0d0c0c", "#030303"];
// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function DarkVeil({
  speed = 0.44,
  distortion = 1,
  swirl = 0.31,
  grainMixer = 0,
  grainOverlay = 0,
  colors = DEFAULT_COLORS,
  rippleStrength = 0.03,
  rippleViscosity = 0.97,
  rippleSize = 10,
}: DarkVeilProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cleanup: (() => void) | null = null;

    (async () => {
      // ── Lazy-load Three.js + GPUComputationRenderer ──────────────
      const THREE = await import("three");
      const { GPUComputationRenderer } =
        await import("three/addons/misc/GPUComputationRenderer.js");

      // ── Constants ────────────────────────────────────────────────
      const FBO_W = 512; // heightmap resolution — 512×256 matches original
      const FBO_H = 256;

      // ── Renderer ─────────────────────────────────────────────────
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
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);

      // ── Scene / Camera ───────────────────────────────────────────
      // DarkVeil uses an orthographic camera with NDC-aligned plane [-1,1]
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      // ── Colors → Vector4 array ───────────────────────────────────
      const colorArr = colors.slice(0, 10).map((c) => {
        const [r, g, b, a] = hexToVec4(c);
        return new THREE.Vector4(r, g, b, a);
      });
      while (colorArr.length < 10) colorArr.push(new THREE.Vector4(0, 0, 0, 0));

      // ── Paper shader material ─────────────────────────────────────
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          u_time: { value: 0 },
          u_colors: { value: colorArr },
          u_colorsCount: { value: Math.min(colors.length, 10) },
          u_distortion: { value: distortion },
          u_swirl: { value: swirl },
          u_grainMixer: { value: grainMixer },
          u_grainOverlay: { value: grainOverlay },
          // Ripple uniforms (heightmap injected each frame)
          u_heightmap: { value: null },
          u_rippleStrength: { value: rippleStrength },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        depthWrite: false,
        depthTest: false,
      });

      // ── Fullscreen plane (DarkVeil style) ────────────────────────
      const geo = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);

      // ── GPU Heightmap Compute ─────────────────────────────────────
      const gpuCompute = new GPUComputationRenderer(FBO_W, FBO_H, renderer);
      if (!renderer.capabilities.isWebGL2) {
        gpuCompute.setDataType(THREE.HalfFloatType);
      }

      // Initialise flat heightmap (all zeros)
      const ht0 = gpuCompute.createTexture();
      {
        const px = (ht0 as import("three").DataTexture).image
          .data as Float32Array;
        px.fill(0);
        for (let idx = 3; idx < px.length; idx += 4) px[idx] = 1;
      }

      const hmVar = gpuCompute.addVariable("heightmap", HEIGHTMAP_FRAG, ht0);
      gpuCompute.setVariableDependencies(hmVar, [hmVar]);

      // Uniform refs on the compute material
      const hmU = (hmVar as { material: import("three").ShaderMaterial })
        .material.uniforms;
      hmU.u_mousePos = { value: new THREE.Vector2(10000, 10000) }; // off-screen = no splash
      hmU.u_mouseSize = { value: rippleSize };
      hmU.u_viscosity = { value: rippleViscosity };
      hmU.u_waveHeight = { value: 0.2 };
      hmU.u_resolution = {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      };

      const gpuErr = gpuCompute.init();
      if (gpuErr) console.error("[DarkVeil] GPUComputationRenderer:", gpuErr);

      // ── Mouse / pointer handling ──────────────────────────────────
      // Map pointer clientX/Y directly to UV [0,1] — no raycaster needed
      // because the paper plane fills the entire viewport exactly.
      // One-shot flag: splash fires on exactly ONE compute frame per
      // pointermove event (matching the HTML reference behaviour).
      // This prevents a continuous fountain at a stationary cursor.
      let splashThisFrame = false;

      const onPointerMove = (e: PointerEvent) => {
        if (!e.isPrimary) return;
        // Map window coords → UV [0,1] (Y-flipped to match WebGL bottom-up)
        const u = e.clientX / window.innerWidth;
        const v = 1.0 - e.clientY / window.innerHeight;
        hmU.u_mousePos.value.set(u, v);
        hmU.u_waveHeight.value = 0.2;
        splashThisFrame = true;
      };

      // When pointer leaves the window, push splash origin off-screen
      const onPointerLeave = () => {
        hmU.u_mousePos.value.set(10000, 10000);
        hmU.u_waveHeight.value = 0.0;
        splashThisFrame = false;
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerleave", onPointerLeave, {
        passive: true,
      });
      window.addEventListener("pointercancel", onPointerLeave, {
        passive: true,
      });

      // ── Resize ───────────────────────────────────────────────────
      const onResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        hmU.u_resolution.value.set(window.innerWidth, window.innerHeight);
        // Camera is fixed at [-1,1]³ — no projection update needed
      };
      window.addEventListener("resize", onResize);

      // ── Unified render loop ───────────────────────────────────────
      let rafId = 0;
      const startTime = performance.now();

      function animate(now: number) {
        rafId = requestAnimationFrame(animate);

        // 1. Advance paper time
        mat.uniforms.u_time.value = ((now - startTime) / 1000) * speed;

        // 2. One-shot splash control — must run BEFORE compute so the
        //    splash fires on exactly one frame per pointermove event.
        //    When no movement occurred, push the splash origin off-screen
        //    and zero the wave height so only natural decay remains.
        if (!splashThisFrame) {
          hmU.u_mousePos.value.set(10000, 10000);
          hmU.u_waveHeight.value = 0.0;
        }
        splashThisFrame = false;

        // 3. Run GPU wave physics (one ping-pong FBO swap)
        gpuCompute.compute();

        // 4. Feed the resulting heightmap into the paper shader
        mat.uniforms.u_heightmap.value =
          gpuCompute.getCurrentRenderTarget(hmVar).texture;

        // 5. Render paper + ripple in a single draw call
        renderer.render(scene, camera);
      }

      rafId = requestAnimationFrame(animate);

      // ── Cleanup ───────────────────────────────────────────────────
      cleanup = () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerleave", onPointerLeave);
        window.removeEventListener("pointercancel", onPointerLeave);
        window.removeEventListener("resize", onResize);
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        renderer.dispose();
        geo.dispose();
        mat.dispose();
      };
    })();

    return () => {
      cleanup?.();
    };
    // colors captured once at mount (stable shader context)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    speed,
    distortion,
    swirl,
    grainMixer,
    grainOverlay,
    rippleStrength,
    rippleViscosity,
    rippleSize,
  ]);

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
