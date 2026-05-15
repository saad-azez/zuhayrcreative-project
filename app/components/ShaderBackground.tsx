"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ShaderBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // ── Original concentric pulse rings (color[j] array pattern) ──────────
    const fragmentShader = /* glsl */ `
      #define TWO_PI 6.2831853072
      #define PI 3.14159265359

      precision highp float;
      uniform vec2 resolution;
      uniform float uTime;

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        float t = uTime * 0.05;
        float lineWidth = 0.008;

        vec3 color = vec3(0.0);
        for (int j = 0; j < 3; j++) {
          for (int i = 0; i < 5; i++) {
            color[j] += lineWidth * float(i * i) / abs(
              fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0
              - length(uv) + mod(uv.x + uv.y, 0.2)
            );
          }
        }

        // Map to maroon palette — subtle/dark
        vec3 maroon = vec3(0.02, 0.00, 0.005)
                    + color[0] * vec3(0.28, 0.00, 0.08) * 0.35
                    + color[1] * vec3(0.50, 0.00, 0.13) * 0.35
                    + color[2] * vec3(0.86, 0.08, 0.24) * 0.35;

        // Stronger vignette
        float rad = length(uv);
        maroon *= 1.0 - rad * 0.5;

        // Subtle grain
        float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        maroon += (grain - 0.5) * 0.01;

        gl_FragColor = vec4(maroon, 1.0);
      }
    `;

    const vertexShader = /* glsl */ `
      void main() { gl_Position = vec4(position, 1.0); }
    `;

    // ── Three.js setup ────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a0a, 1);

    const camera = new THREE.Camera();
    camera.position.z = 1;

    const scene = new THREE.Scene();
    const geo = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      uTime: { value: 0 },
      resolution: { value: new THREE.Vector2() },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });

    scene.add(new THREE.Mesh(geo, mat));
    container.appendChild(renderer.domElement);

    // ── Resize ────────────────────────────────────────────────────────────
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      uniforms.resolution.value.set(
        renderer.domElement.width,
        renderer.domElement.height,
      );
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Animation loop ────────────────────────────────────────────────────
    let raf: number;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      uniforms.uTime.value += 0.05;
      renderer.render(scene, camera);
    };
    animate();

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geo.dispose();
      mat.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none", zIndex: 0 }}
    />
  );
}
