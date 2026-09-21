"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial, useGLTF } from "@react-three/drei";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import * as THREE from "three";
import { useSceneLease } from "@/app/animations/hooks/useNearViewport";
import { isPhoneDevice, sceneDprCap } from "@/app/lib/device";
import { hasGPU } from "@/app/lib/gpu";

/**
 * HorizonDome — "Sitting above the horizon" (damonxart, x.com/damonxart/
 * status/2017884943154827372), rebuilt from all 392 of its frames.
 *
 * ── What it is ──
 * A FLAT upright half-disc — the wall — standing on a circular floor, with
 * the look of a dome painted onto it: a depth map (a virtual hemisphere's
 * normal at every point) gives it rim light where the fake surface turns
 * away, a darker band across the middle, and a glow at the foot, so from
 * the front it reads as a dome and from the side it is a sliver, exactly
 * as the clip's opening frame is. The floor is lit BY the wall: bright on
 * the open side, black behind, hottest along the line where they meet
 * (the white "horizon" — it sits behind the boy). The boy sits just in
 * front of the wall, facing it. A black glossy ground shows a faint wash
 * of the floor.
 *
 * ── The camera ──
 * Almost at floor level (about 3 degrees while the wall is edge-on, rising
 * to about 12 at the front). It starts edge-on and comes round to the
 * front over the first nine seconds — the angle read from the clip's arch
 * width at each moment, as a flat panel would need (asin of width over
 * diameter): 6 degrees at 0s, 14 at 1.5, 27 at 2.7, 38 at 5, 50 at 6.4,
 * 90 by 9 — then holds with a slow sway. It dollies in a little, then out
 * from 3.5s. All of it Catmull-Rom splines through those readings, plus
 * two parallaxes: the pointer nudges the camera a few degrees, and the
 * scene drifts against the page as the section scrolls through.
 *
 * ── The colour ──
 * The clip's own palette — the top of the shell's colour measured through
 * the clip: magenta at 0s, blue by 3s, near-white at 4s, green held 5 to
 * 8s, orange held 9.3 to 11.5s, blue by 13s — and then the brand's ramp,
 * the services tunnel's six stops, before the cycle wraps to magenta. It
 * scrolls the clip's way: mostly ACROSS the picture (screen-left lags,
 * screen-right leads) and a little up the shell.
 *
 * The floor and the beam on its rim are LIGHT, added over the page's own
 * background rather than painted on it, so the Unicorn scene behind shows
 * through them.
 *
 * No postprocessing library: the glow is in the shading, so this is a
 * handful of small draws and stays cheap on a phone. Same rules as the
 * globe: built in the first quiet moment, draws only while on screen,
 * never unmounts.
 */

const MODEL_URL = "/models/wandering_boy.glb";

// ── Palette: the clip's cycle, then the brand's ─────────────────────────
// The reference's own colour cycle — the top of the shell's hue, saturation
// and value measured at these moments of the clip — continued through the
// brand's ramp, so the scene shows the rainbow the clip does and then the
// site's reds as the colours keep changing. The last stop wraps to the
// first so it loops without a cut.
const PALETTE: [number, number, number, number][] = [
  // The crown of the arch (a box 2-6% of the frame below its top), sampled
  // on the reference every 0.5s (ffmpeg fps=2, HSV of the box mean; 19 Sep):
  [0.0, 323, 1.00, 0.62],
  [0.5, 311, 0.98, 0.59],
  [1.0, 279, 0.87, 0.57],
  [1.5, 259, 0.77, 0.54],
  [2.0, 247, 0.59, 0.61],
  [2.5, 235, 0.41, 0.74],
  [3.0, 241, 0.20, 0.76],
  [3.5, 20, 0.06, 0.72], // the white phase (hue set on the way to the yellow)
  [4.0, 57, 0.36, 0.69],
  [4.5, 80, 0.57, 0.66],
  [5.0, 93, 0.64, 0.62],
  [5.5, 118, 0.64, 0.55],
  [6.0, 137, 0.71, 0.42],
  [6.5, 135, 0.60, 0.32], // the dark green: the bowl's middle at its darkest
  [7.0, 121, 0.45, 0.28],
  [7.5, 121, 0.38, 0.33],
  [8.0, 136, 0.32, 0.47],
  [8.5, 104, 0.15, 0.66],
  [9.0, 20, 0.25, 0.81],
  [9.5, 28, 0.46, 0.82],
  [10.0, 32, 0.63, 0.75],
  [10.5, 26, 0.65, 0.79],
  [11.0, 16, 0.57, 0.84],
  [11.5, 7, 0.43, 0.83],
  [12.0, 320, 0.27, 0.80],
  [12.5, 245, 0.34, 0.83],
  [13.1, 262, 0.60, 0.74],
  // ...and back round to the opening magenta: the clip's own cycle, looped.
  // (The brand's red ramp used to follow here; the client asked for the
  // reference's colours, 19 Sep.)
];
const PALETTE_PERIOD = 14.4;
const HOLD = 0; // none: the clip starts moving at once, and our clock must run in step with it

function hsv(hIn: number, s: number, v: number): [number, number, number] {
  // Interpolation between stops takes the short way round the wheel, so a
  // hue can arrive here negative (5 down to -24): bring it back to 0..360
  // first — the channel maths below assumes it, and a negative channel
  // wraps to bright in the byte texture.
  const h = ((hIn % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const k = Math.floor((((h % 360) + 360) % 360) / 60);
  const rgb = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][k];
  return [rgb[0] + m, rgb[1] + m, rgb[2] + m];
}
function bakeTexture(sample: (t01: number) => [number, number, number]) {
  const N = 512;
  const data = new Uint8Array(N * 4);
  // Softened: a box blur of +/-0.35s over the cycle. The colour is laid
  // round the boy by angle, so a sharp stop (green to orange at 8.6-9s)
  // would otherwise stand as a hard radial seam across the wall; the
  // reference's transitions are all gradual.
  const raw: [number, number, number][] = [];
  for (let i = 0; i < N; i++) raw.push(sample(i / N));
  const half = Math.round((0.35 / PALETTE_PERIOD) * N);
  for (let i = 0; i < N; i++) {
    let r = 0, g = 0, b = 0;
    for (let k = -half; k <= half; k++) {
      const c = raw[(i + k + N) % N];
      r += c[0]; g += c[1]; b += c[2];
    }
    const n = 2 * half + 1;
    data[i * 4] = (r / n) * 255;
    data[i * 4 + 1] = (g / n) * 255;
    data[i * 4 + 2] = (b / n) * 255;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  // Raw bytes, no decode: a ShaderMaterial writes what it computes with no
  // output encoding, so a palette decoded to linear came out crushed (11s
  // measured at 0.98 saturation against the reference's 0.65). Kept as
  // sRGB bytes the shading runs in gamma space, as every calibration here
  // was measured.
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** The clip's cycle, interpolated in HSV so the hue passes round the wheel. */
function makePaletteTexture() {
  const wrap: [number, number, number, number] = [PALETTE_PERIOD, PALETTE[0][1] + 360, PALETTE[0][2], PALETTE[0][3]];
  const stops = [...PALETTE, wrap];
  return bakeTexture((t01) => {
    const t = t01 * PALETTE_PERIOD;
    let k = 0;
    while (k < stops.length - 2 && stops[k + 1][0] <= t) k++;
    const [t0, h0, s0, v0] = stops[k];
    const [t1, h1r, s1, v1] = stops[k + 1];
    let h1 = h1r;
    if (h1 - h0 > 180) h1 -= 360;
    if (h1 - h0 < -180) h1 += 360;
    const u = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
    const w = u * u * (3 - 2 * u);
    return hsv(h0 + (h1 - h0) * w, s0 + (s1 - s0) * w, v0 + (v1 - v0) * w);
  });
}

// ── Shading ────────────────────────────────────────────────────────────────
const GLSL_COMMON = /* glsl */ `
  uniform float uTime;     // seconds into the clip
  uniform float uPeriod;   // the palette's period, seconds
  uniform sampler2D uPal;  // the palette, one period across
  uniform float uMirror;   // 1 on the reflection copies
  uniform float uFade;     // 0..1 arrival
  uniform vec2 uRes;       // the drawing buffer, pixels
  uniform float uCrownX;   // the arch's crown, as a fraction of the width
  uniform float uFill;     // how much of the bowl's inside the light fills, 0..1.2
  uniform float uFloorFill; // the floor's brightness, 0..1
  // THE COLOUR IS BUILT HERE, procedurally. The reference clip was only
  // measured, never sampled: at every quarter second, the average colour of
  // 20 regions of its wall (5 across x 4 down), 15 of its floor (5 across its
  // width x near the horizon / middle / near the front edge) and 5 of the
  // reflection just below it - DOME_GRID below. The shaders blend
  // those control colours into smooth gradients in space and time, and
  // generate the rim line, the glow and the reflection themselves.
  uniform sampler2D uGrid;  // 40 control colours x 53 moments (a data table)
  uniform float uKey;       // 0..52: the moment, in quarter seconds
  uniform vec4 uBox;        // our arch on screen, drawing-buffer px from the
                            // top: feet-midpoint x, crown y, horizon y, half-width
  uniform float uFrontY;    // the floor's front edge on screen, px from the top
  uniform vec2 uFloorX;     // the floor's left and right ends on screen, px
  vec3 gridTap(float cell, float key) {
    return texture2D(uGrid, vec2((cell + 0.5) / 40.0, (key + 0.5) / 53.0)).rgb;
  }
  vec3 gridCell(float cell) {
    float k0 = floor(uKey);
    float k1 = min(k0 + 1.0, 52.0);
    float w = uKey - k0;
    w = w * w * (3.0 - 2.0 * w);
    return mix(gridTap(cell, k0), gridTap(cell, k1), w);
  }
  // Smooth blend of a block of control colours (base cell, columns),
  // fu in 0..cols-1, fv in 0..rows-1.
  vec3 gridBlend(float base, float cols, float rows, float fu, float fv) {
    float i0 = floor(fu); float j0 = floor(fv);
    float i1 = min(i0 + 1.0, cols - 1.0); float j1 = min(j0 + 1.0, rows - 1.0);
    float a = fu - i0; float b = fv - j0;
    a = a * a * (3.0 - 2.0 * a); b = b * b * (3.0 - 2.0 * b);
    vec3 c00 = gridCell(base + j0 * cols + i0);
    vec3 c10 = gridCell(base + j0 * cols + i1);
    vec3 c01 = gridCell(base + j1 * cols + i0);
    vec3 c11 = gridCell(base + j1 * cols + i1);
    return mix(mix(c00, c10, a), mix(c01, c11, a), b);
  }
  // Where this surface point sits in the MAIN camera's view (px from the
  // top). Not gl_FragCoord: the mirror pass renders the same surfaces from a
  // camera below the floor, and they must keep their colour there.
  varying vec4 vMainClip;
  vec2 fragTop() {
    vec2 n = vMainClip.xy / vMainClip.w;
    return vec2((n.x * 0.5 + 0.5) * uRes.x, (0.5 - n.y * 0.5) * uRes.y);
  }
  // The wall at (u, v): u across the arch (-1..1 edge to edge at that
  // height), v crown (0) to foot (1).
  vec3 wallAt(float u, float v) {
    float fu = clamp((u * 0.5 + 0.5) * 5.0 - 0.5, 0.0, 4.0);
    float fv = clamp(v * 4.0 - 0.5, 0.0, 3.0);
    return gridBlend(0.0, 5.0, 4.0, fu, fv);
  }
  vec3 wallColour() {
    vec2 P = fragTop();
    float H = max(uBox.z - uBox.y, 1.0);
    float v = clamp((P.y - uBox.y) / H, 0.0, 1.0);
    float half_ = max(uBox.w * sqrt(max(1e-3, 1.0 - (1.0 - v) * (1.0 - v))), 0.5);
    return wallAt(clamp((P.x - uBox.x) / half_, -1.0, 1.0), v);
  }
  // The floor: across in arch radii (-1.2..1.2), and down from the horizon
  // to the front edge (0..1): rows at 0.15 (horizon), 0.55, 1.0 (front).
  // Across the floor, its left end to its right end on screen.
  float floorFu(float px) {
    float u = (px - uFloorX.x) / max(uFloorX.y - uFloorX.x, 1.0);
    return clamp(u * 5.0 - 0.5, 0.0, 4.0);
  }
  // row 0..2 = near the horizon, middle, near the front edge; 3 = reflection
  vec3 floorRow(float fu, float row) { return gridBlend(20.0, 5.0, 4.0, fu, row); }
  vec3 floorBody() {
    vec2 P = fragTop();
    float f = (P.y - uBox.z) / max(uFrontY - uBox.z, 1.0);
    float row = f < 0.5 ? clamp((f - 0.1) / 0.4, 0.0, 1.0) : 1.0 + clamp((f - 0.5) / 0.4, 0.0, 1.0);
    return floorRow(floorFu(P.x), row);
  }

  // Dither: +/- half an 8-bit step of per-pixel noise. The reflection and
  // the floor are long, dark, very gradual gradients; quantised to 256
  // levels they came out as visible bands (one step every ~20px).
  vec3 dither(vec3 c) {
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float m = fract(sin(dot(gl_FragCoord.xy + 17.0, vec2(39.3468, 11.1353))) * 24634.6345);
    return max(c + (n + m - 1.0) / 255.0, 0.0);
  }
  // The palette at a point: seconds of scroll, wrapped.
  vec3 pal(float seconds) {
    return texture2D(uPal, vec2(fract(seconds / uPeriod), 0.5)).rgb;
  }
  // Where a point sits in the palette: the hue sweeps ACROSS THE SCREEN.
  // Screen-left lags the clock, screen-right leads it - on the 3s frame
  // the arch's screen-left foot is magenta (1s) although that surface is
  // the bowl's right-hand side, on the last frame the wall runs orange
  // (10.5s) at the left to blue (13s) at the right, at 5s the floor runs
  // violet, white, green left to right. The crown of the arch reads the
  // clock itself (the palette is the crown's colour, measured).
  // Measured FROM THE CROWN, wherever it sits on screen (edge-on it is in
  // the left third), since the palette was read there.
  float sweepSeconds(float span) {
    float across = (gl_FragCoord.x / uRes.x - uCrownX) * 2.0;
    // +0.6: the hold and the ease-in at the start put the clock about
    // half a second behind the reference at the same moment on screen.
    return uTime + 1.0 + span * across;
  }
  // A lagging read must not wrap to the END of the cycle in the first
  // seconds (the opening sliver is uniform magenta, not the pale blue of
  // 13s): in the first pass the clock is clamped at 0.
  float lagged(float seconds) {
    return uTime < uPeriod ? max(seconds, 0.0) : seconds;
  }
  // The palette carries the CROWN's value, which dips to 0.3 through the
  // green (6-8s) while the floor and the foot of the wall stay bright lime:
  // the same hue at full strength.
  vec3 bright(vec3 c) {
    float m = max(c.r, max(c.g, c.b));
    return c / max(m, 1e-3) * 0.85;
  }
`;

const SHELL_VERT = /* glsl */ `
  uniform mat4 uMainVP;
  varying vec3 vPos;
  varying vec4 vMainClip;
  void main() {
    vPos = position; // on the unit sphere: x across, y up, z <= 0 (the back)
    vMainClip = uMainVP * modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// THE WALL IS HOLLOW. The reference's arch is a dome cut in half, its
// open face toward the camera: the camera looks INTO it and every frame
// shows the concave inside - a lit band all along the cut edge (the rim
// that reads as a thin bright arch from the front and as a thick lit lip
// from the side), the glow at the foot where it meets the lit floor, a
// hot core low on the far wall behind the boy, and the deepest point of
// the bowl the darkest. Its outside is black, which is why edge-on (the
// first frame) nothing of its depth shows: only the sliver of the lit
// inside through the cut. The boy sits at the sphere's centre, inside it.
const SHELL_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  varying vec3 vPos;
  void main() {
    // The wall's lip that dips under the floor would be mirrored ABOVE the
    // floor on the reflection copy, as a dark rim along the horizon.
    if (uMirror > 0.5 && vPos.y < 0.01) discard;
    // A sphere's triangles wind outward, so from inside the bowl we see
    // back faces. (three.js flips the winding under the reflection's
    // negative scale, so the test is the same on both copies.) The outside
    // is BLACK on both: the reflection of a black surface is black. Painted
    // in the wall's colours it hung below the floor behind the tunnel as a
    // red band; discarded, the reflected INSIDE showed through it from
    // behind - the same band. Solid black hides everything behind it.
    if (gl_FrontFacing) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    vec3 col = wallColour();
    // The hot line where the wall meets the lit floor: the wall's own
    // colour pushed toward white in a thin band at its foot (the bloom pass
    // spreads it into the reference's haze).
    float foot = exp(-max(vPos.y, 0.0) * 28.0);
    // Hottest near the middle of the foot, where the lit floor meets it.
    float mid = 1.0 - smoothstep(0.2, 0.9, abs(vPos.x));
    col = col * (1.0 + 0.45 * foot) + vec3(0.12) * foot * mid;
    gl_FragColor = vec4(dither(col * uFade), 1.0);
  }
`;

const FLOOR_VERT = /* glsl */ `
  uniform mat4 uMainVP;
  varying vec2 vXY;
  varying vec4 vMainClip;
  void main() {
    vXY = position.xy; // built in XY, laid flat by its parent
    vMainClip = uMainVP * modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The floor is LIT, not luminous: light from the shell's foot (the line
// y=0 here, the camera's side is y>0 once the disc is laid flat), falling
// off with distance, and nothing at all behind the shell.
const FLOOR_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  varying vec2 vXY;
  void main() {
    float r = length(vXY);
    // The floor stays inside the tunnel: nothing past its footprint.
    if (r > 1.0) discard;
    float z = -vXY.y;
    vec3 col = floorBody();
    // The front edge catches the light: a thin bright line on the half of
    // the rim that faces the camera, in the front row's colour, at least
    // ~1.5 screen pixels thick and centred just inside the rim.
    vec2 camXZ = normalize(cameraPosition.xz + vec2(1e-4, 0.0));
    vec2 rimXZ = normalize(vec2(vXY.x, -vXY.y) + vec2(1e-4, 0.0));
    // The open front only: never near the tunnel's sides (z near 0).
    float facing = smoothstep(0.0, 0.3, dot(rimXZ, camXZ)) * smoothstep(0.08, 0.3, z);
    float w = max(1.0 / 90.0, fwidth(r) * 1.5);
    float de = (1.0 - r - 1.6 * w) / w;
    float line = exp(-de * de) * facing;
    vec3 edge = floorRow(floorFu(fragTop().x), 2.0);
    // Brighter than the band and a touch whiter: it is the rim catching
    // the light, and it glows past itself a little.
    col = mix(col, min(edge * 1.45 + 0.12, vec3(1.0)), clamp(line, 0.0, 1.0));
    col += edge * 0.35 * exp(-max(de, 0.0) * 0.35) * facing;
    gl_FragColor = vec4(dither(col * uFade), 1.0);
  }
`;



// ── Motion: tables of what was measured, smoothed between points ───────────
// The camera's angle round from edge-on (the clip's arch width at each
// moment, as a flat panel would need it), its pitch, its distance, and
// where it looks — all splines through the readings.
// Re-read 19 Sep from the arch's lit width at each whole second (asin of
// width over the front view's 0.87; ffmpeg's fps=1 frame N is at N-1 s):
// 10 degrees at 0s, 20 at 1, 33 at 2, 44 at 3, 56 at 4, 60 at 5, 67 at 6,
// 70 at 7, then easing to the front.
// SOLVED from the reference, frame by frame (19 Sep): for each of its 196
// frames at 15 fps, the angle at which our arch has the same width-to-height
// ratio as the reference's measured arch (its crown, horizon and edges),
// with the arch a full hemisphere and this camera's own height, distance,
// aim and lens. Sampled every 0.5 s and kept monotone.
const AZ_TABLE: [number, number][] = [
  [0.0, 4.9], [0.5, 7.0], [1.0, 9.7], [1.5, 13.2], [2.0, 16.5], [2.5, 20.2], [3.0, 26.4], [3.5, 32.4], [4.0, 35.9], [4.5, 35.9], [5.0, 37.6], [5.5, 40.7], [6.0, 44.0], [6.5, 47.1], [7.0, 52.9], [7.5, 59.9], [8.0, 66.1], [8.5, 66.1], [9.0, 66.1], [9.5, 66.1], [10.0, 68.5], [10.5, 75.0], [11.0, 88.3], [11.5, 90.0], [12.0, 90.0], [12.5, 90.0], [13.0, 90.0], [13.1, 90.0],
];
// The reference's FRAMING, solved per half second (19 Sep): the distance
// and aim that put our crown and horizon at the same heights in the frame
// as the reference's (fov 30, its measured angle and elevation), and a
// sideways pan that puts the arch at the same place across it.
const DIST_TABLE: [number, number][] = [
  [0.0, 3.06], [0.5, 3.06], [1.0, 3.08], [1.5, 3.08], [2.0, 3.1], [2.5, 3.14], [3.0, 3.18], [3.5, 3.26], [4.0, 3.32], [4.5, 3.4], [5.0, 3.48], [5.5, 3.6], [6.0, 3.74], [6.5, 3.9], [7.0, 4.08], [7.5, 4.24], [8.0, 4.46], [8.5, 4.42], [9.0, 4.46], [9.5, 4.54], [10.0, 4.64], [10.5, 4.7], [11.0, 4.8], [11.5, 4.88], [12.0, 4.94], [12.5, 4.84], [13.0, 4.82],
];
const AIM_TABLE: [number, number][] = [
  [0.0, 0.29], [0.5, 0.29], [1.0, 0.29], [1.5, 0.29], [2.0, 0.29], [2.5, 0.29], [3.0, 0.29], [3.5, 0.29], [4.0, 0.29], [4.5, 0.3], [5.0, 0.3], [5.5, 0.3], [6.0, 0.31], [6.5, 0.32], [7.0, 0.32], [7.5, 0.33], [8.0, 0.33], [8.5, 0.38], [9.0, 0.41], [9.5, 0.4], [10.0, 0.39], [10.5, 0.39], [11.0, 0.38], [11.5, 0.37], [12.0, 0.37], [12.5, 0.38], [13.0, 0.39],
];
const PAN_TABLE: [number, number][] = [
  [0.0, -0.02], [0.5, -0.01], [1.0, -0.0], [1.5, 0.01], [2.0, 0.035], [2.5, 0.05], [3.0, 0.03], [3.5, 0.04], [4.0, 0.08], [4.5, 0.09], [5.0, 0.09], [5.5, 0.095], [6.0, 0.09], [6.5, 0.05], [7.0, 0.05], [7.5, 0.06], [8.0, 0.085], [8.5, 0.055], [9.0, 0.035], [9.5, 0.025], [10.0, 0.025], [10.5, 0.025], [11.0, 0.05], [11.5, 0.035], [12.0, 0.01], [12.5, 0.005], [13.0, 0.005],
];
// The front view is LOW: the reference's floor disc is a flat ellipse, its
// front half 55px deep against a 392px radius (asin 0.14 = 8 degrees).
// Up to 12 degrees at the front: measured on the reference's front-on frames
// (9.7-12 s) from how deep its floor's front edge sits below the horizon,
// against the arch's half-width - 11 to 12.6 degrees.
const ELEV_TABLE: [number, number][] = [
  [0, 1.2], [1.5, 4], [4.0, 6], [7.5, 10], [10, 12], [13.1, 12],
];
const DEG = Math.PI / 180;
// How much of the bowl's inside the light fills, through the clip: the
// middle of the bowl against its crown, measured every 0.5s (fill.py).
const FILL_TABLE: [number, number][] = [
  [0, 0.9], [1, 0.9], [1.5, 0.7], [2, 0.4], [2.5, 0.4], [3, 1.0], [4, 1.15], [5, 1.1], [6, 1.0],
  [6.5, 0.6], [7, 0.08], [7.5, 0.04], [8, 0.2], [8.5, 0.65], [9, 0.8], [9.5, 1.05], [10.5, 1.0],
  [11.5, 0.9], [12.5, 0.9], [13.1, 0.9], [PALETTE_PERIOD, 0.9],
];
// The floor's brightness through the clip (a box just in front of the boy,
// against its 0.8 peak): bright all through the first six seconds, near
// black through the dark green, back up through the orange.
const FLOOR_TABLE: [number, number][] = [
  [0, 1.0], [1, 0.9], [2, 0.9], [3, 0.95], [4, 0.95], [5, 0.9], [6, 0.75], [6.5, 0.9], [7, 0.3],
  [7.5, 0.18], [8, 0.2], [8.5, 0.45], [9, 0.7], [9.5, 0.9], [10.5, 0.95], [11.5, 0.9], [12.5, 0.75],
  [13.1, 0.75], [PALETTE_PERIOD, 1.0],
];

// A Catmull-Rom spline through the readings (clamped at the ends): the
// value AND its rate of change are continuous across every point, so the
// camera never kinks at a table row the way piecewise easing does.
function table(tab: [number, number][], x: number) {
  const n = tab.length;
  if (x <= tab[0][0]) return tab[0][1];
  if (x >= tab[n - 1][0]) return tab[n - 1][1];
  let i = 1;
  while (i < n - 1 && tab[i][0] < x) i++;
  const [x0, y0] = tab[i - 1];
  const [x1, y1] = tab[i];
  const yPrev = tab[Math.max(0, i - 2)][1];
  const yNext = tab[Math.min(n - 1, i + 1)][1];
  const h = x1 - x0;
  const hPrev = i >= 2 ? x0 - tab[i - 2][0] : h;
  const hNext = i + 1 < n ? tab[i + 1][0] - x1 : h;
  const m0 = i >= 2 ? ((y1 - yPrev) / (h + hPrev)) * h : y1 - y0;
  const m1 = i + 1 < n ? ((yNext - y0) / (h + hNext)) * h : y1 - y0;
  const u = (x - x0) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * m1;
}
function rig(time: number) {
  // Past the clip's end the camera holds the front with a slow sway.
  if (time <= 13.1) {
    return {
      az: table(AZ_TABLE, time) * DEG,
      elev: table(ELEV_TABLE, time) * DEG,
      aim: table(AIM_TABLE, time),
      pan: table(PAN_TABLE, time),
      dist: table(DIST_TABLE, time),
    };
  }
  const u = time - 13.1;
  return { az: (90 - 5 * Math.sin(u / 2.4)) * DEG, elev: 12 * DEG, aim: 0.39, pan: 0.005, dist: 4.82 - 0.2 * Math.sin(u / 3.1) };
}

// The control colours, measured on the reference every 0.25 s (see the
// shader note): 53 moments x 35 colours, as hex. A data table, nothing more.
const DOME_GRID: string[] = [
  "860242aa0256ab0356ab0356aa02548500468c004a8d00498c00498a004661004865004767004668004367003f8801548d024f91024992024390013c000000000000a72376550b470e0013000000000000850351a0005c99086a00000000000065044f7400646f04ac00000000000026196003194b010627",
  "ab0051af0054b10155b00154ae00529b002b9e002a9f00299f00289d002673002b7800297900267b00237b001f9801329d012fa1002ba30027a20025000000000000c1106c8f127713001200000000000083004a8b005faa058d00000000000065004864005b63039e0000000000002f0b54020b3800001d",
  "a8005aad005daf005fb0015fac005da50024a80024a80024a70023a400228800178b00168d00168d00148b0013a50020a80022aa0024aa0025a70027000000000000b90e71800e7b1500100000000000007800457e0066a1008800000000000059004758005f61019c00000000000033003d010226020016",
  "a3036ea90373ab0475ab0475a90474a8002daa002daa002ca9002ba6002a8e00139100139100129000128e000fa90021ab0025ac012bab0332a90439000000000001b00677880b8a1a00150000000000006e004a6e006a9900850000000000014d004c4e00685c019600000000000033002e01001f030016",
  "940e8e9a0f939b10969a1096981095a6014aa80147a80147a60146a401489200149300159300169100178d001aaa0026ad0333ac0541a607539d08620000000100029b037b6e07811d00190000000100026000565e00739b007d00000001000144005a45007a5d019900000000000032002601001c030017",
  "6e1798711a9f711aa26f1ca26b1ba09a07809e06819d06829b06849606868f00338e003a8c00458e00528c005ea90237a80659a10977900c8e760d950000000200067b098551097d22012c00000002000552006e4d007e9600800000000100033a00783c018d5c039e0000000000022c002f00002202001b",
  "491b914c1d9b4a1e9d481e9c451e9b770f9a7a0e9b760e9b710e9b670f998d00618d006e8600797b00806a0181a7055aa40a85870f9d61129c3c139100000005000c5f118b311681200c4600000002000a44027d3f037d94007e0000000200082d048c35049843059000000001000423003c00002602001b",
  "2e1a7c351f8d32208e30208d2e1f8a2b1c94291b94211a90171b8c101e85670486560788400a85270c810f1377a6088d7b13a43f1b9d151c8808186e0000000800173e1d8a193e9016062f0000000500133407854107759801800000000300102408a03a08a1590a9f00000002000a0b004701002f04001c",
  "2d1e723426853227862f28852e28830a2478081f710619680414600412581d117f0a1775041568010f580109498114a430219e0921810614610610500000022d0337302b8a2a64aa1a1234000002180034310c804f0e6d9008790000010d01362d0ca44c0e9e7c0aa600000005001c02064803013409001e",
  "39307f3e39933c3c96393f98374099102c720b1f5f07154f061044050d3e03105a010a4c01053d01022f0000244021a009238106125a071049091a520100076f11742b3f955c89c128223f0000044400573b1379611b73880d720000042d046f450d9d6212978e0c9c0000020402300405480f003a100022",
  "484b994e59af4b60b54a64b94867ba204c931434730d245e091e56081d5702073b02032d00012200001f0102271d268c07135e090d450c215c143e8402000b892197385aa58da1d0231b330200096000684a17707a2d8589258b0200074c06885f0f90821389a5158f00000408023d13024a1e00381a001e",
  "5f68b35f75c1607dc86083cb5e85cb366db5224f96133d850e37830e3b8d03093a02052f010630020a4202166113217b090c4b0b185314418d2769b703000e8f34b3567bbdacb3cc241c3202000c7d0375581f718340936f44a602000b700695770f86951a7ead1c8002000714064e21044d2a003720001d",
  "7780bb7d92c9819ccf83a1d281a1d16299d53e7ec6256ebf1e6ec12075c6082568031c6203267b053b9d0752b11019680b104d103e912d7ac64f97d0070013603bb37a95ccbebbb42b24340600127c07756a2e7c86589c5d67b403000f850584901575a4276eae2575040009240b55340858390133270019",
  "8b8bb59aa2c8a3aecfa7b3d2a4b1d193b6dc6aa6d94b99d54498d44c9cd4185aab0950a90a60b91176c12185c4121b680d28782173c658a0d688aed61100174944b19eafd4c1c38f2c27300f00187d0c6f7a418c866499747db00900149804759f2268aa3073ab40a007000b38135e47125d45042e2c001a",
  "877e9eaca8c6b5b4ccbab9d0b9b8ceafbfdb91b7dd74addb70abd97badd73b81c81977c31e82c83691cd5698ce17267812479f3b92d482b0d9afb1cd2000204051b8acb7d5bfc36d302c2d1e0020800e6b854d908a6a878687b31800239f0c67a42667a63e858654b10d000e4819625b185b51092f2e021e",
  "716373b5a8b6c1b5bfc6bcc3c7bbc0ada8bbbcc5d9a7badaa7b5d8b0b2d5698dbd4e99d4599dd37ba0d29b9ace243f91206fc069abdbb0b7d6c8b3ae3100275865c7c0c1cdb1c43f2b2c242f002782126b8a59958371699899b7280028a7135da52f718c4b976160aa1500135d235d6d1f525910332a0823",
  "675b59b4a69ac2b5a0c8bb9fcabd98b2a6a6d0c8cbc8bdd0c8b6cdccb3c294a0bd8babd797a5d3b1a0cdc19fb5365da94593d59ab7dbcbb7c4cab66c46042d5872ccc8c3bd97c12d292e1b4904307c1c758863956b745f9ba7a8440133a7155f983e90644c856361932304186c295275224c61193f230c26",
  "797355b0a874bbb670bfbc69bebe60d0c495d4c7a1d3bda4d3b692d3b46cc0bfc9b7aed0c0a5c5c7a49ecaa2534f80c47caedcc2b8d6d2b985b1b430590c475e84d2cbc59c81b9231f29155a0837702f8c836b8e5c786597a9976c0640a4227d6d48974e4867656b973d1922702d4575264a5923461a0e28",
  "7a804e9da857a4b551a7bb4ba4bc45c2c761cbc75ccbbb48c2b42fafb023cbc1adcab0accca779c2a330979919719fd4abb9d9d3bab0bcb73589ad1f555bc76893d3c2c66c62aa1c1723117837b05448a27a6c74557d699da771b41f817f379f4d457b3e4c66688db657382b6d3042692a4d3f2644131228",
  "7182488ba54b92b24394b73e93b939aec448b5c537aab82695ad1c84a919cac287ccaf6ebfa52f8f99176c91128caed6c2bbd0d4ba6b95b1247aa91a4350bd76a2d6b4c44b429a14101d0e593bae415da66e6a57557d6497a444ad2c9d4e419d434061355c8572a1bb52402d623345502b4b2a253b10182f",
  "6482427aa24182ae3885b33483b43098c13695c02583b01b76a71673a515bac04eacab297e9a166491115e900faabaced0bba6aeb52f7ead1c67a2153542a48eb3d899bf301b7b1d0f190d3f3ba4456da65b6b4657784e6b9828823bad343f843746693a7ea794adb5473f324834452f29411b293a132739",
  "56823e689e386fa93270ad2c6dac2887bb2e82ba1f75ab166da31269a0129ebd307ea31a6495125a8f0e548b0dbebeb7c7ba6886b02372a8184192122f4794afc9df82ba260a5a230a14092f368c5a7ba6476c4f496d344c861e423fa53043772c659a6091abafaa97353e352f313f1d283c16394e223240",
  "497b3e5897375ba12e59a32954a22678b52c75b31d6aa515609b1155960f8cba296fa0175f9210538a0d3f7f0bc3bf9cb0b7477eae1f5fa016207f143162b3c2d0de70b224074b240912072a3c8a6a81a93e705f3f632d3f7518303b932d55903681ad8294aaada95c28373422303a1531471b495d2e363e",
  "38733c3f8c343a932b3193252791235da92857a6184b97103a8a0d26820b79b423659b14508a0e34790a166808bbbe7793b43073a91b318c130a5d16489ddad2d8d74fa421093d2b070d052264b17f8eb4417568335521225e1422448d337fbc6394b59f937e81a12c1e3534183543164560325968383828",
  "2f6f3b277f341e8030187c2d16752a389b2128911419800e0c6f0d07640e62a91d4e90102d770a0d6108054c09a8bb5480b026589d150d6e16053a127dc2e0d4dac62d8d230c443a020d073997d38a9cb049725a264a180e48181f6fb560a0c99695a88a8f3565971e1836381743562b596f515d602c3510",
  "2a6b3a1e6c3316652d135f2a1058281883280c711b075e10054d0c04410d42971725790b0a5d0b044309032d0991b7366fa81c24841306461403210eb8d4e2d2dd9e1167232d7c70030d0777b7de8ba497496537163c1309372050a4d69aaac3a294585b841f498819193c422b54634f626f5b5c341f2f09",
  "2a61361e5a2e155029114a26104424126726065017033d0e022e0b02250b1f80170a5e0e043f0a0226080116067db0295199160c6315042a1003170dd4d4dfcadc76094b267da8a3060f0aadc5db8fa0803e541e12331710392c94bedabaa99e728a254d7d181d7118244448465b6566655045541a132705",
  "2e5d331f512c174627143f24133b23125625063c1603290c021d09021709136e1b074a0f042b09021706010d0470aa25388b15094b16041e0e041610dcd5d8c2de5e0944289cb4b40d1411c7c9d6969c62324a1413301c1c4338bac3d6b6a85b5e851e3c7317145b21314747555a515c612e394e110d2005",
  "335a30244a291a3f24173822163621164823052913021709010f06010d070e551c04300c021807010a030006045b9e1d1d741306301104160d071f1be0d799b5dc420e4735c9c4c11b1c16d5c8b6889424253d0d183323355f51d1c4bb8aa0284f7c172261171543233d4a3f5559314959192c460b061604",
  "39592f2848281e3c251b38251a3826194020051e11010d06010905020e0b0d411a031e0a010c04000604010806438d18105713041f0d0518120d352fc6d759a5d62f246254dccbbc322b1ecdc8755c84141a350c213d2f637b69cbc46b6c971a356b10194b1a203c28424b3045531c3e530f1b3a09071006",
  "3e592f2d4a292242291f3f2b1f412c1e3e21061b11010b060109070315120d371802140600070200070502100e317d150a441103160a07201b194c43b3d6438fd028377266e1cdb05b4b39b8c64d447b1015300c2a4a39888771aec143619217255d0e1c421e2a3f2b3e4b243c4f132f4c0b0d3107080f05",
  "485d303752322c4e35284f392a533d2744270a211902100c021310072824113219010e0500070402100d05231f216713062f0e04140b0f352e377163a6d22f60bf1c5e958ee5cfa5866d4ca2c333376d0d132c0f3f6049ac967d98bd2b4882111b460f263c204150393b4b1e32480c1f40080a210910120a",
  "515f3344603f3a624739674f3d6d54334f33113229051f1a05252212473f19351f020f0702100d04201d0f423b16511205200b061b131f524763908090c8212a9f1e6faa9ee6cd9fab8b4997c125295d0b132c12656f57c49d758ab81e2d6c0b1c360f393b2561664e394a1c253e091031050d180a181a11",
  "5c6539557352537d6356856c5f8b723f60441c473d0c352f11443c2f7365203d2a05191305211d103f372d7263134312061c0c0d2d26477f6fa1a29189c71a59b51e528473e6bb7fb3882e7bb3171748081c2a19836c54ce9c6682b22620550d1e2c11473e2983856938431c162c080b1c0914190f242016",
  "70764d718d6e779a807ea18987a58c50785e2b60531d574b2b7161639c892749380a2822113e363071617893811446140a2514285b4f99ab97d4ac80a4cf260930103f594ad19968e0a04141900e19330b292f1b7d6242c59d75506718558713213b1c374737776a5436371a121d0c0e180d1c221820180c",
  "82825d8d9f8395aa929eae99a8ae98688c7541796a37786955907e97a796315645143b33266053648c79af95881d501715391e487c6ec5b199e2ae6c469b120e280c4a4f3cc88841de96303d87121c2c0f3233227e7151d0a78a4b4a1f172d0e161f12353d30513925362f1a191d12151b1426261c1d1007",
  "9a8c6db1a992bbb19ec2b3a2c6b09f90a58f729d8a7499869d9b8ac6a79c4b74622d6355578875a58f80cd9382183d1e19403179a08fd9af90e2aa4f308514132212746952cf8b2bdf86471e560f202411464633a48666dca06852451e1b281223261c5b624f653f2042321c23231825251b3c2e23241308",
  "a6886dc5a894cfaf9fd4b1a1d4ac9ab5af9eaaa999b19a8dc6978edba89673927f5e89769b9080c98b7eda975f203e292d5a4aa9ae9fe2af76e1a3471e69131e271d936f56cf7a27dc8a701b40112a2b1d65634dc0886add9f40573f1d2a26173a3a308165535d371547301b31261b39281f4c3021251107",
  "9a745ccaa28bd5ac96d8ae94cb9e7fc8b0a1c8aa9fcb998fd79886e2ac7e99a593909584bb8c81d58c69dc9c3f3048394c7466c5b0a3e3ab55e1963b30751c27352cb17e62d3742bd4a0b21b2f1434332883725dcd8257dc8f385b3d1c32271d4f54479c6b546437174c311c3f2a1e492c215a321f291308",
  "9a6e53cd9e7cd9aa80dbad78c39456d6b09edbaa98db997ade9e5ce4b34dbeaea0be9489d38a72d89439db9b234d62557f9587d9ad97e2a639de863f267220415548c88959d56f3bb08fbb22291c464b3ea77860cd7f34d97a4e5d391c3d352c7a7667ad78366a351e54331a4d2c1e5a301d6636162f150c",
  "966744c3935cd7a961d0a250bc8c3ddcb08ee3ac79dfa148dea52ee4af33d4b0a1d4937dd89244d7941ed9871d728174aea498e0ae75e0952fda7c4c165229667c6dd5944cd5785d8175b02a322b626757bb7751c7702cd17c7e5e36204d4e42a68979b57a24733a3159321c5a321c643618693612351811",
  "9b693ec8954bdaa74ed6a044c08537dfb175e4b04bdda327dc9a20e39b2ddeb196dc9758d79623d37f18d56e1d979a8ccca899e2ae4dde8031d87c65223c2a909988d89539d285865c77c43d4d4788796cc07639bf5b41c483ac613a2b6d6e60c49870b7682e7846535e331f63361a6a381169310f3f1e1b",
  "a0693fcb9045dc9d47d89441be7836e1b061e2aa31da901eda801ee1862ee2b27fdb9c33d4861acd6217d36126b6a89adaab8be1a438da7340d0858b303c39b5a699da902fcc8ea7417bd75c776caa8071bd6d2ab45964a580c4694841958778dca747ba7a807b507461332468361869330f6629134b2521",
  "a76a43d38f4bdc9346dc8d44c0713ae2ad56e09d29d77c1bd56b1ce07b33e3b26ad99724cf7217c85118d36334c8ae9ddfac76de952ed77350c789a33a514ec5ada1db8f32c892b33474d57e8f81ba836eb76026ab5a7a8076c9745a51bfa389d78a33c9888f7559956333266d3516682c0e6224165c2d28",
  "ad6b4ad8884edb8648db8148c66f47e2a34fdc8526d0611ad15c20e07b47e3af4fd5831cc85516c64c22d37058d8b095e0aa55db7c2ad3796bb589bc658b82d2b6a9de8d37be9acb2569cfa89f94c58563b14f2893599b425ec28a736cdca34fd06837c484a14050a266352c6f3516662511602126623131",
  "b3674fd87f54dc7f51db7e56c7715ae2954ad76e25cd5420d26032e08567e2a341cf671ac3471bc4573ace8085e0af7ede9e3cd76a2ecc808c9d84cca3baafcabaa8e18b419f99db1a63c9c5a99ecd8354a945366a4fa81a49b0ab9382d67f3bc66b5fa17dc4364ca66b3833702e166824215b233d602d36",
  "b46655d87d5ddb7f5fda8168c6766be28b4ad6652bce592ed2694cdd8f84e1943bcb561bc34b27c1605cca88a5e3ad67dc8e31d5683cc385a8867ed1c6c8becdc3b4e29455768bda125bc2d5ad9ccf8241a242475146a60f3ca1caa47cd47040bb6f89756cc42347a66e3a38702b1c642a3b5321475f2b37",
  "c07068d88271d98778d78b84c78286e18251d56740cb6451cc797bd79ca9de7e37c84f26c05847b76c90bd8dc6e3a44ad9772dd2715eab86c65f70cfddc8c0dbcec1de976a4e7ad40942ace0af8dcc7c31983f60333a9c082680da9f61cc735f9c6bb04051b612399b6e393f6e2d2f5a2c52431e4b5b2639",
  "c17a7fd38d8ed49499d096a3c68ba5df866cce756cbf7388c182afcfa0c9db7341c45943b4647f9d72bc9d8cd3df913ad66a36ca7d8d807fd2355fc3e6c7bce1cebfdf9b892966cb03217fe1ab72c66a2f863e741c2f8903155cdc9059c17a926c5cb4213fa40c2683683548653249432659351b4e54223a",
  "c686a3cf96b5cf9ac0cb9ac7be8fc3d89498c380a6ab79be9d85d0b29fdad67967ba687f9b6cb56a6cc96b7bd2dc7d38d46f57b787bc486ccb154db2e8c9aae4c1a2d19ab11452b7041162e09f52bd553c6d3c860e246f020d4fdb8e68ae74b34348ad143191081c77613151562f5b2e205c2417504f2141",
  "a979b1b793ccb298d2a995d2927ec1d09bc1a487cf7879d06979d2858edbce899ca370b66469c82b59bb3466c6db774ecc7d888f86d21756b9083699eacb90e39f63ad8dcc0a42ac062caddd8b4baf4e6745358b081657031268c78068896cc0243ea50a237a09248e4f29533b275c1b1b5514144a41204a",
  "987bbf9e8fd4948ed68988d47a76c7bd9dd47b7fd34869c93767c7577cd6c28cbd7d70c8375bbe0e49a91756b8d87b68c285ab6b7dd20a47ad052483ebcd8fdd89627f78c8052b900b40ceda8162a14e892d2d8606114b031882b16b696762c116399e0717641026974024552920590f164b0b1244361e50",
  "7871c56f7cd36079d35573d14f65c59693db3c69c91352b20f4eb12267c8a18cd34462c40d46a70633990a41a8d18391a68ac83a6bc606319b03146bebca7fd2858a475ebc04156d2444dccf839285499c182477050c48041fa1955d864057bd0c2c8b06125f122590321e53181a52061040040e3d261b53",
];
function makeGridTexture() {
  const W = 40;
  const Hk = DOME_GRID.length;
  const data = new Uint8Array(W * Hk * 4);
  DOME_GRID.forEach((row, k) => {
    for (let i = 0; i < W; i++) {
      const o = (k * W + i) * 4;
      data[o] = parseInt(row.slice(i * 6, i * 6 + 2), 16);
      data[o + 1] = parseInt(row.slice(i * 6 + 2, i * 6 + 4), 16);
      data[o + 2] = parseInt(row.slice(i * 6 + 4, i * 6 + 6), 16);
      data[o + 3] = 255;
    }
  });
  const tex = new THREE.DataTexture(data, W, Hk, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
function pingPong(x: number, len: number) {
  const m = x % (2 * len);
  return m < len ? m : 2 * len - m;
}

// ── Materials, built by hand ───────────────────────────────────────────────
// react-three-fiber copies a `uniforms` prop into an object of its own, so a
// loop writing to the original would drive uniforms no material reads.
type Uniforms = {
  uTime: { value: number };
  uPeriod: { value: number };
  uPal: { value: THREE.Texture };
  uMirror: { value: number };
  uFade: { value: number };
  uRes: { value: THREE.Vector2 };
  uCrownX: { value: number };
  uFill: { value: number };
  uFloorFill: { value: number };
  uGrid: { value: THREE.Texture };
  uKey: { value: number };
  uFrontY: { value: number };
  uFloorX: { value: THREE.Vector2 };
  uMainVP: { value: THREE.Matrix4 };
  uBox: { value: THREE.Vector4 };
};
function makeMaterials(pal: THREE.Texture, grid: THREE.Texture) {
  const uniforms = (mirror: number): Uniforms => ({
    uTime: { value: 0 },
    uPeriod: { value: PALETTE_PERIOD },
    uPal: { value: pal },
    uMirror: { value: mirror },
    // 1, not 0: the canvas draws a frame the moment it is built, before the
    // loop has run once, and that frame must not be blank.
    uFade: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uCrownX: { value: 0.5 },
    uFill: { value: 1 },
    uFloorFill: { value: 1 },
    uGrid: { value: grid },
    uKey: { value: 0 },
    uFrontY: { value: 1 },
    uFloorX: { value: new THREE.Vector2(0, 1) },
    uMainVP: { value: new THREE.Matrix4() },
    uBox: { value: new THREE.Vector4(0, 0, 1, 1) },
  });
  // The wall is a hollow bowl: both faces drawn, the inside lit and the
  // outside black, and it writes depth so the black outside can never
  // paint over the lit inside in front of it.
  const shellLike = (mirror: number, frag: string) =>
    new THREE.ShaderMaterial({
      uniforms: uniforms(mirror),
      vertexShader: SHELL_VERT,
      fragmentShader: frag,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
    });
  const floorLike = (mirror: number) =>
    new THREE.ShaderMaterial({
      uniforms: uniforms(mirror),
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      side: THREE.DoubleSide,
      transparent: true,
      // Written before the wall (so it never lands on the wall's last row
      // at the join). Opaque: it IS the reference's colour at that pixel.
      depthWrite: mirror < 0.5,
    });
  return {
    shell: shellLike(0, SHELL_FRAG),
    floor: floorLike(0),
  };
}

// The boy: a seated model (leaning back on his hands, legs out, looking
// up — the reference's pose), scaled to the reference's seated height:
// about 50px against a 514px shell radius in the front view, a tenth.
const BOY_HEIGHT = 0.085; // the reference's boy is tiny: ~40px against a 392px radius
const SHELL_CAP = 1.0; // the arch's height, of its half-width
const BLOOM = { strength: 0.08, radius: 0.5, threshold: 0.8 };
const REFLECT_STRENGTH = 3;
// Low on purpose: the mirror image is scaled up, so it reads as a soft blur,
// the reference's diffuse reflection, not a sharp copy of the dome.
const REFLECT_RES = 96;
// How far past the floor's rim (in radii) the reflection fades to black.
const REFLECT_FADE = 1.3;
const FADE_VERT = /* glsl */ `
  varying vec2 vXY;
  void main() {
    vXY = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FADE_FRAG = /* glsl */ `
  varying vec2 vXY;
  void main() {
    float d = max(length(vXY) - 1.0, 0.0);
    float a = smoothstep(0.0, ${REFLECT_FADE.toFixed(3)}, d);
    // Nothing behind the opening's plane: there the ground lies beside and
    // behind the tunnel's curved outer shell, and a reflection of the lit
    // floor showed round it. Black from a little in front of the plane back.
    float z = -vXY.y;
    a = max(a, 1.0 - smoothstep(0.05, 0.35, z));
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`;

function Boy() {
  const { scene } = useGLTF(MODEL_URL);
  const object = useMemo(() => {
    const o = scene.clone(true);
    o.renderOrder = 4;
    // Seat on the floor, the model's own height scaled to BOY_HEIGHT.
    const box = new THREE.Box3().setFromObject(o);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = BOY_HEIGHT / Math.max(size.y, 1e-3);
    o.scale.setScalar(s);
    o.position.set(0, -box.min.y * s, 0);
    return o;
  }, [scene]);
  // A plain black silhouette, always fully there (no fade-in). It is set on
  // the meshes in an effect, never during render.
  useEffect(() => {
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    object.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = mat;
    });
    return () => mat.dispose();
  }, [object]);
  // INSIDE the tunnel: half a radius behind the opening, so on
  // the entrance - the camera coming in from the side, a few degrees round
  // from edge-on - the wall's black outside stands between him and the
  // camera and he cannot be seen at all. He appears only as the camera
  // comes round to look in through the opening. Facing the back wall (the
  // model looks along +z; rotated to look along -z).
  return <primitive object={object} position={[-0.1, 0, -0.5]} rotation={[0, Math.PI, 0]} renderOrder={4} />;
}

function Scene({
  running,
  reducedMotion,
  wrap,
}: {
  running: boolean;
  reducedMotion: boolean;
  wrap: React.RefObject<HTMLDivElement | null>;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const res = useMemo(() => new THREE.Vector2(), []);
  const palette = useMemo(() => makePaletteTexture(), []);
  const grid = useMemo(() => makeGridTexture(), []);
  // Bloom: every bright part bleeds soft light into the dark, as the
  // reference's render does. No colour conversion at the end (the shaders
  // write display values), so the last pass is a plain copy.
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const dprNow = useThree((s) => s.viewport.dpr);
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM.strength, BLOOM.radius, BLOOM.threshold));
    c.addPass(new ShaderPass(CopyShader));
    return c;
  }, [gl, scene, camera]);
  useEffect(() => {
    composer.setPixelRatio(dprNow);
    composer.setSize(size.width, size.height);
  }, [composer, size, dprNow]);
  useEffect(() => () => composer.dispose(), [composer]);
  useFrame(() => composer.render(), 1);
  const mats = useMemo(() => makeMaterials(palette, grid), [palette, grid]);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      palette.dispose();
      grid.dispose();
    },
    [mats, palette, grid],
  );

  const shellGeo = useMemo(
    // A quarter-sphere: the back half (z <= 0) of the upper hemisphere,
    // its cut face - a semicircular arch - in the x/y plane, open to +z.
    // It runs a little past the equator, under the floor: ending exactly
    // at the floor, the seam drew as a dashed dark line along the horizon.
    () => new THREE.SphereGeometry(1, 256, 64, Math.PI, Math.PI, 0, Math.PI / 2 + 0.03),
    [],
  );
  // Same segment count as the bowl's rim, so the two outlines coincide
  // exactly and the horizon has no stair-steps.
  const floorGeo = useMemo(() => new THREE.CircleGeometry(1.0, 512), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const crown = useMemo(() => new THREE.Vector3(), []);
  const probe = useMemo(() => new THREE.Vector3(), []);
  const mainVP = useMemo(() => new THREE.Matrix4(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  // Parallax inputs, written by listeners, read by the loop.
  const pointer = useRef({ x: 0, y: 0 });
  const eased = useRef({ x: 0, y: 0 });
  const scroll = useRef(0); // -1..1: where the section sits in the viewport

  // Time is accumulated from dt so a paused loop (off screen) does not jump.
  const t = useRef(0);

  // Parallax inputs: the pointer over the section (-1..1 each way) and the
  // section's place in the viewport (-1 when it is a viewport below, +1
  // a viewport above). Both are cheap listeners writing refs.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      pointer.current.x = ((e.clientX - b.left) / b.width) * 2 - 1;
      pointer.current.y = ((e.clientY - b.top) / b.height) * 2 - 1;
    };
    const onLeave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
    };
    const onScroll = () => {
      const b = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      scroll.current = Math.max(-1, Math.min(1, ((b.top + b.height / 2) / vh - 0.5) * -2));
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [wrap]);

  useFrame((_, dt) => {
    if (running && !reducedMotion) t.current += Math.min(dt, 0.05);
    // The clip opens on the sliver and holds it: the first HOLD seconds
    // after the section arrives are its first frame, in full, before the
    // inflation begins. No arrival dimming — the reference's first frame
    // is as bright as any.
    // Ease from the hold into the run (no step in velocity at HOLD).
    const raw = Math.max(0, t.current - HOLD);
    // No ease-in: the colour is the reference's own, frame by frame, so our
    // clock must be the reference's clock (an ease put us ~1 s behind it).
    const time = raw;
    const fade = 1;

    const r = rig(reducedMotion ? 9.2 : time);
    // Parallax: the pointer nudges the camera a few degrees (eased, so it
    // never snaps), and the section's scroll position lifts or lowers the
    // aim so the scene drifts against the page.
    const k = reducedMotion ? 0 : 1;
    eased.current.x += (pointer.current.x - eased.current.x) * 0.06;
    eased.current.y += (pointer.current.y - eased.current.y) * 0.06;
    const az = r.az + eased.current.x * 2.5 * DEG * k;
    const elev = Math.max(1.5 * DEG, r.elev - eased.current.y * 1.6 * DEG * k);
    const dist = r.dist;
    // From edge-on at -x (the wall to screen-left, the lit floor running
    // screen-right, as in the clip) round to the open side at +z.
    camera.position.set(
      -dist * Math.cos(az) * Math.cos(elev),
      dist * Math.sin(elev),
      dist * Math.sin(az) * Math.cos(elev),
    );
    target.set(0, r.aim - scroll.current * 0.22 * k, 0);
    // The pan: the aim slid along the camera's own right, as solved.
    right.set(-camera.position.z, 0, camera.position.x).normalize();
    target.addScaledVector(right, -r.pan);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    mainVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    gl.getDrawingBufferSize(res);
    // The crown of the arch on screen, for the colour sweep.
    crown.set(0, SHELL_CAP, 0).project(camera);
    const crownX = crown.x * 0.5 + 0.5;
    // Our arch on screen, in drawing-buffer pixels from the top, measured
    // exactly as the reference's was: the crown, the horizon (the foot
    // line, through the arch's centre) and the half-width at the horizon.
    const toPx = (v: THREE.Vector3) => [(v.x * 0.5 + 0.5) * res.x, (0.5 - v.y * 0.5) * res.y];
    const [, topPx] = toPx(crown);
    const [, hzPx] = toPx(probe.set(0, 0, 0).project(camera));
    const [lx] = toPx(probe.set(-1, 0, 0).project(camera));
    const [rx] = toPx(probe.set(1, 0, 0).project(camera));
    // The clip's frame: its own clock, 15 fps; past its end the front view
    // keeps animating by running its last 4.5 s back and forth.
    const clip = time <= 13.0 ? time : 8.5 + pingPong(time - 13.0, 4.5);
    const key = Math.max(0, Math.min(DOME_GRID.length - 1, clip / 0.25));
    // The floor's front edge on screen: the lowest point of its rim.
    let frontY = hzPx;
    let floorL = Infinity;
    let floorR = -Infinity;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const [fx, fy] = toPx(probe.set(Math.cos(a), 0, Math.sin(a)).project(camera));
      if (fy > frontY) frontY = fy;
      if (fx < floorL) floorL = fx;
      if (fx > floorR) floorR = fx;
    }
    // Same +1.0 as the shader's sweepSeconds: the tables were read on the
    // reference's clock.
    const cyc = (((time + 1.0) % PALETTE_PERIOD) + PALETTE_PERIOD) % PALETTE_PERIOD;
    const fill = table(FILL_TABLE, cyc);
    const floorFill = table(FLOOR_TABLE, cyc);

    for (const m of Object.values(mats)) {
      if (!(m as THREE.ShaderMaterial).isShaderMaterial) continue;
      const u = (m as THREE.ShaderMaterial).uniforms as Uniforms;
      u.uTime.value = time;
      u.uFade.value = fade;
      u.uRes.value.copy(res);
      u.uCrownX.value = crownX;
      u.uFill.value = fill;
      u.uFloorFill.value = floorFill;
      u.uKey.value = key;
      u.uFrontY.value = frontY;
      u.uFloorX.value.set(floorL, floorR);
      u.uMainVP.value.copy(mainVP);
      // Centred between the arch's two feet, as the reference was measured
      // (the midpoint of its edges, not its crown, which perspective shifts).
      u.uBox.value.set((lx + rx) / 2, topPx, hzPx, Math.abs(rx - lx) / 2);
    }
  });

  return (
    <>
      {/* A little squat: the reference's arch is 350px tall on a 780px
          base (0.9 of the radius). */}
      {/* Draw order: the ground disc (opaque black, so nothing under the
          floor shows through it), the reflection, the bowl (opaque), then
          the floor's light ADDED over the bowl's foot, the rim's hairline,
          and the boy last, a black cut-out over all of it. */}
      <mesh geometry={shellGeo} material={mats.shell} scale={[1, SHELL_CAP, 1]} renderOrder={2} />
      <mesh
        geometry={floorGeo}
        material={mats.floor}
        rotation={[-Math.PI / 2, 0, 0]}
        // Flush with the bowl's foot: 0.003 below it, the gap read as a
        // one-pixel black line along the horizon from a low camera.
        position={[0, -0.0004, 0]}
        renderOrder={1}
      />
      {/* The glossy black ground: a real mirror of the scene, blurred and
          fading with distance, as the reference's floor reflects its dome.
          The lit floor disc covers it inside the tunnel. */}
      <ambientLight intensity={1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} renderOrder={0}>
        <circleGeometry args={[7, 96]} />
        <MeshReflectorMaterial
          resolution={REFLECT_RES}
          blur={[300, 300]}
          mixBlur={1}
          mixStrength={REFLECT_STRENGTH}
          mixContrast={1}
          // 1: the ground itself is black; all it shows is the reflection.
          mirror={1}
          depthScale={0}
          minDepthThreshold={0}
          maxDepthThreshold={0.35}
          depthToBlurRatioBias={0.3}
          roughness={1}
          metalness={0}
          // White and lit by the ambient light below: drei multiplies the
          // reflection by the surface colour, so black showed nothing.
          color="#ffffff"
        />
      </mesh>
      {/* The reflection fades with distance from the floor's rim: black laid
          over the mirror, clear at the rim, opaque REFLECT_FADE past it. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0015, 0]} renderOrder={1}>
        <circleGeometry args={[7, 96]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          vertexShader={FADE_VERT}
          fragmentShader={FADE_FRAG}
        />
      </mesh>
      <Suspense fallback={null}>
        <Boy />
      </Suspense>

    </>
  );
}

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export default function HorizonDome({ className = "" }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  // On a phone: built on approach and released when far (useSceneLease) —
  // never built at idle, see below.
  const near = useSceneLease(wrap, { label: "Footer" });
  // Built in the first quiet moment, as the globe is (see SeasonsGlobeLazy).
  // Mounting on approach alone left the context, the shaders and the model
  // still being set up as the reader arrived: measured, the section sat
  // empty at 38-66% on screen, its canvas still the unsized 300x150
  // default. Built early, it is finished and waiting. It draws no frames
  // until it is in view, so an unseen dome costs nothing per frame.
  const [built, setBuilt] = useState(false);
  useEffect(() => {
    // Not on a phone: an early build holds the context and the model for
    // the whole visit, and on an iPhone that memory, with the globe's, is
    // what got the tab killed near the footer.
    if (isPhoneDevice()) return;
    // Nor where the CPU would draw it: there it never gets cheap (gpu.ts).
    if (!hasGPU()) return;
    const cb = () => setBuilt(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(cb, { timeout: 700 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(cb, 300);
    return () => window.clearTimeout(id);
  }, []);
  // Two gates, not one. `inView`: any of the section on screen, so frames
  // are drawn and the reader sees the opening sliver the moment it scrolls
  // in. `running`: most of it on screen, and only then does the clip's
  // clock run, so the reader still arrives on the first frame, not mid-turn.
  const [inView, setInView] = useState(false);
  const [running, setRunning] = useState(false);
  // A lost context is recovered by remounting the canvas: a new renderer,
  // with every material and texture rebuilt.
  const [ctxKey, setCtxKey] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      setRunning(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.intersectionRatio >= 0.8) setRunning(true);
        else if (e.intersectionRatio < 0.4) setRunning(false);
      },
      { threshold: [0, 0.01, 0.4, 0.8, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={wrap}
      className={`relative w-full overflow-hidden ${className}`}
      aria-hidden
      style={{
        // Soft top and bottom: the floor's glow and the reflection never
        // meet the section's edges with a hard line.
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, #000 5%, #000 92%, transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, transparent 0%, #000 5%, #000 92%, transparent 100%)",
      }}
    >
      {(near || built) && (
        <Canvas
          key={ctxKey}
          className="absolute inset-0"
          frameloop={inView ? "always" : "demand"}
          flat
          camera={{ position: [-3.3, 0.17, 0], fov: 30, near: 0.05, far: 50 }}
          // Full device pixels up to 2x: capped lower, the canvas is upscaled
          // and the shell's edge and the floor's rim line read as pixelated.
          // (1.5x on phones — memory; see sceneDprCap.)
          dpr={[1, sceneDprCap()]}
          // Transparent: the site's own background (the page-wide Unicorn
          // scene over the maroon ground) shows through; the dome, its
          // floor and their glow sit on it, and nothing else is painted.
          gl={{ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 1);
            // The page runs close to the browser's context cap, so this one
            // can be taken. Claim the loss (without preventDefault the
            // browser never restores it; see MetallicPaint), then rebuild.
            const canvas = gl.domElement;
            canvas.addEventListener("webglcontextlost", (e) => e.preventDefault(), { once: true });
            canvas.addEventListener("webglcontextrestored", () => setCtxKey((k) => k + 1), { once: true });
          }}
        >
          <Scene running={running} reducedMotion={reducedMotion} wrap={wrap} />
        </Canvas>
      )}
    </div>
  );
}

useGLTF.preload(MODEL_URL);
