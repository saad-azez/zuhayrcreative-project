"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

// ── Simple vertex shader (bypasses projection) ──
const screenVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// ── Hash / noise snippets ──
const hash21 = `
  float hash21(vec2 p) {
    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }
`;

const rotation2 = `
  vec2 rotate(vec2 uv, float th) {
    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
  }
`;

// ── Hex → normalized RGBA ──
function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  let r = 0,
    g = 0,
    b = 0,
    a = 1;
  if (h.length === 8) {
    r = parseInt(h.slice(0, 2), 16) / 255;
    g = parseInt(h.slice(2, 4), 16) / 255;
    b = parseInt(h.slice(4, 6), 16) / 255;
    a = parseInt(h.slice(6, 8), 16) / 255;
  } else if (h.length === 6) {
    r = parseInt(h.slice(0, 2), 16) / 255;
    g = parseInt(h.slice(2, 4), 16) / 255;
    b = parseInt(h.slice(4, 6), 16) / 255;
  }
  return [r, g, b, a];
}

// ── Fluted glass shape mappings ──
const GLASS_GRID_SHAPES: Record<string, number> = {
  lines: 1,
  linesIrregular: 2,
  wave: 3,
  zigzag: 4,
  pattern: 5,
};

const GLASS_DISTORTION_SHAPES: Record<string, number> = {
  prism: 1,
  lens: 2,
  contour: 3,
  cascade: 4,
  flat: 5,
};

// ── Fluted glass + multi-logo shader (paper-design spec) ──
const heroFrag = `
  precision highp float;

  uniform sampler2D uLogo;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uInstanceCount;

  // Fluted glass uniforms
  uniform vec4 uColorBack;
  uniform vec4 uColorShadow;
  uniform vec4 uColorHighlight;
  uniform float uShadows;
  uniform float uHighlights;
  uniform float uSize;
  uniform float uAngle;
  uniform float uDistortion;
  uniform float uShift;
  uniform float uStretch;
  uniform float uBlur;
  uniform float uEdges;
  uniform float uMargin;
  uniform float uGrainMixer;
  uniform float uGrainOverlay;
  uniform float uShape;
  uniform float uDistortionShape;
  uniform vec2 uMouse;

  varying vec2 vUv;

  ${hash21}
  ${rotation2}

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

  float smoothFract(float x) {
    float f = fract(x);
    float w = fwidth(x);
    float edge = abs(f - 0.5) - 0.5;
    float band = smoothstep(-w, w, edge);
    return mix(f, 1.0 - f, band);
  }

  vec4 samplePremultiplied(sampler2D tex, vec2 uv) {
    vec4 c = texture(tex, uv);
    c.rgb *= c.a;
    return c;
  }

  vec4 getBlur(sampler2D tex, vec2 uv, vec2 texelSize, vec2 dir, float sigma) {
    if (sigma <= 0.5) return texture(tex, uv);
    int radius = int(min(30.0, ceil(3.0 * sigma)));
    float twoSigma2 = 2.0 * sigma * sigma;
    float norm = 1.0 / sqrt(6.283185 * sigma * sigma);
    vec4 sum = samplePremultiplied(tex, uv) * norm;
    float wSum = norm;
    for (int i = 1; i <= 30; i++) {
      if (i > radius) break;
      float x = float(i);
      float w = exp(-(x * x) / twoSigma2) * norm;
      vec4 s1 = samplePremultiplied(tex, uv + dir * texelSize * x);
      vec4 s2 = samplePremultiplied(tex, uv - dir * texelSize * x);
      sum += (s1 + s2) * w;
      wSum += 2.0 * w;
    }
    vec4 result = sum / wSum;
    if (result.a > 0.0) result.rgb /= result.a;
    return result;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime;

    // ── 0. Margin ─────────────────────────────────────────────────────
    float margin = uMargin;
    vec2 mUv = uv;
    mUv = mUv * (1.0 - 2.0 * margin) + margin;

    // ── 1. Composite multiple logo instances ──────────────────────────
    vec4 composite = vec4(0.0);
    float totalAlpha = 0.0;

    for (int i = 0; i < 20; i++) {
      float id = float(i);
      if (id >= uInstanceCount) break;

      float px = hash21(vec2(id * 7.37, id * 13.44));
      float py = hash21(vec2(id * 23.11, id * 43.91));
      float sz = 0.05 + 0.20 * hash21(vec2(id * 3.17, id * 5.93));

      float sx = 0.08 + 0.15 * hash21(vec2(id * 101.3, id * 107.7));
      float sy = 0.06 + 0.12 * hash21(vec2(id * 113.9, id * 127.5));
      float ax = 0.06 + 0.18 * hash21(vec2(id * 131.1, id * 137.3));
      float ay = 0.04 + 0.14 * hash21(vec2(id * 149.9, id * 151.1));
      float phx = hash21(vec2(id * 157.7, id * 163.3)) * 6.2832;
      float phy = hash21(vec2(id * 167.9, id * 173.1)) * 6.2832;

      vec2 off = vec2(sin(t * sx + phx) * ax, cos(t * sy + phy) * ay);
      vec2 pos = fract(vec2(px, py) + off);
      vec2 logoUv = (mUv - pos) / sz + 0.5;

      if (logoUv.x >= 0.0 && logoUv.x <= 1.0 &&
          logoUv.y >= 0.0 && logoUv.y <= 1.0) {
        vec4 c = texture(uLogo, logoUv);
        float a = c.a;
        composite = mix(composite, c, a);
        totalAlpha = max(totalAlpha, a);
      }
    }

    // ── Mouse-responsive offset ──────────────────────────────────────
    vec2 mouseOffset = (uMouse - 0.5) * 2.0;
    float mouseInfluence = 0.06;

    // ── 2. Fluted glass grid ──────────────────────────────────────────
    float patternRotation = -uAngle * 3.14159 / 180.0;
    float patternSize = mix(200.0, 5.0, uSize);

    vec2 gridUv = mUv;
    gridUv -= 0.5;
    gridUv *= patternSize;
    gridUv += mouseOffset * mouseInfluence * patternSize;
    gridUv = rotate(gridUv, patternRotation);

    // Shape curve
    float curve = 0.0;
    float patternY = gridUv.y;
    if (uShape > 4.5) {
      // pattern
      curve = 0.5 + 0.5 * sin(0.5 * 3.14159 * gridUv.x) * cos(0.5 * 3.14159 * patternY);
    } else if (uShape > 3.5) {
      // zigzag
      curve = 10.0 * abs(fract(0.1 * patternY) - 0.5);
    } else if (uShape > 2.5) {
      // wave
      curve = 4.0 * sin(0.23 * patternY);
    } else if (uShape > 1.5) {
      // lines irregular
      curve = 0.5 + 0.5 * sin(0.5 * gridUv.x) * sin(1.7 * gridUv.x);
    }
    // lines = curve stays 0

    vec2 uvToFract = gridUv + curve;
    float x = smoothFract(uvToFract.x);
    float xNonSmooth = fract(uvToFract.x) + 0.0001;
    float gridIdx = floor(uvToFract.x);

    // ── 3. Highlights ─────────────────────────────────────────────────
    float hiliteWidth = 2.0 * max(0.001, fwidth(uvToFract.x));
    float hilite = smoothstep(0.0, hiliteWidth, xNonSmooth);
    hilite *= smoothstep(1.0, 1.0 - hiliteWidth, xNonSmooth);
    hilite = 1.0 - hilite;
    hilite *= uHighlights;
    hilite = clamp(hilite, 0.0, 1.0);

    // ── 4. Distortion per shape ───────────────────────────────────────
    float shdw = pow(x, 1.3);
    float distortionAmt = 0.0;
    float frameFade = 0.0;
    float aa = max(fwidth(xNonSmooth), max(fwidth(gridUv.x), fwidth(uvToFract.x)));
    aa = max(aa, 0.0001);

    if (uDistortionShape < 1.5) {
      // prism
      distortionAmt = -pow(1.5 * x, 3.0);
      distortionAmt += (0.5 - uShift + mouseOffset.x * 0.08);
      frameFade = pow(1.5 * x, 3.0);
      aa = max(0.2, aa);
      aa += mix(0.2, 0.0, uSize);
      float fadeX = smoothstep(0.0, aa, xNonSmooth) * smoothstep(1.0, 1.0 - aa, xNonSmooth);
      distortionAmt = mix(0.5, distortionAmt, fadeX);
    } else if (uDistortionShape < 2.5) {
      // lens
      distortionAmt = 2.0 * pow(x, 2.0);
      distortionAmt -= (0.5 + uShift);
      frameFade = pow(abs(x - 0.5), 4.0);
      aa = max(0.2, aa);
      aa += mix(0.2, 0.0, uSize);
      float fadeX = smoothstep(0.0, aa, xNonSmooth) * smoothstep(1.0, 1.0 - aa, xNonSmooth);
      distortionAmt = mix(0.5, distortionAmt, fadeX);
      frameFade = mix(1.0, frameFade, 0.5 * fadeX);
    } else if (uDistortionShape < 3.5) {
      // contour
      distortionAmt = pow(2.0 * (xNonSmooth - 0.5), 6.0);
      distortionAmt -= 0.25;
      distortionAmt -= uShift;
      frameFade = 1.0 - 2.0 * pow(abs(x - 0.4), 2.0);
      aa = 0.15;
      aa += mix(0.1, 0.0, uSize);
      float fadeX = smoothstep(0.0, aa, xNonSmooth) * smoothstep(1.0, 1.0 - aa, xNonSmooth);
      frameFade = mix(1.0, frameFade, fadeX);
    } else if (uDistortionShape < 4.5) {
      // cascade
      distortionAmt = sin((x + 0.25) * 6.2832);
      shdw = 0.5 + 0.5 * asin(distortionAmt) / (0.5 * 3.14159);
      distortionAmt *= 0.5;
      distortionAmt -= uShift;
      frameFade = 0.5 + 0.5 * sin(x * 6.2832);
    } else {
      // flat
      distortionAmt -= pow(abs(x), 0.2) * x;
      distortionAmt += 0.33;
      distortionAmt -= 3.0 * uShift;
      distortionAmt *= 0.33;
      frameFade = 0.3 * smoothstep(0.0, 1.0, x);
      shdw = pow(x, 2.5);
      aa = max(0.1, aa);
      aa += mix(0.1, 0.0, uSize);
      float fadeX = smoothstep(0.0, aa, xNonSmooth) * smoothstep(1.0, 1.0 - aa, xNonSmooth);
      distortionAmt *= fadeX;
    }

    // ── 5. Grain mixer ────────────────────────────────────────────────
    vec2 dudx = dFdx(mUv);
    vec2 dudy = dFdy(mUv);
    vec2 grainUv = mUv - 0.5;
    grainUv *= (0.8 / vec2(length(dudx), length(dudy)));
    grainUv += 0.5;
    float grainMix = valueNoise(grainUv);
    grainMix = smoothstep(0.4, 0.7, grainMix);
    grainMix *= uGrainMixer;
    distortionAmt = mix(distortionAmt, 0.0, grainMix);

    // ── 6. Apply distortion ───────────────────────────────────────────
    shdw = min(shdw, 1.0);
    shdw *= pow(uShadows, 2.0);
    shdw = clamp(shdw, 0.0, 1.0);

    distortionAmt *= 3.0 * uDistortion;
    frameFade *= uDistortion;

    vec2 floorUv = floor(uvToFract);
    vec2 fractUv = fract(uvToFract);
    fractUv.x += distortionAmt;
    floorUv = rotate(floorUv, -patternRotation);
    fractUv = rotate(fractUv, -patternRotation);

    vec2 finalUv = (floorUv + fractUv) / patternSize;
    finalUv += 0.5;

    // ── 7. Stretch ────────────────────────────────────────────────────
    float stretchMask = 1.0 - smoothstep(0.0, 0.5, xNonSmooth) * smoothstep(1.0, 1.0 - 0.5, xNonSmooth);
    stretchMask = pow(stretchMask, 2.0);
    finalUv.y = mix(finalUv.y, 0.5, uStretch * stretchMask);

    // ── 8. Blur ───────────────────────────────────────────────────────
    float blurAmount = mix(0.0, 120.0, uBlur);
    vec2 blurDir = vec2(0.0, 1.0);
    blurDir = rotate(blurDir, patternRotation);
    vec2 texelSize = 1.0 / uResolution;
    vec4 glassImage = getBlur(uLogo, finalUv, texelSize, blurDir, blurAmount);

    // ── 9. Compose output ─────────────────────────────────────────────
    vec4 backColor = uColorBack;
    backColor.rgb *= backColor.a;
    vec4 highlightColor = uColorHighlight;
    highlightColor.rgb *= highlightColor.a;
    vec4 shadowColor = uColorShadow;
    shadowColor.rgb *= shadowColor.a;

    // --- Undistorted (left half) ---
    vec3 cleanCol = composite.rgb;
    float cleanAlpha = max(composite.a, totalAlpha);

    // --- Glass-distorted (right half) ---
    vec3 glassCol = composite.rgb;
    float glassAlpha = max(composite.a, totalAlpha);

    // Merge with glass-blurred image
    glassCol = mix(glassCol, glassImage.rgb, glassImage.a * 0.3);
    glassAlpha = max(glassAlpha, glassImage.a * 0.3);

    // Highlights
    glassCol += highlightColor.rgb * hilite;
    float hlOpacity = highlightColor.a * hilite;

    // Shadows
    float shdwOpacity = shdw * shadowColor.a;
    shdwOpacity = max(0.0, shdwOpacity - hlOpacity);
    glassCol = mix(glassCol, shadowColor.rgb, shdwOpacity * 0.5);
    glassCol += 0.5 * pow(shdw, 0.5) * shadowColor.rgb;
    glassAlpha += shdwOpacity;

    // --- Horizontal mask: fluted glass only on right half ---
    float glassMask = smoothstep(0.35, 0.5, uv.x);

    vec3 col = mix(cleanCol, glassCol, glassMask);
    float alpha = mix(cleanAlpha, glassAlpha, glassMask);

    // Apply edge fade (margin-based)
    float edgeFade = 1.0;
    if (margin > 0.0) {
      edgeFade = smoothstep(0.0, margin, uv.x) * smoothstep(1.0, 1.0 - margin, uv.x)
               * smoothstep(0.0, margin, uv.y) * smoothstep(1.0, 1.0 - margin, uv.y);
    }
    col *= edgeFade;

    // ── 10. Grain overlay ─────────────────────────────────────────────
    vec2 grainNoiseUv = mUv * 1000.0;
    float grainOverlayVal = valueNoise(rotate(grainNoiseUv, 1.0) + vec2(3.0));
    grainOverlayVal = mix(grainOverlayVal, valueNoise(rotate(grainNoiseUv, 2.0) + vec2(-1.0)), 0.5);
    grainOverlayVal = pow(grainOverlayVal, 1.3);
    float grainV = grainOverlayVal * 2.0 - 1.0;
    float grainStrength = uGrainOverlay * abs(grainV);
    grainStrength = pow(grainStrength, 0.8);
    vec3 grainCol = vec3(step(0.0, grainV));
    col = mix(col, grainCol, 0.35 * grainStrength);
    alpha += 0.5 * grainStrength;

    // Vignette
    float vig = 1.0 - length(uv - 0.5) * 0.6;
    col *= clamp(vig, 0.0, 1.0);

    alpha = clamp(alpha, 0.0, 1.0);

    // Blend with back color
    col = mix(col, backColor.rgb, 1.0 - alpha);
    alpha = mix(alpha, 1.0, backColor.a);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface FlutedGlassParams {
  colorBack?: string;
  colorShadow?: string;
  colorHighlight?: string;
  size?: number;
  shadows?: number;
  highlights?: number;
  shape?: keyof typeof GLASS_GRID_SHAPES;
  angle?: number;
  distortionShape?: keyof typeof GLASS_DISTORTION_SHAPES;
  distortion?: number;
  shift?: number;
  stretch?: number;
  blur?: number;
  edges?: number;
  margin?: number;
  grainMixer?: number;
  grainOverlay?: number;
}

export interface HeroBannerProps {
  /** URL or path to the logo image */
  logo: string;
  /** Number of logo instances (default 15) */
  instanceCount?: number;
  /** Hero title text */
  title: string;
  /** CTA button text */
  ctaText: string;
  /** CTA href */
  ctaHref?: string;
  /** CTA onClick */
  onCtaClick?: () => void;
  /** Fluted glass parameters */
  glass?: FlutedGlassParams;
}

export default function HeroBanner({
  logo,
  instanceCount = 15,
  title,
  ctaText,
  ctaHref = "#contact",
  onCtaClick,
  glass,
}: HeroBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animIdRef = useRef<number>(0);

  // Fluted glass default params
  const g = glass ?? {};
  const colorBack = hexToRgba(g.colorBack ?? "#00000000");
  const colorShadow = hexToRgba(g.colorShadow ?? "#000000");
  const colorHighlight = hexToRgba(g.colorHighlight ?? "#ffffff");
  const size = g.size ?? 0.84;
  const shadows = g.shadows ?? 0.25;
  const highlights = g.highlights ?? 0.1;
  const shape = GLASS_GRID_SHAPES[g.shape ?? "lines"];
  const angle = g.angle ?? 0;
  const distortionShape = GLASS_DISTORTION_SHAPES[g.distortionShape ?? "prism"];
  const distortion = g.distortion ?? 0.5;
  const shift = g.shift ?? 0;
  const stretch = g.stretch ?? 0;
  const blur = g.blur ?? 0;
  const edges = g.edges ?? 0.25;
  const margin = g.margin ?? 0;
  const grainMixer = g.grainMixer ?? 0;
  const grainOverlay = g.grainOverlay ?? 0.05;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // ── Load logo texture ──────────────────────────────────────────────
    const loader = new THREE.TextureLoader();
    const logoTexture = loader.load(logo);

    // ── Full-screen quad with fluted-glass shader ──────────────────────
    const camera = new THREE.Camera();
    camera.position.z = 1;

    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      uLogo: { value: logoTexture },
      uResolution: {
        value: new THREE.Vector2(container.clientWidth, container.clientHeight),
      },
      uTime: { value: 0 },
      uInstanceCount: { value: instanceCount },
      uColorBack: { value: new THREE.Vector4(...colorBack) },
      uColorShadow: { value: new THREE.Vector4(...colorShadow) },
      uColorHighlight: { value: new THREE.Vector4(...colorHighlight) },
      uSize: { value: size },
      uShadows: { value: shadows },
      uHighlights: { value: highlights },
      uShape: { value: shape },
      uAngle: { value: angle },
      uDistortionShape: { value: distortionShape },
      uDistortion: { value: distortion },
      uShift: { value: shift },
      uStretch: { value: stretch },
      uBlur: { value: blur },
      uEdges: { value: edges },
      uMargin: { value: margin },
      uGrainMixer: { value: grainMixer },
      uGrainOverlay: { value: grainOverlay },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: screenVert,
      fragmentShader: heroFrag,
    });

    scene.add(new THREE.Mesh(geometry, material));

    // ── Renderer ───────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x0a0a0a, 1);
    container.appendChild(renderer.domElement);

    // ── Resize ─────────────────────────────────────────────────────────
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      uniforms.uResolution.value.set(w, h);
    };
    window.addEventListener("resize", resize);

    // ── Mouse tracking ────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      uniforms.uMouse.value.set(
        (e.clientX - rect.left) / rect.width,
        1.0 - (e.clientY - rect.top) / rect.height,
      );
    };
    window.addEventListener("mousemove", onMouseMove);

    // ── Animation loop ─────────────────────────────────────────────────
    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate);
      uniforms.uTime.value = performance.now() / 1000;
      renderer.render(scene, camera);
    };
    animate();

    // ── Cleanup ────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animIdRef.current);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo, instanceCount, JSON.stringify(glass)]);

  const handleCtaClick = useCallback(
    (e: React.MouseEvent) => {
      if (onCtaClick) {
        e.preventDefault();
        onCtaClick();
      }
    },
    [onCtaClick],
  );

  return (
    <section className="relative w-full min-h-dvh overflow-hidden">
      {/* ── WebGL canvas container ── */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none", zIndex: 0 }}
      />

      {/* ── Dark overlay for readability ── */}
      <div
        className="absolute inset-0 z-1"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 45%, rgba(10,10,10,0.10) 0%, rgba(10,10,10,0.40) 45%, rgba(10,10,10,0.80) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Content overlay ── */}
      <div className="relative z-10 flex flex-col items-start justify-center min-h-dvh px-6 md:px-16 lg:px-24 text-left">
        {/* Tagline */}
        <p className="text-xs md:text-sm font-mono uppercase tracking-[0.25em] text-maroon-accent/80 mb-6">
          Zuhayr Creative
        </p>

        {/* Title */}
        <h1 className="font-sans text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tighter leading-none text-white max-w-3xl">
          {title}
        </h1>

        {/* Divider */}
        <div className="w-12 h-px bg-maroon-accent/40 mt-8 mb-8" />

        {/* CTA Button */}
        <a
          href={ctaHref}
          onClick={handleCtaClick}
          className="group relative inline-flex items-center gap-3 px-8 py-4 bg-maroon-accent text-white font-semibold text-sm uppercase tracking-[0.15em] rounded-full overflow-hidden transition-all duration-500 ease-out hover:bg-maroon-light active:scale-[0.97]"
        >
          <span className="relative z-10">{ctaText}</span>
          <svg
            className="relative z-10 w-4 h-4 transition-transform duration-500 ease-out group-hover:translate-x-1"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 8h12M9 3l5 5-5 5" />
          </svg>
          {/* Hover shine */}
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-linear-to-r from-transparent via-white/20 to-transparent" />
        </a>
      </div>
    </section>
  );
}
