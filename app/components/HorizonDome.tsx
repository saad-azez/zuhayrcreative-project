"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useSceneLease } from "@/app/animations/hooks/useNearViewport";
import { isPhoneDevice, sceneDprCap } from "@/app/lib/device";
import { useKillSwitch } from "@/app/lib/killSwitch";

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
  [0.0, 340, 0.95, 0.72],
  [1.0, 300, 0.95, 0.70],
  [2.0, 262, 0.92, 0.66],
  [3.0, 232, 0.85, 0.66],
  [3.6, 236, 0.55, 0.80],
  [4.0, 40, 0.14, 0.96], // the white phase
  [4.4, 55, 0.40, 0.92],
  [4.8, 85, 0.60, 0.84],
  [5.2, 105, 0.62, 0.84],
  [6.0, 128, 0.62, 0.80],
  [7.2, 128, 0.55, 0.72],
  [8.0, 122, 0.48, 0.70],
  [8.6, 70, 0.32, 0.72],
  [9.0, 34, 0.55, 0.86],
  [9.5, 28, 0.62, 0.88],
  [10.8, 24, 0.60, 0.86],
  [11.6, 348, 0.50, 0.80],
  [12.2, 290, 0.55, 0.76],
  [12.9, 228, 0.75, 0.80],
  [13.4, 250, 0.85, 0.70],
  // Then the brand: the services tunnel's six stops (WebGLTextTunnel),
  // as the cycle's own colours, before it wraps to the opening magenta.
  [14.0, 348, 1.00, 0.60], // #9A001F crimson
  [14.9, 356, 0.99, 0.77], // #C4010D brand red
  [15.8, 357, 0.98, 0.94], // #F00512 scarlet
  [16.8, 20, 0.88, 1.00], // #FF691E ember
  [17.7, 5, 0.94, 1.00], // #FF230F hot red
  [18.5, 336, 0.95, 0.48], // #600026 deep maroon, lifted a touch for the wrap
  [19.4, 332, 0.85, 0.62], // on the way back to the opening magenta
];
const PALETTE_PERIOD = 20.6;
const HOLD = 0.9; // seconds on the opening sliver before the clip runs

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
  for (let i = 0; i < N; i++) {
    const [r, g, b] = sample(i / N);
    data[i * 4] = r * 255;
    data[i * 4 + 1] = g * 255;
    data[i * 4 + 2] = b * 255;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
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

  // The palette at a point: seconds of scroll, wrapped.
  vec3 pal(float seconds) {
    return texture2D(uPal, vec2(fract(seconds / uPeriod), 0.5)).rgb;
  }
  // Where a point sits in the palette: the top of the shell reads the
  // clock; screen-left lags it, screen-right leads (about a second each
  // way, measured across one frame); the foot lags the top by 0.45s.
  float shellSeconds(float up) {
    float across = gl_FragCoord.x / uRes.x * 2.0 - 1.0;
    // +1.2: measured against the clip's mean shell hue at twelve
    // timestamps, the stops as written ran about a second late.
    return uTime + 1.2 - 0.45 * (1.0 - up) + 1.1 * across;
  }
`;

const SHELL_VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vView;
  void main() {
    vPos = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const SHELL_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  varying vec3 vPos;
  varying vec3 vView;
  void main() {
    // The wall is flat: x across (-1..1), y up (0..1), z = 0.
    float up = clamp(vPos.y, 0.0, 1.0);
    vec3 col = pal(shellSeconds(up));

    // The depth map: the normal a hemisphere of the same outline would
    // have here, pointing out toward the open side. Where it turns away
    // from the viewer (the rim of the fake dome) the surface lifts, as a
    // real dome's does at a glancing angle.
    float r2 = vPos.x * vPos.x + vPos.y * vPos.y;
    vec3 n = normalize(vec3(vPos.x, vPos.y, sqrt(max(0.0, 1.0 - r2)) * 1.4));
    float facing = abs(dot(n, normalize(vView)));
    float rim = pow(1.0 - facing, 2.0);

    // THE LIGHT IS A SPOT, NOT A COAT. Measured on the client's reference
    // (ssstwitter.com_1789240803893) on a 6x6 grid: the wall is lit from
    // one bright core — near-white at its centre — falling off smoothly in
    // every direction to black at the top and on the far side, and the
    // core wanders: centre-high early in the cycle, low and to the left
    // through the green, back up through the orange. Ours had painted the
    // whole wall one flat colour at 0.9 with a hard edge ("the gradient
    // looks nothing close"): the same coarse statistics — peak, mean,
    // centroid, spread — but a plateau where the reference is a gradient.
    // So: a Gaussian around a slowly wandering point, a low floor so the
    // wall's shape still just reads, the core washed toward white, and the
    // foot's glow kept where the wall meets the lit floor.
    vec2 hot = vec2(-0.22 + 0.32 * sin(uTime * 0.45), 0.48 + 0.14 * sin(uTime * 0.31 + 1.7));
    vec2 dh = vec2(vPos.x, up) - hot;
    float glow = exp(-dot(dh, dh) / 0.34);
    float foot = exp(-up * 2.6);
    float lift = 0.14 + 0.78 * glow + 0.12 * rim + 0.45 * foot * (0.35 + 0.65 * glow);
    col = mix(col, vec3(1.0), 0.38 * glow * glow + 0.25 * foot * glow);
    col *= lift;

    gl_FragColor = vec4(col * uFade, 1.0);
  }
`;

const FLOOR_VERT = /* glsl */ `
  varying vec2 vXY;
  void main() {
    vXY = position.xy; // built in XY, laid flat by its parent
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
    // The disc is laid flat with local -y toward the open side (world +z);
    // the wall stands on the line z = 0. A point's distance to the light is
    // how far it sits in front of that line; behind it there is nothing.
    float z = -vXY.y;
    float d = z;
    float behind = 1.0 - smoothstep(-0.01, 0.01, d);
    d = max(d, 0.0);

    // The light's colour where it lands: the wall's colour at the same
    // position ALONG the cut line. Edge-on that reads as a gradient across
    // the strip's thickness (magenta at the far edge, the blue that
    // precedes it at the near edge, in the first frame); from the front it
    // is the rainbow along the disc's rim.
    vec3 col = pal(uTime + 1.2 - 0.45 + 1.6 * clamp(vXY.x, -1.0, 1.0));

    // An inverse-square-ish falloff from the wall, hot right at the arc,
    // a faint lift at the disc's own rim.
    float fall = 1.6 / (1.0 + 1.4 * d * d);
    float line = 1.0 * exp(-d * 22.0) + 0.6 * exp(-d * 5.0);
    // Nearest the wall the floor goes pale, the way the clip's does.
    col = mix(col, vec3(1.0), 0.45 * exp(-d * 3.5));
    // The disc's own edge: a thin hot line, the way the clip's rim glows.
    float rim = 0.3 * smoothstep(0.86, 0.995, r) + 1.6 * exp(-(1.0 - r) * 45.0);
    float bright = (1.0 - behind) * (0.04 + fall + line + rim);

    // The floor is glass, not paint: its light is ADDED to whatever is
    // behind it, so the page's Unicorn background shows through everywhere
    // and only brightens where the wall's light lands. A faint film of alpha
    // keeps the lit strip reading as a surface.
    float edge = 1.0 - smoothstep(0.994, 1.0, r);
    // Most of the floor is see-through: only a faint wash of the wall's
    // light across it, with the light concentrated in the two lines, at
    // the wall's foot and on the rim, as the reference's dark strip is.
    float light = (0.22 * fall + line + rim) * (1.0 - behind) * edge * uFade * 0.5;
    if (uMirror > 0.5) light *= 0.4;
    gl_FragColor = vec4(col * light, clamp(light * 0.18, 0.0, 0.35));
  }
`;

// ── The beam ───────────────────────────────────────────────────────────────
// A thin curtain of light standing on the floor's curved rim, on the lit
// side: the light the rim catches, rising off it and fading upward, in the
// rim's own colour. Additive, so the background glows through it.
const BEAM_HEIGHT = 0.22; // of the wall's radius

const BEAM_VERT = /* glsl */ `
  varying vec3 vPos;
  varying float vGraze;
  void main() {
    vPos = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    // The curtain's own normal (outward from the rim) against the view:
    // 1 where it is seen edge-on, 0 where it faces the camera.
    vec3 n = normalize(mat3(modelMatrix) * vec3(position.x, 0.0, position.z));
    vec3 v = normalize(cameraPosition - world.xyz);
    vGraze = 1.0 - abs(dot(n, v));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const BEAM_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  varying vec3 vPos;
  varying float vGraze;
  void main() {
    float h = clamp(vPos.y / ${BEAM_HEIGHT.toFixed(3)}, 0.0, 1.0);
    // The colour of the floor's rim directly beneath (see FLOOR_FRAG).
    vec3 col = pal(uTime + 1.2 - 0.45 + 1.6 * clamp(vPos.x, -1.0, 1.0));
    // Rising off the rim and fading upward; hottest along the base line.
    float rise = pow(1.0 - h, 2.2);
    float base = exp(-h * 18.0);
    col = mix(col, vec3(1.0), 0.35 * base);
    // Gone where the rim runs back into the wall (z -> 0), so the curtain
    // never ends in a hard vertical edge.
    float ends = smoothstep(0.05, 0.6, vPos.z);
    // A sheet of light glows most where it is seen through its thickness:
    // edge-on it reads as the rim's glowing silhouette, face-on it is a
    // faint veil — so from the front it never washes over the floor.
    float sheet = mix(0.28, 1.0, pow(vGraze, 1.5));
    float a = (0.85 * rise + 0.9 * base) * ends * sheet * uFade;
    if (uMirror > 0.5) a *= 0.35;
    gl_FragColor = vec4(col * a, a * 0.25);
  }
`;

// ── Motion: tables of what was measured, smoothed between points ───────────
// The camera's angle round from edge-on (the clip's arch width at each
// moment, as a flat panel would need it), its pitch, its distance, and
// where it looks — all splines through the readings.
const AZ_TABLE: [number, number][] = [
  [0, 6], [1.5, 14], [2.67, 27], [3.3, 33], [5.0, 38], [6.4, 50], [7.2, 64], [7.9, 79],
  [8.6, 88], [9.2, 90], [9.9, 85], [10.6, 81], [11.3, 86], [11.9, 90], [13.1, 90],
];
const DIST_TABLE: [number, number][] = [
  [0, 3.3], [3.3, 3.1], [5, 3.3], [6.7, 3.7], [8.3, 3.95], [10, 3.7], [13.1, 3.9],
];
const AIM_TABLE: [number, number][] = [
  [0, 0.34], [5, 0.34], [8.3, 0.34], [13.1, 0.34],
];
// Edge-on, the wall stands in the left third of the frame and the lit
// floor runs away to the right: the camera looks to the OPEN side of the
// wall, and comes back to centre as it turns to the front.
const AIM_Z_TABLE: [number, number][] = [
  [0, 0.3], [4, 0.3], [6.5, 0.15], [8.3, 0], [13.1, 0],
];
const ELEV_TABLE: [number, number][] = [
  [0, 3], [2.5, 5], [5.0, 6], [8.5, 12], [13.1, 12],
];
const DEG = Math.PI / 180;

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
      aimZ: table(AIM_Z_TABLE, time),
      dist: table(DIST_TABLE, time),
    };
  }
  const u = time - 13.1;
  return { az: (90 - 5 * Math.sin(u / 2.4)) * DEG, elev: 12 * DEG, aim: 0.34, aimZ: 0, dist: 3.9 - 0.25 * Math.sin(u / 3.1) };
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
};
function makeMaterials(pal: THREE.Texture) {
  const uniforms = (mirror: number): Uniforms => ({
    uTime: { value: 0 },
    uPeriod: { value: PALETTE_PERIOD },
    uPal: { value: pal },
    uMirror: { value: mirror },
    // 1, not 0: the canvas draws a frame the moment it is built, before the
    // loop has run once, and that frame must not be blank.
    uFade: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
  });
  // The wall is one flat sheet, lit the same on both faces; it does not
  // write depth (the boy sits just in front of it, ordered explicitly).
  const shellLike = (mirror: number, frag: string) =>
    new THREE.ShaderMaterial({
      uniforms: uniforms(mirror),
      vertexShader: SHELL_VERT,
      fragmentShader: frag,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
  // Light, not paint: added to what is already there. The floor and beam
  // shaders write premultiplied light with a faint alpha, so the canvas
  // stays see-through and the page background glows through them.
  const lightBlend = {
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
  } as const;
  const floorLike = (mirror: number) =>
    new THREE.ShaderMaterial({
      uniforms: uniforms(mirror),
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      ...lightBlend,
    });
  const beamLike = (mirror: number) =>
    new THREE.ShaderMaterial({
      uniforms: uniforms(mirror),
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      ...lightBlend,
    });
  return {
    shell: shellLike(0, SHELL_FRAG),
    floor: floorLike(0),
    floorM: floorLike(1),
    beam: beamLike(0),
  };
}

// The boy: a seated model (leaning back on his hands, legs out, looking
// up — the reference's pose), scaled to the reference's seated height:
// about 50px against a 514px shell radius in the front view, a tenth.
const BOY_HEIGHT = 0.1;

function Boy({ mirrored = false, clock }: { mirrored?: boolean; clock: React.RefObject<number> }) {
  const { scene } = useGLTF(MODEL_URL);
  // The silhouette's material lives in a ref: its opacity is written
  // every frame, which a memoised value may not be. It is handed to the
  // meshes in an effect, never during render.
  const black = useRef<THREE.MeshBasicMaterial | null>(null);
  const object = useMemo(() => {
    const o = scene.clone(true);
    o.renderOrder = mirrored ? 0 : 4;
    // Seat on the floor, the model's own height scaled to BOY_HEIGHT.
    const box = new THREE.Box3().setFromObject(o);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = BOY_HEIGHT / Math.max(size.y, 1e-3);
    o.scale.setScalar(s);
    o.position.set(0, -box.min.y * s, 0);
    return o;
  }, [scene, mirrored]);
  useEffect(() => {
    if (black.current == null) {
      black.current = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: !mirrored,
      });
    }
    const mat = black.current;
    object.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = mat;
    });
  }, [object, mirrored]);
  // He is not there in the clip's first second: he fades in as the arch
  // opens, between 0.8 and 1.6s.
  useFrame(() => {
    const t = clock.current ?? 0;
    const u = Math.max(0, Math.min(1, (t - 0.8) / 0.8));
    if (black.current) black.current.opacity = u * u * (3 - 2 * u) * (mirrored ? 0.4 : 1);
  });
  // In the centre of the lit floor — halfway between the wall (z = 0) and
  // the disc's rim (z = 1) — facing the wall: the model looks along +z,
  // the wall stands at -z from where he sits.
  return (
    <primitive
      object={object}
      position={[0, 0, 0.5]}
      rotation={[0, Math.PI, 0]}
      renderOrder={mirrored ? 0 : 4}
    />
  );
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
  const mats = useMemo(() => makeMaterials(palette), [palette]);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      palette.dispose();
    },
    [mats, palette],
  );

  const shellGeo = useMemo(
    // A flat upright half-disc, its diameter on the floor along x.
    () => new THREE.CircleGeometry(1, 160, 0, Math.PI),
    [],
  );
  const floorGeo = useMemo(() => new THREE.CircleGeometry(1.0, 160), []);
  // Half an open cylinder on the floor's rim, on the lit side (z >= 0),
  // standing from the floor up.
  const beamGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(1, 1, BEAM_HEIGHT, 160, 1, true, -Math.PI / 2, Math.PI);
    g.translate(0, BEAM_HEIGHT / 2, 0);
    return g;
  }, []);
  const target = useMemo(() => new THREE.Vector3(), []);
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
    const time = raw < 1 ? raw * raw * (2 - raw) : raw;
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
    target.set(0, r.aim - scroll.current * 0.22 * k, r.aimZ);
    camera.lookAt(target);
    gl.getDrawingBufferSize(res);

    for (const m of Object.values(mats)) {
      const u = m.uniforms as Uniforms;
      u.uTime.value = time;
      u.uFade.value = fade;
      u.uRes.value.copy(res);
    }
  });

  return (
    <>
      <mesh geometry={shellGeo} material={mats.shell} renderOrder={2} />
      <mesh
        geometry={floorGeo}
        material={mats.floor}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.003, 0]}
        renderOrder={1}
      />
      <mesh geometry={beamGeo} material={mats.beam} renderOrder={3} />
      <Suspense fallback={null}>
        <Boy clock={t} />
      </Suspense>

      {/* The reflection: only the floor's glow, upside down and faint. The
          clip's black ground shows no mirrored dome — just a soft wash of
          the lit strip below it — so the shell is not mirrored at all. */}
      <group scale={[1, -1, 1]}>
        <mesh
          geometry={floorGeo}
          material={mats.floorM}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.012, 0]}
          renderOrder={0}
        />
        <Suspense fallback={null}>
          <Boy mirrored clock={t} />
        </Suspense>
      </group>
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
  const off = useKillSwitch("dome");
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
          "linear-gradient(to bottom, transparent 0%, #000 14%, #000 88%, transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, transparent 0%, #000 14%, #000 88%, transparent 100%)",
      }}
    >
      {(near || built) && !off && (
        <Canvas
          key={ctxKey}
          className="absolute inset-0"
          frameloop={inView ? "always" : "demand"}
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
            gl.setClearColor(0x000000, 0);
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
