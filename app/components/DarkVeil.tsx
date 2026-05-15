"use client";

import { useRef, useEffect } from "react";
import "./DarkVeil.css";

interface DarkVeilProps {
  speed?: number;
  distortion?: number;
  swirl?: number;
  grainMixer?: number;
  grainOverlay?: number;
}

// ── Shared vertex (passes UVs) ──
const passThroughVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const declarePISnippet = `
  #define PI 3.14159265359
`;

const rotation2Snippet = `
  vec2 rotate(vec2 uv, float th) {
    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
  }
`;

const hash21Snippet = `
  float hash21(vec2 p) {
    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }
`;

// ── Mesh gradient background (paper-design/shaders spec) ──
const meshGradientFrag = `
  precision highp float;
  uniform float u_time;
  uniform vec4 u_colors[6];
  uniform float u_colorsCount;
  uniform float u_distortion;
  uniform float u_swirl;
  uniform float u_grainMixer;
  uniform float u_grainOverlay;
  varying vec2 vUv;

  ${declarePISnippet}
  ${rotation2Snippet}
  ${hash21Snippet}

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

  vec2 getPos(int i, float t) {
    float a = float(i) * .37;
    float b = .6 + fract(float(i) / 3.) * .9;
    float c = .8 + fract(float(i + 1) / 4.);
    float x = sin(t * b + a);
    float y = cos(t * c + a * 1.5);
    return .5 + .5 * vec2(x, y);
  }

  void main() {
    vec2 uv = vUv;
    vec2 grainUV = uv * 1000.;

    float grain = noise(grainUV, vec2(0.));
    float mixerGrain = .4 * u_grainMixer * (grain - .5);

    const float firstFrameOffset = 41.5;
    float t = .5 * (u_time + firstFrameOffset);

    float radius = smoothstep(0., 1., length(uv - .5));
    float center = 1. - radius;

    for (float i = 1.; i <= 2.; i++) {
      uv.x += u_distortion * center / i * sin(t + i * .4 * smoothstep(.0, 1., uv.y)) * cos(.2 * t + i * 2.4 * smoothstep(.0, 1., uv.y));
      uv.y += u_distortion * center / i * cos(t + i * 2. * smoothstep(.0, 1., uv.x));
    }

    vec2 uvR = uv - .5;
    uvR = rotate(uvR, -3. * u_swirl * radius);
    uvR += .5;
    uvR += mixerGrain;

    vec3 color = vec3(0.);
    float opacity = 0.;
    float totalWeight = 0.;

    for (int i = 0; i < 6; i++) {
      if (i >= int(u_colorsCount)) break;
      vec2 pos = getPos(i, t);
      float dist = pow(length(uvR - pos), 3.5);
      float weight = 1. / (dist + 1e-3);
      vec4 c = u_colors[i];
      vec3 colorFraction = c.rgb * c.a;
      float opacityFraction = c.a;
      color += colorFraction * weight;
      opacity += opacityFraction * weight;
      totalWeight += weight;
    }

    color /= max(1e-4, totalWeight);
    opacity /= max(1e-4, totalWeight);

    float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
    grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
    grainOverlay = pow(grainOverlay, 1.3);

    float grainOverlayV = grainOverlay * 2. - 1.;
    vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
    float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
    grainOverlayStrength = pow(grainOverlayStrength, .8);
    color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);

    opacity += .5 * grainOverlayStrength;
    opacity = clamp(opacity, 0., 1.);

    gl_FragColor = vec4(color, opacity);
  }
`;

// ── Water vertex (displaces Z from heightmap) ──
function makeWaterVert(w: number, h: number, fboW: number, fboH: number) {
  return `
    uniform sampler2D heightmap;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vHeight;
    void main() {
      vUv = uv;
      vec2 cs = vec2(1.0 / ${fboW}.0, 1.0 / ${fboH}.0);
      float h   = texture2D(heightmap, uv).x;
      float hL  = texture2D(heightmap, uv + vec2(-cs.x, 0.0)).x;
      float hR  = texture2D(heightmap, uv + vec2(cs.x, 0.0)).x;
      float hD  = texture2D(heightmap, uv + vec2(0.0, -cs.y)).x;
      float hU  = texture2D(heightmap, uv + vec2(0.0, cs.y)).x;
      vec3 norm = normalize(vec3(
        (hL - hR) * ${fboW}.0 / ${w}.0,
        (hD - hU) * ${fboH}.0 / ${h}.0,
        1.0
      ));
      vNormal = norm;
      vHeight = h;
      vec3 displaced = vec3(position.x, position.y, h * 80.0);
      vec4 wPos = modelMatrix * vec4(displaced, 1.0);
      vViewPosition = cameraPosition - wPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * wPos;
    }
  `;
}

const waterFrag = `
  uniform vec3 uWaterColor;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  varying float vHeight;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vViewPosition);

    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);

    vec3 ld = normalize(vec3(0.5, 0.8, 0.3));
    float diff = max(dot(n, ld), 0.0);
    vec3 hh = normalize(ld + v);
    float spec = pow(max(dot(n, hh), 0.0), 30.0);

    float shim = sin(vUv.x * 40.0 + vUv.y * 30.0) * 0.5 + 0.5;
    shim *= sin(vUv.y * 50.0 - vUv.x * 20.0) * 0.5 + 0.5;
    shim *= 0.08;

    vec3 col = uWaterColor * (0.06 + diff * 0.25) + vec3(0.06, 0.012, 0.025) * spec;
    col = mix(col, vec3(0.08, 0.01, 0.02), fresnel * 0.25);
    col += vec3(0.025, 0.004, 0.01) * shim;

    float crest = smoothstep(0.15, 0.7, abs(vHeight) * 2.0);
    col += vec3(0.06, 0.01, 0.02) * crest * 0.15;

    gl_FragColor = vec4(col, uOpacity);
  }
`;

// ── Sparkles ──
const sparkleVert = `
  attribute float size;
  attribute float offset;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float t = uTime * 0.3 + offset;
    p.x += sin(t * 0.7 + position.y * 0.01) * 6.0;
    p.y += cos(t * 0.5 + position.x * 0.01) * 6.0;
    vAlpha = 0.08 + 0.15 * (0.5 + 0.5 * sin(t * 0.8 + offset));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = size * (50.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const sparkleFrag = `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(0.2, 0.01, 0.04, a * 0.3);
  }
`;

// ── Heightmap physics (generated with actual dimensions) ──
function makeHeightmapFrag(w: number, h: number) {
  return `
    uniform vec2 mousePos;
    uniform float mouseSize;
    uniform float viscosityConstant;
    uniform float waveheightMultiplier;
    void main() {
      vec2 cs = 1.0 / resolution.xy;
      vec2 uv = gl_FragCoord.xy * cs;
      vec4 hm = texture2D(heightmap, uv);
      vec4 n = texture2D(heightmap, uv + vec2(0.0, cs.y));
      vec4 s = texture2D(heightmap, uv + vec2(0.0, -cs.y));
      vec4 e = texture2D(heightmap, uv + vec2(cs.x, 0.0));
      vec4 w = texture2D(heightmap, uv + vec2(-cs.x, 0.0));
      float nh = ((n.x + s.x + e.x + w.x) * 0.5 - hm.y) * viscosityConstant;
      vec2 worldUV = (uv - 0.5) * vec2(${w.toFixed(1)}, ${h.toFixed(1)});
      float mp = clamp(length(worldUV - mousePos) * 3.14159 / mouseSize, 0.0, 3.14159);
      nh += (cos(mp) + 1.0) * waveheightMultiplier;
      hm.y = hm.x; hm.x = nh;
      gl_FragColor = hm;
    }
  `;
}

export default function DarkVeil({
  speed = 0.8,
  distortion = 0.7,
  swirl = 0.2,
  grainMixer = 0.2,
  grainOverlay = 0.15,
}: DarkVeilProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = await import("three");
      const { GPUComputationRenderer } =
        await import("three/examples/jsm/misc/GPUComputationRenderer.js");
      const { EffectComposer } =
        await import("three/examples/jsm/postprocessing/EffectComposer.js");
      const { RenderPass } =
        await import("three/examples/jsm/postprocessing/RenderPass.js");
      const { UnrealBloomPass } =
        await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");

      // ── Dimensions ──
      const W = window.innerWidth;
      const H = window.innerHeight;
      const HW = W / 2;
      const HH = H / 2;
      const FBO_W = 512;
      const FBO_H = 256;

      // ── Scene ──
      const scene = new THREE.Scene();

      const camera = new THREE.OrthographicCamera(
        -HW,
        HW,
        HH,
        -HH,
        -1000,
        1000,
      );

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
      } catch {
        console.warn("WebGL not available — using CSS fallback");
        container.style.background = "#0A0A0A";
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.2;
      container.appendChild(renderer.domElement);
      container.style.touchAction = "none";

      // ── Post-process ──
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.12, 0.04, 0);
      composer.addPass(bloom);

      // ── 1. Background: mesh gradient ──
      const bgUniforms = {
        u_time: { value: 0 },
        u_colors: {
          value: [
            new THREE.Vector4(0.008, 0.008, 0.008, 0.95),
            new THREE.Vector4(0.025, 0.002, 0.008, 0.7),
            new THREE.Vector4(0.01, 0.009, 0.009, 0.9),
            new THREE.Vector4(0.035, 0.001, 0.012, 0.5),
            new THREE.Vector4(0.006, 0.008, 0.01, 0.85),
            new THREE.Vector4(0.018, 0.004, 0.006, 0.65),
          ],
        },
        u_colorsCount: { value: 6 },
        u_distortion: { value: distortion },
        u_swirl: { value: swirl },
        u_grainMixer: { value: grainMixer },
        u_grainOverlay: { value: grainOverlay },
      };

      const bgMat = new THREE.ShaderMaterial({
        uniforms: bgUniforms,
        vertexShader: passThroughVert,
        fragmentShader: meshGradientFrag,
        depthWrite: false,
      });

      const bg = new THREE.Mesh(new THREE.PlaneGeometry(W, H), bgMat);
      bg.position.z = -500;
      scene.add(bg);

      // ── 2. Water ripple ──
      const waterUniforms: Record<string, { value: unknown }> = {
        uWaterColor: { value: new THREE.Color(0x1a0005) },
        uOpacity: { value: 0.4 },
        heightmap: { value: null },
      };

      const waterMat = new THREE.ShaderMaterial({
        uniforms: waterUniforms,
        vertexShader: makeWaterVert(W, H, FBO_W, FBO_H),
        fragmentShader: waterFrag,
        transparent: true,
        depthWrite: false,
      });

      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(W, H, FBO_W, FBO_H),
        waterMat,
      );
      scene.add(water);

      // ── 3. Sparkles ──
      function makeSparkles() {
        const n = 80;
        const g = new THREE.BufferGeometry();
        const pos = new Float32Array(n * 3);
        const sizes = new Float32Array(n);
        const offs = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          pos[i * 3] = (Math.random() - 0.5) * W * 1.2;
          pos[i * 3 + 1] = (Math.random() - 0.5) * H * 1.2;
          pos[i * 3 + 2] = 0;
          sizes[i] = 1 + Math.random() * 2;
          offs[i] = Math.random() * 100;
        }
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
        g.setAttribute("offset", new THREE.BufferAttribute(offs, 1));

        const m = new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 } },
          vertexShader: sparkleVert,
          fragmentShader: sparkleFrag,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        return new THREE.Points(g, m);
      }

      const sparkles = makeSparkles();
      const sparkleMat = sparkles.material as import("three").ShaderMaterial;
      scene.add(sparkles);

      // ── GPU Compute ──
      const gpu = new GPUComputationRenderer(FBO_W, FBO_H, renderer);
      if (!renderer.capabilities.isWebGL2) gpu.setDataType(THREE.HalfFloatType);

      const ht0 = gpu.createTexture();
      const pd = ht0.image.data;
      if (pd) {
        pd.fill(0);
        for (let i = 3; i < pd.length; i += 4) pd[i] = 1;
      }

      const hmVar = gpu.addVariable("heightmap", makeHeightmapFrag(W, H), ht0);
      gpu.setVariableDependencies(hmVar, [hmVar]);

      const mPos = new THREE.Vector2(10000, 10000);
      const hmU = hmVar.material.uniforms;
      hmU.mousePos = { value: mPos };
      hmU.mouseSize = { value: 15 };
      hmU.viscosityConstant = { value: 0.88 };
      hmU.waveheightMultiplier = { value: 0.1 };

      const gpuErr = gpu.init();
      if (gpuErr) {
        console.error("GPUComputationRenderer init failed:", gpuErr);
        renderer.dispose();
        container.removeChild(renderer.domElement);
        return;
      }

      // ── Pointer ──
      let moved = false;
      const wPos = new THREE.Vector2();

      const onMove = (e: PointerEvent) => {
        if (!e.isPrimary) return;
        wPos.x = e.clientX - HW;
        wPos.y = -(e.clientY - HH);
        moved = true;
      };
      const onDown = (e: PointerEvent) => {
        if (!e.isPrimary) return;
        wPos.x = e.clientX - HW;
        wPos.y = -(e.clientY - HH);
        moved = true;
      };
      document.addEventListener("pointermove", onMove, { capture: true });
      document.addEventListener("pointerdown", onDown, { capture: true });

      let autoTimer = 0;
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;

      const onResize = () => {
        if (resizeTimer) return;
        resizeTimer = setTimeout(() => {
          resizeTimer = null;
          const nw = window.innerWidth;
          const nh = window.innerHeight;
          const nhw = nw / 2;
          const nhh = nh / 2;
          camera.left = -nhw;
          camera.right = nhw;
          camera.top = nhh;
          camera.bottom = -nhh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
          composer.setSize(nw, nh);
        }, 100);
      };
      window.addEventListener("resize", onResize);

      // ── Loop ──
      const clock = new THREE.Clock();
      let id = 0;

      function animate() {
        id = requestAnimationFrame(animate);
        const dt = clock.getDelta();
        const t = clock.getElapsedTime();

        bgUniforms.u_time.value = t * speed;
        sparkleMat.uniforms.uTime.value = t;

        if (moved) {
          hmU.mousePos.value.set(wPos.x, wPos.y);
          hmU.mouseSize.value = 15;
          hmU.waveheightMultiplier.value = 0.18;
          moved = false;
        } else {
          autoTimer += dt;
          if (autoTimer > 3.0) {
            hmU.mousePos.value.set(
              (Math.random() - 0.5) * W * 0.7,
              (Math.random() - 0.5) * H * 0.7,
            );
            hmU.mouseSize.value = 15 + Math.random() * 15;
            hmU.waveheightMultiplier.value = 0.1 + Math.random() * 0.06;
            autoTimer = 0;
          } else {
            hmU.mousePos.value.set(10000, 10000);
          }
        }

        gpu.compute();
        waterUniforms.heightmap.value =
          gpu.getCurrentRenderTarget(hmVar).texture;

        composer.render();
      }

      animate();

      cleanup = () => {
        cancelAnimationFrame(id);
        if (resizeTimer) clearTimeout(resizeTimer);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("pointermove", onMove, { capture: true });
        document.removeEventListener("pointerdown", onDown, { capture: true });
        container.removeChild(renderer.domElement);
        renderer.dispose();
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
        willChange: "transform",
      }}
    />
  );
}
