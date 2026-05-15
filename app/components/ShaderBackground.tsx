"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ShaderBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // ── Vertex shader ──────────────────────────────────────────────────────
    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

    // ── Fragment shader — maroon/burgundy tones ────────────────────────────
    const fragmentShader = `
      precision highp float;

      uniform vec2  resolution;
      uniform float time;

      // Theme colors (linear sRGB ≈)
      const vec3 MAROON_DARK  = vec3(0.28, 0.00, 0.08);
      const vec3 MAROON_LIGHT = vec3(0.50, 0.00, 0.12);
      const vec3 TITLE_RED    = vec3(0.86, 0.08, 0.24);
      const vec3 FOOTER       = vec3(0.22, 0.00, 0.05);

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);

        float t = time * 0.04;

        // Organic radial distortion
        float rad = length(uv);
        float ang = atan(uv.y, uv.x);

        // Layered wave patterns
        float wave1 = sin(rad * 3.0 - t * 1.2 + ang * 0.5) * 0.5 + 0.5;
        float wave2 = cos((uv.x + uv.y) * 2.5 + t * 0.8) * 0.5 + 0.5;
        float wave3 = sin(uv.x * 4.0 - t * 0.6) * cos(uv.y * 4.0 + t * 0.7) * 0.5 + 0.5;

        // Blend between maroon tones based on waves
        vec3 color = mix(FOOTER, MAROON_DARK, wave1);
        color     = mix(color, MAROON_LIGHT, wave2 * 0.6);
        color     = mix(color, TITLE_RED,    wave3 * 0.25);

        // Subtle radial vignette
        float vignette = 1.0 - rad * 0.35;
        color *= clamp(vignette, 0.0, 1.0);

        // Very subtle grain
        float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        color += (grain - 0.5) * 0.015;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // ── Scene setup ────────────────────────────────────────────────────────
    const camera = new THREE.Camera();
    camera.position.z = 1;

    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      time: { value: 0 },
      resolution: { value: new THREE.Vector2() },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });

    scene.add(new THREE.Mesh(geometry, material));

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ── Resize ─────────────────────────────────────────────────────────────
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      uniforms.resolution.value.set(w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Animation loop ─────────────────────────────────────────────────────
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      uniforms.time.value += 0.016; // ~60fps
      renderer.render(scene, camera);
    };
    animate();

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
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
