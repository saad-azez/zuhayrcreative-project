"use client";

import React, { useRef, useEffect, useCallback } from "react";
import {
  FlutedGlassRenderer,
  drawBackgroundGradient,
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
  /** Background gradient colors (used when bgImage is not set) */
  bgColors?: string[];
  /** Background image URL — when set, replaces the gradient with a real image */
  bgImage?: string;
  className?: string;
}

/**
 * FlutedGlassPanel — a WebGL-powered fluted glass card.
 *
 * Renders a full-section WebGL canvas with the fluted glass shader.
 * The background is captured to a texture, then the shader distorts it
 * to create a physically believable refractive glass effect.
 *
 * The glass card (heading, description, CTA) is positioned on the left side.
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
  bgColors = ["#0a0a0a", "#14141a", "#1a0a0a"],
  bgImage,
  className = "",
}: FlutedGlassPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FlutedGlassRenderer | null>(null);
  const gradientCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Build a gradient canvas as the background source
  const buildGradientSource = useCallback((): BackgroundSource => {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);

    if (!gradientCanvasRef.current) {
      gradientCanvasRef.current = document.createElement("canvas");
    }
    const c = gradientCanvasRef.current;
    c.width = w;
    c.height = h;

    const ctx = c.getContext("2d");
    if (ctx) {
      drawBackgroundGradient(ctx, w, h, bgColors);
    }
    return { type: "canvas" as const, canvas: c };
  }, [bgColors]);

  // Build an image background source
  const buildImageSource = useCallback(
    (img: HTMLImageElement): BackgroundSource => {
      return { type: "image" as const, image: img };
    },
    [],
  );

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
    if (bgImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        renderer.setBackgroundSource(buildImageSource(img));
      };
      img.src = bgImage;
    } else {
      renderer.setBackgroundSource(buildGradientSource());
    }

    renderer.startLoop();

    const handleResize = () => {
      if (!bgImage) {
        renderer.setBackgroundSource(buildGradientSource());
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update shader uniforms
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

  // Switch between gradient and image background
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (bgImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => renderer.setBackgroundSource(buildImageSource(img));
      img.src = bgImage;
    } else {
      renderer.setBackgroundSource(buildGradientSource());
    }
  }, [bgImage, buildGradientSource, buildImageSource]);

  // Update gradient colors
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || bgImage) return;
    renderer.setBackgroundSource(buildGradientSource());
  }, [bgColors, bgImage, buildGradientSource]);

  return (
    <div
      className={`relative w-screen min-h-screen overflow-hidden ${className}`}
    >
      {/* WebGL fluted glass canvas — full section */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: "block" }}
      />

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
