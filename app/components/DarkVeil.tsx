"use client";

import { useRef, useEffect } from "react";

interface DarkVeilProps {
  speed?: number;
  // Ripple controls
  rippleStrength?: number;
  rippleViscosity?: number;
  rippleSize?: number;
  // Neuro-noise controls
  nnBrightness?: number;
  nnContrast?: number;
  nnScale?: number;
  nnColorFront?: string;
  nnColorMid?: string;
  nnColorBack?: string;
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
// Neuro Noise fragment shader
// ─────────────────────────────────────────────
const FRAG_NEURO_NOISE = /* glsl */ `
precision highp float;

uniform float u_time;

// ── Ripple ──────────────────────────────────
uniform sampler2D u_heightmap;
uniform float     u_rippleStrength;

// ── Neuro noise ─────────────────────────────
uniform vec4  u_nnColorFront;
uniform vec4  u_nnColorMid;
uniform vec4  u_nnColorBack;
uniform float u_nnBrightness;
uniform float u_nnContrast;
uniform float u_nnScale;

varying vec2 v_objectUV;

#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float neuroShape(vec2 uv, float t) {
  vec2 sine_acc = vec2(0.);
  vec2 res = vec2(0.);
  float scale = 8.;

  for (int j = 0; j < 15; j++) {
    uv = rotate(uv, 1.);
    sine_acc = rotate(sine_acc, 1.);
    vec2 layer = uv * scale + float(j) + sine_acc - t;
    sine_acc += sin(layer);
    res += (.5 + .5 * cos(layer)) / scale;
    scale *= 1.2;
  }
  return res.x + res.y;
}

void main() {
  // ── Map object UV [-0.5, 0.5] → [0, 1] ──
  vec2 screenUV = v_objectUV + 0.5;

  // ── Ripple displacement (same as paper variant) ──
  float texStep = 1.0 / 512.0;
  float hC = texture2D(u_heightmap, screenUV).r;
  float hL = texture2D(u_heightmap, screenUV + vec2(-texStep, 0.0)).r;
  float hR = texture2D(u_heightmap, screenUV + vec2( texStep, 0.0)).r;
  float hD = texture2D(u_heightmap, screenUV + vec2(0.0, -texStep)).r;
  float hU = texture2D(u_heightmap, screenUV + vec2(0.0,  texStep)).r;
  vec2 grad = vec2(hR - hL, hU - hD);
  vec2 rippleUV = screenUV + grad * u_rippleStrength;

  // ── Neuro noise computation ──
  vec2 shape_uv = (rippleUV - 0.5) * u_nnScale + 0.5;
  shape_uv *= 0.13;

  float t = 0.5 * u_time;
  float noise = neuroShape(shape_uv, t);

  noise = (1.0 + u_nnBrightness) * noise * noise;
  noise = pow(noise, 0.7 + 6.0 * u_nnContrast);
  noise = min(1.4, noise);

  float blend = smoothstep(0.7, 1.4, noise);

  vec4 frontC = u_nnColorFront;
  frontC.rgb *= frontC.a;
  vec4 midC = u_nnColorMid;
  midC.rgb *= midC.a;
  vec4 blendFront = mix(midC, frontC, blend);

  float safeNoise = max(noise, 0.0);
  vec3 color = blendFront.rgb * safeNoise;
  float opacity = clamp(blendFront.a * safeNoise, 0.0, 1.0);

  vec3 bgColor = u_nnColorBack.rgb * u_nnColorBack.a;
  color = color + bgColor * (1.0 - opacity);
  opacity = opacity + u_nnColorBack.a * (1.0 - opacity);

  // Dithering fix
  color += 1.0 / 256.0 * (
    fract(sin(dot(0.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - 0.5
  );

  // Subtle crest highlight from ripples
  float crest = smoothstep(0.2, 1.0, abs(hC) * 4.0);
  color += vec3(0.28, 0.03, 0.02) * crest * 0.18;

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

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function DarkVeil({
  speed = 0.44,
  rippleStrength = 0.03,
  rippleViscosity = 0.97,
  rippleSize = 10,
  nnBrightness = 0.06,
  nnContrast = 0.22,
  nnScale = 5.08,
  nnColorFront = "#DC143C",
  nnColorMid = "#DE3163",
    nnColorBack = "#470015"
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

      // ── Build uniforms ───────────────────────────────────────────
      const [cfr, cfg, cfb, cfa] = hexToVec4(nnColorFront);
      const [cmr, cmg, cmb, cma] = hexToVec4(nnColorMid);
      const [cbr, cbg, cbb, cba] = hexToVec4(nnColorBack);

      const uniforms: Record<string, { value: unknown }> = {
        u_time: { value: 0 },
        u_heightmap: { value: null },
        u_rippleStrength: { value: rippleStrength },
        u_nnColorFront: { value: new THREE.Vector4(cfr, cfg, cfb, cfa) },
        u_nnColorMid: { value: new THREE.Vector4(cmr, cmg, cmb, cma) },
        u_nnColorBack: { value: new THREE.Vector4(cbr, cbg, cbb, cba) },
        u_nnBrightness: { value: nnBrightness },
        u_nnContrast: { value: nnContrast },
        u_nnScale: { value: nnScale },
      };

      // ── Shader material ──────────────────────────────────────────
      const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG_NEURO_NOISE,
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
  }, [
    speed,
    rippleStrength,
    rippleViscosity,
    rippleSize,
    nnBrightness,
    nnContrast,
    nnScale,
    nnColorFront,
    nnColorMid,
    nnColorBack,
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
