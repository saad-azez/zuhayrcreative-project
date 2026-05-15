"use client";

import { useRef, useEffect } from "react";
import "./DarkVeil.css";

interface DarkVeilProps {
  speed?: number;
  hueShift?: number;
  noiseIntensity?: number;
  scanlineIntensity?: number;
  scanlineFrequency?: number;
  warpAmount?: number;
  resolutionScale?: number;
  tint?: [number, number, number];
}

export default function DarkVeil(_props: DarkVeilProps) {
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

      THREE.ColorManagement.enabled = true;

      const FBO_W = 512,
        FBO_H = 256;
      const GEOM_W = window.innerWidth,
        GEOM_H = window.innerHeight;
      const HALF_W = GEOM_W / 2,
        HALF_H = GEOM_H / 2;

      const heightmapFrag = `
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
          float mp = clamp(length((uv - 0.5) * vec2(${GEOM_W.toFixed(1)}, ${GEOM_H.toFixed(1)}) - mousePos) * 3.14159 / mouseSize, 0.0, 3.14159);
          nh += (cos(mp) + 1.0) * waveheightMultiplier;
          hm.y = hm.x; hm.x = nh;
          gl_FragColor = hm;
        }`;

      const waterVert = `
        uniform sampler2D heightmap;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;
        varying float vHeight;
        void main() {
          vUv = uv;
          vec2 cs = vec2(1.0 / ${FBO_W.toFixed(1)}, 1.0 / ${FBO_H.toFixed(1)});
          float h   = texture2D(heightmap, uv).x;
          float hL  = texture2D(heightmap, uv + vec2(-cs.x, 0.0)).x;
          float hR  = texture2D(heightmap, uv + vec2(cs.x, 0.0)).x;
          float hD  = texture2D(heightmap, uv + vec2(0.0, -cs.y)).x;
          float hU  = texture2D(heightmap, uv + vec2(0.0, cs.y)).x;
          vec3 norm = normalize(vec3(
            (hL - hR) * ${FBO_W.toFixed(1)} / ${GEOM_W.toFixed(1)},
            (hD - hU) * ${FBO_H.toFixed(1)} / ${GEOM_H.toFixed(1)}, 1.0
          ));
          vNormal = norm;
          vHeight = h;
          vec4 wPos = modelMatrix * vec4(position.x, position.y, h, 1.0);
          vViewPosition = cameraPosition - wPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * wPos;
        }`;

      const waterFrag = `
        uniform vec3  diffuse;
        uniform vec3  specular;
        uniform float shininess;
        uniform sampler2D map;
        uniform float opacity;
        uniform float uTime;
        varying vec3  vNormal;
        varying vec3  vViewPosition;
        varying vec2  vUv;
        varying float vHeight;

        void main() {
          vec3 n = normalize(vNormal);
          vec3 v = normalize(vViewPosition);
          float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          vec3 ld = normalize(vec3(0.5, 0.8, 0.3));
          float diff = max(dot(n, ld), 0.0);
          vec3 hh = normalize(ld + v);
          float spec = pow(max(dot(n, hh), 0.0), shininess);
          float shimmer = sin(vUv.x * 40.0 + vUv.y * 30.0 + uTime * 0.6) * 0.5 + 0.5;
          shimmer *= sin(vUv.y * 50.0 - vUv.x * 20.0 + uTime * 0.4) * 0.5 + 0.5;
          shimmer *= 0.12;
          vec2 duv = vUv + n.xy * (0.03 + fresnel * 0.04);
          vec4 tex = texture2D(map, duv);
          vec3 col = (diffuse * 0.06 + diffuse * diff + specular * spec) * tex.rgb;
          vec3 fresnelCol = mix(vec3(0.04, 0.005, 0.01), vec3(0.2, 0.02, 0.05), fresnel);
          col = mix(col, fresnelCol, fresnel * 0.2);
          col += specular * shimmer * 0.2;
          float crest = smoothstep(0.3, 1.0, abs(vHeight) * 3.0);
          col += vec3(0.15, 0.01, 0.03) * crest * 0.08;
          gl_FragColor = vec4(col, opacity);
        }`;

      function createSparkles() {
        const count = 120;
        const geom = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const offsets = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          pos[i * 3] = (Math.random() - 0.5) * GEOM_W * 1.2;
          pos[i * 3 + 1] = (Math.random() - 0.5) * GEOM_H * 1.2;
          pos[i * 3 + 2] = 0;
          sizes[i] = 1.0 + Math.random() * 2.5;
          offsets[i] = Math.random() * 100;
        }
        geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geom.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
        geom.setAttribute("offset", new THREE.BufferAttribute(offsets, 1));

        const mat = new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 } },
          vertexShader: `
            attribute float size;
            attribute float offset;
            uniform float uTime;
            varying float vAlpha;
            void main() {
              vec3 p = position;
              float t = uTime * 0.3 + offset;
              p.x += sin(t * 0.7 + position.y * 0.01) * 8.0;
              p.y += cos(t * 0.5 + position.x * 0.01) * 8.0;
              vAlpha = 0.15 + 0.35 * (0.5 + 0.5 * sin(t * 0.8 + offset));
              vec4 mv = modelViewMatrix * vec4(p, 1.0);
              gl_PointSize = size * (80.0 / -mv.z);
              gl_Position = projectionMatrix * mv;
            }
          `,
          fragmentShader: `
            varying float vAlpha;
            void main() {
              float d = length(gl_PointCoord - 0.5);
              if (d > 0.5) discard;
              float a = smoothstep(0.5, 0.0, d) * vAlpha;
              gl_FragColor = vec4(0.3, 0.01, 0.06, a * 0.35);
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        return new THREE.Points(geom, mat);
      }

      function makeTexture() {
        const c = document.createElement("canvas");
        c.width = c.height = 1024;
        const ctx = c.getContext("2d")!;
        const g = ctx.createLinearGradient(0, 0, 0, 1024);
        g.addColorStop(0, "#1A0005");
        g.addColorStop(0.3, "#0D0003");
        g.addColorStop(0.6, "#060001");
        g.addColorStop(1, "#010000");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1024, 1024);

        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        return t;
      }

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x030303);

      const camera = new THREE.OrthographicCamera(
        -HALF_W,
        HALF_W,
        HALF_H,
        -HALF_H,
        -1000,
        1000,
      );

      const l1 = new THREE.DirectionalLight(0xaa5533, 1.0);
      l1.position.set(300, 400, 175);
      scene.add(l1);
      const l2 = new THREE.DirectionalLight(0x38000E, 0.4);
      l2.position.set(-150, 350, -200);
      scene.add(l2);
      const l3 = new THREE.DirectionalLight(0x1A0005, 0.15);
      l3.position.set(0, -200, 300);
      scene.add(l3);
      scene.add(new THREE.AmbientLight(0x0A0003, 0.3));

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(GEOM_W, GEOM_H);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.55;
      container.appendChild(renderer.domElement);
      container.style.touchAction = "none";

      const composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(GEOM_W, GEOM_H),
        0.25,
        0.1,
        0.0,
      );
      composer.addPass(bloomPass);

      const uniforms: Record<string, { value: unknown }> = {
        diffuse: { value: new THREE.Color(0x38000E) },
        specular: { value: new THREE.Color(0x5C001A) },
        shininess: { value: 35 },
        map: { value: makeTexture() },
        opacity: { value: 0.75 },
        heightmap: { value: null },
        uTime: { value: 0 },
      };

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: waterVert,
        fragmentShader: waterFrag,
        transparent: true,
      });

      const waterMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(GEOM_W, GEOM_H, FBO_W, FBO_H),
        material,
      );
      scene.add(waterMesh);

      const sparkles = createSparkles();
      scene.add(sparkles);

      const gpuCompute = new GPUComputationRenderer(FBO_W, FBO_H, renderer);
      if (!renderer.capabilities.isWebGL2)
        gpuCompute.setDataType(THREE.HalfFloatType);

      const ht0 = gpuCompute.createTexture();
      const p = ht0.image.data;
      if (p) {
        p.fill(0);
        for (let idx = 3; idx < p.length; idx += 4) p[idx] = 1;
      }

      const hmVar = gpuCompute.addVariable("heightmap", heightmapFrag, ht0);
      gpuCompute.setVariableDependencies(hmVar, [hmVar]);

      const mousePos = new THREE.Vector2(10000, 10000);
      const hmU = hmVar.material.uniforms;
      hmU.mousePos = { value: mousePos };
      hmU.mouseSize = { value: 10 };
      hmU.viscosityConstant = { value: 0.87 };
      hmU.waveheightMultiplier = { value: 0.12 };

      const err = gpuCompute.init();
      if (err) console.error(err);

      let mouseMoved = false;
      const mouseWorld = new THREE.Vector2();

      function setMouseCoords(x: number, y: number) {
        // Direct orthographic mapping: screen pixel → world coords
        // Camera spans -HALF_W..HALF_W horizontally, -HALF_H..HALF_H vertically
        mouseWorld.x = (x / window.innerWidth) * GEOM_W - HALF_W;
        mouseWorld.y = -(y / window.innerHeight) * GEOM_H + HALF_H;
        mouseMoved = true;
      }

      const onPointerMove = (e: PointerEvent) => {
        if (e.isPrimary === false) return;
        setMouseCoords(e.clientX, e.clientY);
      };
      const onPointerDown = (e: PointerEvent) => {
        if (e.isPrimary === false) return;
        setMouseCoords(e.clientX, e.clientY);
      };
      document.addEventListener("pointermove", onPointerMove, {
        capture: true,
      });
      document.addEventListener("pointerdown", onPointerDown, {
        capture: true,
      });

      let autoRippleTimer = 0;

      const onResize = () => {
        const hw = window.innerWidth / 2;
        const hh = window.innerHeight / 2;
        camera.left = -hw;
        camera.right = hw;
        camera.top = hh;
        camera.bottom = -hh;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", onResize);

      const clock = new THREE.Clock();
      let animId = 0;

      function animate() {
        animId = requestAnimationFrame(animate);
        const dt = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        uniforms.uTime.value = elapsed;
        const sparkMat = sparkles.material as import("three").ShaderMaterial;
        sparkMat.uniforms.uTime.value = elapsed;

        if (mouseMoved) {
          hmU.mousePos.value.set(mouseWorld.x, mouseWorld.y);
          mouseMoved = false;
        } else {
          autoRippleTimer += dt;
          if (autoRippleTimer > 2.5) {
            const rx = (Math.random() - 0.5) * GEOM_W * 0.8;
            const ry = (Math.random() - 0.5) * GEOM_H * 0.8;
            hmU.mousePos.value.set(rx, ry);
            hmU.mouseSize.value = 12 + Math.random() * 10;
            hmU.waveheightMultiplier.value = 0.08 + Math.random() * 0.06;
            autoRippleTimer = 0;
          } else {
            hmU.mousePos.value.set(10000, 10000);
            hmU.mouseSize.value = 20;
            hmU.waveheightMultiplier.value = 0.2;
          }
        }

        gpuCompute.compute();
        uniforms.heightmap.value =
          gpuCompute.getCurrentRenderTarget(hmVar).texture;

        composer.render();
      }

      animate();

      cleanup = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("pointermove", onPointerMove, {
          capture: true,
        });
        document.removeEventListener("pointerdown", onPointerDown, {
          capture: true,
        });
        container.removeChild(renderer.domElement);
        renderer.dispose();
      };
    })();

    return () => {
      cleanup?.();
    };
  }, []);

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
      }}
    />
  );
}
