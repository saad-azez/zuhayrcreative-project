"use client";

import React, { useRef, useEffect } from "react";
import {
  FlutedGlassRenderer,
  type BackgroundSource,
} from "@/app/shaders/fluted-glass-renderer";
import {
  type FlutedGlassUniforms,
  defaultFlutedGlassUniforms,
  GlassDistortionShapes,
  GlassGridShapes,
} from "@/app/shaders/fluted-glass-shader";

interface FlutedGlassPanelProps {
  /** Heading text inside the glass card */
  heading?: string;
  /** Description text inside the glass card */
  description?: string;
  /** CTA button text */
  ctaText?: string;
  /** CTA href */
  ctaHref?: string;
  /** Shader uniform overrides */
  shader?: Partial<FlutedGlassUniforms>;
  /**
   * Background source — the content "behind" the glass.
   * The fluted glass shader samples this and applies refractive distortion.
   * Supports: { type: "color", color: [r,g,b,a] } | { type: "image" } | { type: "video" } | { type: "canvas" }
   * Pass null to use a dark default background.
   */
  background?: BackgroundSource | null;
  className?: string;
}

/**
 * FlutedGlassPanel — a WebGL-powered fluted glass card.
 *
 * Uses a two-pass FBO pipeline for true refractive glass:
 *   1. Background is rendered into an FBO texture
 *   2. Fluted glass shader samples the FBO and applies distortion
 *
 * The glass card (heading, description, CTA) is positioned on the left.
 * The `background` prop controls what's behind the glass — change it
 * independently to gradients, images, videos, or WebGL scenes.
 *
 * Shader adapted from paper-design/shaders.
 * Copyright Lost Coast Labs, Inc. (paper.design) — PolyForm Shield License.
 */
export default function FlutedGlassPanel({
  heading = "We Build",
  description = "Digital experiences that drive growth and captivate audiences.",
  ctaText = "Get Started",
  ctaHref = "#contact",
  shader = {},
  background = null,
  className = "",
}: FlutedGlassPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FlutedGlassRenderer | null>(null);

  // ── Init renderer ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new FlutedGlassRenderer(canvas);
    if (!renderer.init()) {
      console.error("Failed to initialize FlutedGlassRenderer");
      return;
    }
    rendererRef.current = renderer;

    // Set initial background
    if (background) {
      renderer.setBackgroundSource(background);
    }

    // Set initial shader
    renderer.updateUniforms({
      ...defaultFlutedGlassUniforms,
      u_colorBack: [0, 0, 0, 0],
      u_colorShadow: [0, 0, 0, 1],
      u_colorHighlight: [1, 1, 1, 1],
      u_shadows: 0.11,
      u_size: 0.83,
      u_distortion: 0.61,
      u_distortionShape: GlassDistortionShapes.flat,
      u_shape: GlassGridShapes.lines,
      ...shader,
    });

    renderer.startLoop();

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update background ──
  useEffect(() => {
    rendererRef.current?.setBackgroundSource(background);
  }, [background]);

  // ── Update shader ──
  useEffect(() => {
    rendererRef.current?.updateUniforms({
      ...defaultFlutedGlassUniforms,
      u_colorBack: [0, 0, 0, 0],
      u_colorShadow: [0, 0, 0, 1],
      u_colorHighlight: [1, 1, 1, 1],
      u_shadows: 0.11,
      u_size: 0.83,
      u_distortion: 0.61,
      u_distortionShape: GlassDistortionShapes.flat,
      u_shape: GlassGridShapes.lines,
      ...shader,
    });
  }, [shader]);

  // ── Render ──
  return (
    <div
      className={`relative w-screen min-h-screen overflow-hidden ${className}`}
    >
      {/* WebGL fluted glass canvas — full section */}
      {/* <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: "block" }}
      /> */}

      {/* Glass card overlay — left side */}
      <div className="absolute inset-0 z-10 flex items-center pointer-events-none">
        <div className="ml-[clamp(2rem,8vw,8rem)] max-w-lg pointer-events-auto">
          {/* Glass card with frosted border */}
          <div className="relative p-8 md:p-10 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm shadow-[0_8px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
            {/* Edge highlight */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none bg-linear-to-br from-white/6 via-transparent to-transparent" />

            <div className="relative">
              <h1 className="font-extrabold text-[clamp(2rem,4.5vw,4rem)] leading-[1.1] text-white tracking-tight">
                {heading}{" "}
                <span className="bg-linear-to-r from-[#dc143c] to-[#ff4466] bg-clip-text text-transparent">
                  Bold Ideas
                </span>
              </h1>

              <p className="mt-5 text-[clamp(0.95rem,1.5vw,1.15rem)] text-gray-300/90 max-w-md leading-relaxed">
                {description}
              </p>

              <a
                href={ctaHref}
                className="group mt-8 inline-flex items-center gap-3 py-3.5 px-9 rounded-full font-semibold text-sm text-white bg-[#dc143c] no-underline transition-all duration-300 hover:bg-[#be1030] hover:-translate-y-0.5 hover:shadow-[0_8px_40px_rgba(220,20,60,0.4)]"
              >
                {ctaText}
                <span
                  className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  →
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
