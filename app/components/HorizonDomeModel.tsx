"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import * as THREE from "three";
import { useSceneLease } from "@/app/animations/hooks/useNearViewport";
import { isPhoneDevice, sceneDprCap } from "@/app/lib/device";
import { hasGPU } from "@/app/lib/gpu";
import { tuneRendererForProduction } from "@/app/lib/threeRenderer";

/**
 * HorizonDomeModel — the end-credits dome for the model draft (?hero=model).
 *
 * The live dome's scene (HorizonDome: the hollow half-dome, the boy, the
 * camera's turn from edge-on to the front, the pointer and scroll parallax),
 * dressed in the approved still C (.draft-assets/dome) instead of drawn
 * colour. C is projected onto the scene from the front view it was made in:
 * its dome light onto the inside of the bowl, its wet floor onto the ground,
 * its haze onto a wall of air behind, so from the front the frame IS C, and
 * as the camera turns and sways every surface keeps its own part of C and the
 * scene reads in depth. (C here has its half-oval and its boy painted out:
 * the boy is the scene's own model, in front of it all.)
 *
 * Over C's light and shade runs the live dome's colour motion, measured from
 * a recording of it (.draft-assets/dome/STUDY.md): one 14.4 s cycle, the
 * whole dome changing almost together, the left lagging the right by 0.8 s
 * per screen width at the crown and 2.4 s at the foot, the floor by 6 s, each
 * colour seeping in as soft clouds from the top right; its colours mapped to
 * the brand's shades at the live palette's own brightness, dark dips too.
 *
 * The dome is a world (approved 24 Oct, from .draft-assets/dome/dome-world.html):
 * a closed half-globe rather than the live dome's open bowl, wearing C by its
 * own shape, turning once every TURN_WORLD seconds (its clouds and patches of
 * light carried round with it), with an atmosphere hugging its curve and a
 * faint graticule that surfaces in its light every 30 s. The boy sits out on
 * the wet floor in front of it.
 */

const C_URL = "/hero/model/dome-c.jpg";
// C carried out past its own edges (half its width each side, 40% of its
// height above, 60% below), the edges softening as they go, so no surface
// ever reads past the picture and smears its last row: the floor's plate,
// and the air's, where the dome (and its rim's glow) is filled from the haze
// round it so the wall behind never shows a second dome.
const ENV_URL = "/hero/model/dome-c-env.jpg";
const AIR_URL = "/hero/model/dome-c-air.jpg";
// The boy: C's own (the photoreal boy leaning back on his hands, his back to
// us), given a faux hawk (client, 24 Oct: variant A), cut out and stood on the
// floor as a card that turns to face the camera; his reflection is drawn from
// him, mirrored and softened.
const BOY_URL = "/hero/model/dome-boy.png?v=hawk-a";
const BOY_ASPECT = 714 / 539;
const PERIOD = 14.4;
/** Seconds for the world to turn once. */
const TURN_WORLD = 70;
/** The globe: a little smaller than the bowl and set back a touch, so the boy
 *  on the floor in front of it sits in the frame with water between them. */
const GLOBE_R = 0.86;
const GLOBE_BACK = -0.22;

// C's framing, in its own image (u across, v down from the top): the dome's
// feet at u 0.08 and 0.92 on the horizon at v 0.779, its crown at v 0.028.
const C_FOOT_L = 0.08;
const C_FOOT_R = 0.92;
const C_HORIZON = 0.779;
const C_CROWN = 0.028;

// ── The colour cycle, in the brand's shades ─────────────────────────────────
// The live palette's own moments and brightness (HorizonDome PALETTE), each
// hue taken to its brand shade (STUDY.md, approved 24 Oct).
const HEX: Record<string, string> = {
  burgundy: "#800020", violet: "#9c2a48", silver: "#c3c6ce", ash: "#ece8e6", rose: "#e8a0ae",
  lightCrimson: "#e8475d", maroon: "#470015", darkest: "#2a000a", silverGrey: "#a8acb4",
  crimson: "#dc143c", crimsonRed: "#b0102a",
};
const STOPS: [number, string, number][] = [
  [0, "burgundy", 0.62], [0.5, "burgundy", 0.59], [1, "violet", 0.57], [1.5, "silver", 0.54], [2, "maroon", 0.61],
  [2.5, "silver", 0.74], [3, "silver", 0.76], [3.5, "ash", 0.72], [4, "rose", 0.69], [4.5, "lightCrimson", 0.66],
  [5, "lightCrimson", 0.62], [5.5, "burgundy", 0.55], [6, "burgundy", 0.42], [6.5, "darkest", 0.32], [7, "darkest", 0.28],
  [7.5, "darkest", 0.33], [8, "maroon", 0.47], [8.5, "silverGrey", 0.66], [9, "rose", 0.81], [9.5, "crimson", 0.82],
  [10, "crimson", 0.75], [10.5, "crimson", 0.79], [11, "crimsonRed", 0.84], [11.5, "crimsonRed", 0.83], [12, "rose", 0.8],
  [12.5, "silver", 0.83], [13.1, "violet", 0.74], [PERIOD, "burgundy", 0.62],
];
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
function makePalette() {
  const N = 512;
  const raw: number[][] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * PERIOD;
    let j = 0;
    while (STOPS[j + 1][0] < t) j++;
    const [t0, c0, v0] = STOPS[j];
    const [t1, c1, v1] = STOPS[j + 1];
    const f = (t - t0) / (t1 - t0);
    const a = rgb(HEX[c0]), b = rgb(HEX[c1]);
    const na = a.map((x) => x / Math.max(...a)), nb = b.map((x) => x / Math.max(...b));
    // Each shade at the brightness the live palette has there; the darker
    // shades (maroon, burgundy) a little lower still.
    const v = (v0 + (v1 - v0) * f) * 1.15;
    const depth = Math.min(1, (Math.max(...a) * (1 - f) + Math.max(...b) * f) * 1.6);
    raw.push(na.map((x, k) => (x * (1 - f) + nb[k] * f) * v * depth));
  }
  // Softened by +/-0.35 s, as the live palette is.
  const half = Math.round((0.35 / PERIOD) * N);
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const acc = [0, 0, 0];
    for (let k = -half; k <= half; k++) {
      const c = raw[(i + k + N) % N];
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    }
    for (let k = 0; k < 3; k++) data[i * 4 + k] = Math.min(255, Math.round((acc[k] / (2 * half + 1)) * 255));
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ── Shading ────────────────────────────────────────────────────────────────
const VERT = /* glsl */ `
  uniform mat4 uMainVP;
  varying vec3 vPos;
  varying vec3 vWorld;
  varying vec4 vMainClip;
  void main() {
    vPos = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vMainClip = uMainVP * w;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const COMMON = /* glsl */ `
  uniform sampler2D uC;     // the still, C (the bowl's plate)
  uniform sampler2D uEnv;   // C carried past its edges (the floor's)
  uniform sampler2D uAir;   // the same, the dome filled with haze (the air's)
  uniform sampler2D uPal;   // the colour cycle, one period across
  uniform mat4 uFrontVP;    // the front view C was made in
  uniform vec4 uFit;        // front-view screen -> C's image: u = x*a+b, v = y*c+d
  uniform float uTime;
  uniform vec2 uRes;
  varying vec3 vPos;
  varying vec3 vWorld;
  varying vec4 vMainClip;
  // Where a point of the scene sits in C (u across, v down from the top).
  vec2 imgAt(vec3 w) {
    vec4 p = uFrontVP * vec4(w, 1.0);
    vec2 n = p.xy / max(p.w, 1e-4);
    return vec2(n.x * uFit.x + uFit.y, n.y * uFit.z + uFit.w);
  }
  vec3 cAt(vec2 im) {
    im = clamp(im, vec2(0.002), vec2(0.998));
    return texture2D(uC, vec2(im.x, 1.0 - im.y)).rgb;
  }
  // C's image coordinates into the padded plates.
  vec3 padAt(sampler2D t, vec2 im) {
    vec2 q = vec2((im.x + 0.5) / 2.0, (im.y + 0.4) / 2.0);
    q = clamp(q, vec2(0.001), vec2(0.999));
    return texture2D(t, vec2(q.x, 1.0 - q.y)).rgb;
  }
  // C at full size, handing over to the carried-out plate softly near its
  // edges (a hard switch drew a line where the picture ends).
  vec3 cOrEnv(vec2 im) {
    float e = min(min(im.x, 1.0 - im.x), min(im.y, 1.0 - im.y));
    return mix(padAt(uEnv, im), cAt(im), smoothstep(0.0, 0.04, e));
  }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float vnoise3(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int k = 0; k < 3; k++) { s += a * vnoise3(p); p = p * 2.03 + vec3(1.7, 9.2, 4.1); a *= 0.5; }
    return s / 0.875;
  }
  // Three octaves: the seep it shapes is soft, and every pixel of the frame
  // runs it, so the finer two cost frame time and showed nothing.
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int k = 0; k < 3; k++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return s / 0.875;
  }
  // The colour cycle over C's own light and shade at this point. k: how far
  // the left side lags the right, in seconds per screen width.
  vec3 cycle(vec3 src, vec2 im, float k) {
    vec2 n = vMainClip.xy / vMainClip.w;
    float sx = n.x * 0.5 + 0.5;
    float seep = (fbm(im * 2.4 + vec2(-uTime * 0.07, uTime * 0.05)) - 0.5) * 1.4 + (${C_HORIZON.toFixed(3)} - im.y) * 0.5;
    float sec = uTime + k * (sx - 0.5) + seep;
    vec3 pc = texture2D(uPal, vec2(fract(sec / ${PERIOD.toFixed(1)}), 0.5)).rgb;
    float L = dot(src, vec3(0.2126, 0.7152, 0.0722));
    vec3 lit = pc * (0.25 + 1.1 * L);
    float keep = smoothstep(0.8, 0.95, L);
    vec3 hot = mix(src, pc / max(max(pc.r, max(pc.g, pc.b)), 0.001), 0.22);
    return mix(lit, hot, keep);
  }
  vec3 dither(vec3 c) {
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    return max(c + (n - 0.5) / 255.0, 0.0);
  }
`;
// The world: C's dome laid over the globe by its own shape (across and up),
// so its foot glows all the way round and its sides never stretch; its
// clouds turning with it, and the graticule surfacing now and then.
const SHELL_FRAG = /* glsl */ `
  ${COMMON}
  void main() {
    if (vPos.y < 0.0) discard;
    vec2 im = vec2(0.5 + vPos.x * ${(C_FOOT_R - 0.5).toFixed(3)}, ${C_HORIZON.toFixed(3)} - vPos.y * ${(C_HORIZON - C_CROWN).toFixed(3)});
    vec3 src = cOrEnv(im);
    vec3 col = cycle(src, im, mix(2.4, 0.8, clamp(vPos.y, 0.0, 1.0)));
    // It turns: its clouds and patches of light are carried round with the
    // surface (the light falling on it stays).
    float ang = uTime * ${(2 * Math.PI / TURN_WORLD).toFixed(5)};
    vec3 q = vec3(vPos.x * cos(ang) + vPos.z * sin(ang), vPos.y, -vPos.x * sin(ang) + vPos.z * cos(ang));
    float cl = fbm3(q * 2.3);
    col *= 0.8 + 0.45 * cl;
    col = mix(col, vec3(dot(col, vec3(0.333))) * 1.2 + 0.04, smoothstep(0.6, 0.85, cl) * 0.22);
    // The graticule, every 15 degrees, surfacing for a few seconds every 30 s;
    // faint, strongest where the globe is bright.
    float lon = atan(q.x, q.z) / ${(Math.PI / 12).toFixed(5)};
    float lat = asin(clamp(q.y, -1.0, 1.0)) / ${(Math.PI / 12).toFixed(5)};
    float gLon = 1.0 - smoothstep(0.0, fwidth(lon), abs(fract(lon + 0.5) - 0.5));
    float gLat = 1.0 - smoothstep(0.0, fwidth(lat), abs(fract(lat + 0.5) - 0.5));
    float grid = max(gLon * sqrt(max(1.0 - q.y * q.y, 0.0)), gLat) * step(0.02, q.y);
    float pulse = smoothstep(0.55, 0.95, 0.5 + 0.5 * sin(uTime * ${(2 * Math.PI / 30).toFixed(5)} - 1.4));
    float L = dot(src, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col, vec3(0.96, 0.92, 0.93), grid * pulse * (0.05 + 0.13 * L));
    gl_FragColor = vec4(dither(col), 1.0);
  }
`;
// The atmosphere: a halo of light round the globe, brightest where it hugs
// the curve and gone a little way out, thinning towards the water, in the
// colour the cycle is showing.
const ATMO_FRAG = /* glsl */ `
  ${COMMON}
  uniform vec3 uCenter;
  uniform float uR;
  uniform float uRh;
  void main() {
    if (vWorld.y < 0.0) discard;
    vec3 dir = normalize(vWorld - cameraPosition);
    float d = length(cross(uCenter - cameraPosition, dir));
    float t = clamp((d - uR) / (uRh - uR), 0.0, 1.0);
    float glow = (1.0 - t) * (1.0 - t) * step(uR * 0.985, d) * smoothstep(0.0, 0.16, vWorld.y);
    vec3 pc = texture2D(uPal, vec2(fract((uTime + 1.0) / ${PERIOD.toFixed(1)}), 0.5)).rgb;
    vec3 c = mix(pc / max(max(pc.r, max(pc.g, pc.b)), 0.001), vec3(0.95, 0.9, 0.92), 0.35) * 0.55;
    gl_FragColor = vec4(c * glow, 1.0);
  }
`;
// The ground: C's wet floor and its reflection, fading into the dark far off.
const GROUND_FRAG = /* glsl */ `
  ${COMMON}
  void main() {
    vec2 im = imgAt(vWorld);
    // C's dome is wider than the globe: in front, its foot glow and its
    // reflection on the water are drawn in to the globe's width.
    im.x = mix(im.x, 0.5 + (im.x - 0.5) / ${GLOBE_R.toFixed(2)}, smoothstep(-0.6, 0.2, vWorld.z));
    // In front of the dome it is the floor (lag 6 s); behind it, seen from
    // the front, it is the air, and it moves with the air (1 s).
    // Behind the dome the ground is seen against the air: it reads the air's
    // plate (no dome in it), so it meets the wall behind without a seam.
    // Inside the bowl it is C itself (the dome's glowing foot, as the bowl
    // shows it), moving with the dome's foot.
    float rr = length(vWorld.xz);
    float front = smoothstep(-0.3, 0.5, vWorld.z);
    float inBowl = (1.0 - smoothstep(0.96, 1.06, rr)) * (1.0 - front);
    // The floor reads C itself at full size wherever C has it; only past
    // C's edges the carried-out plate.
    vec3 floorSrc = cOrEnv(im);
    vec3 src = mix(padAt(uAir, im), floorSrc, max(front, inBowl));
    float k = mix(mix(1.0, 6.0, front), 2.4, inBowl);
    vec3 col = cycle(src, im, k);
    float r = length(vWorld.xz);
    // Fading into the dark only in front: behind, it meets the air seamlessly.
    col *= 1.0 - smoothstep(3.0, 7.5, r) * smoothstep(-0.5, 0.5, vWorld.z);
    gl_FragColor = vec4(dither(col), 1.0);
  }
`;
// The air: C's haze on a wall behind the dome. Where C has the dome itself,
// the haze just outside its edge is read instead, so no second dome shows on
// the wall as the camera turns.
const AIR_FRAG = /* glsl */ `
  ${COMMON}
  void main() {
    vec2 im = imgAt(vWorld);
    vec3 col = cycle(padAt(uAir, im), im, 1.0);
    gl_FragColor = vec4(dither(col), 1.0);
  }
`;

// The boy's card: his colours from C, his rim light following the cycle;
// mirrored, his reflection, fading away from where he sits.
const BOY_FRAG = /* glsl */ `
  ${COMMON}
  uniform sampler2D uBoy;
  uniform vec2 uSize;
  uniform float uMirror;
  void main() {
    vec2 uv = vec2(vPos.x / uSize.x + 0.5, vPos.y / uSize.y);
    vec4 b = texture2D(uBoy, uv);
    vec3 pc = texture2D(uPal, vec2(fract((uTime + 1.0) / ${PERIOD.toFixed(1)}), 0.5)).rgb;
    vec3 tint = pc / max(max(pc.r, max(pc.g, pc.b)), 0.001);
    float L = dot(b.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 col = mix(b.rgb, tint * L * 1.25, 0.45);
    float a = b.a;
    if (uMirror > 0.5) a *= 0.38 * (1.0 - smoothstep(0.0, 0.85, uv.y));
    gl_FragColor = vec4(col, a);
  }
`;

// Film grain and a soft vignette over the frame, as C has.
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float g = fract(sin(dot(vUv * 1000.0 + uTime * 7.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      vec2 d = vUv - 0.5;
      float vig = 1.0 - smoothstep(0.35, 0.95, length(d * vec2(1.1, 1.0))) * 0.3;
      gl_FragColor = vec4(c.rgb * vig + g * 0.03, c.a);
    }`,
};
const BLOOM = { strength: 0.16, radius: 0.6, threshold: 0.82 };

// ── Motion: the live dome's own ─────────────────────────────────────────────
// One eased turn from edge-on to the front over TURN_S, then held, with the
// pointer and the page's scroll nudging the camera (HorizonDome).
const TURN_S = 11.5;
const AZ_FROM = 4.9;
const AZ_TO = 90;
const ELEV_FROM = 1.2;
const ELEV_TO = 12;
const AIM_FROM = 0.29;
const AIM_TO = 0.39;
const DIST = 3.06;
const FIT_ASPECT = 1.46;
const DESKTOP_LIFT = 0.045;
const DEG = Math.PI / 180;
function rig(time: number) {
  const u = Math.min(1, Math.max(0, time / TURN_S));
  const e = u * u * u * (u * (u * 6 - 15) + 10);
  return {
    az: (AZ_FROM + (AZ_TO - AZ_FROM) * e) * DEG,
    elev: (ELEV_FROM + (ELEV_TO - ELEV_FROM) * e) * DEG,
    aim: AIM_FROM + (AIM_TO - AIM_FROM) * e,
  };
}
function place(cam: THREE.PerspectiveCamera, az: number, elev: number, dist: number, target: THREE.Vector3) {
  cam.position.set(-dist * Math.cos(az) * Math.cos(elev), dist * Math.sin(elev), dist * Math.sin(az) * Math.cos(elev));
  cam.lookAt(target);
  cam.updateMatrixWorld();
}

// He sits on the floor in front of the world, a little smaller than C has
// him against its dome, on the axis.
// (The card is a little taller than C's boy alone, to hold the hair.)
const BOY_HEIGHT = 0.1076;
const BOY: [number, number, number] = [0, 0, 1.0];
const AIM: [number, number, number] = [0, 0, -0.5];

type U = {
  uC: { value: THREE.Texture };
  uEnv: { value: THREE.Texture };
  uAir: { value: THREE.Texture };
  uPal: { value: THREE.Texture };
  uMainVP: { value: THREE.Matrix4 };
  uFrontVP: { value: THREE.Matrix4 };
  uFit: { value: THREE.Vector4 };
  uTime: { value: number };
  uRes: { value: THREE.Vector2 };
};
function makeMaterials(c: THREE.Texture, env: THREE.Texture, air: THREE.Texture, boy: THREE.Texture, pal: THREE.Texture) {
  const mk = (frag: string, side: THREE.Side, extra: Record<string, THREE.IUniform> = {}, add = false, cut = false) =>
    new THREE.ShaderMaterial({
      uniforms: {
        ...extra,
        uC: { value: c },
        uEnv: { value: env },
        uAir: { value: air },
        uPal: { value: pal },
        uMainVP: { value: new THREE.Matrix4() },
        uFrontVP: { value: new THREE.Matrix4() },
        uFit: { value: new THREE.Vector4(0.5, 0.5, -0.5, 0.5) },
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
      } satisfies U,
      vertexShader: VERT,
      fragmentShader: frag,
      side,
      ...(add ? { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } : {}),
      ...(cut ? { transparent: true, depthWrite: false } : {}),
    });
  return {
    shell: mk(SHELL_FRAG, THREE.FrontSide),
    boy: mk(BOY_FRAG, THREE.DoubleSide, { uBoy: { value: boy }, uSize: { value: new THREE.Vector2(BOY_HEIGHT * BOY_ASPECT, BOY_HEIGHT) }, uMirror: { value: 0 } }, false, true),
    boyMirror: Object.assign(
      mk(BOY_FRAG, THREE.DoubleSide, { uBoy: { value: boy }, uSize: { value: new THREE.Vector2(BOY_HEIGHT * BOY_ASPECT, BOY_HEIGHT) }, uMirror: { value: 1 } }, false, true),
      // It lies below the floor: drawn over it, not hidden by it.
      { depthTest: false },
    ),
    atmo: mk(
      ATMO_FRAG,
      THREE.BackSide,
      {
        uCenter: { value: new THREE.Vector3(0, 0, GLOBE_BACK) },
        uR: { value: GLOBE_R },
        uRh: { value: GLOBE_R * 1.12 },
      },
      true,
    ),
    ground: mk(GROUND_FRAG, THREE.DoubleSide),
    air: mk(AIR_FRAG, THREE.BackSide),
  };
}

function Scene({
  running,
  inView,
  reducedMotion,
  wrap,
}: {
  running: boolean;
  inView: boolean;
  reducedMotion: boolean;
  wrap: React.RefObject<HTMLDivElement | null>;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const inViewRef = useRef(inView);
  useEffect(() => {
    inViewRef.current = inView;
    if (inView) invalidate();
  }, [inView, invalidate]);

  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const dprNow = useThree((s) => s.viewport.dpr);
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM.strength, BLOOM.radius, BLOOM.threshold));
    c.addPass(new ShaderPass(GRADE));
    return c;
  }, [gl, scene, camera]);
  useEffect(() => {
    composer.setPixelRatio(dprNow);
    composer.setSize(size.width, size.height);
  }, [composer, size, dprNow]);
  useEffect(() => () => composer.dispose(), [composer]);
  // The grain moves: its clock is advanced here, through a ref.
  const grade = useRef<ShaderPass | null>(null);
  useEffect(() => {
    grade.current = composer.passes[composer.passes.length - 1] as ShaderPass;
  }, [composer]);
  useFrame((_, dt) => {
    if (grade.current) grade.current.uniforms.uTime.value += dt;
    composer.render();
  }, 1);

  const plates = useMemo(() => {
    const load = (url: string) => {
      const t = new THREE.TextureLoader().load(url, () => invalidate());
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = 8;
      return t;
    };
    return { still: load(C_URL), env: load(ENV_URL), air: load(AIR_URL), boy: load(BOY_URL) };
  }, [invalidate]);
  const palette = useMemo(() => makePalette(), []);
  const mats = useMemo(() => makeMaterials(plates.still, plates.env, plates.air, plates.boy, palette), [plates, palette]);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      Object.values(plates).forEach((t) => t.dispose());
      palette.dispose();
    },
    [mats, plates, palette],
  );

  const shellGeo = useMemo(() => new THREE.SphereGeometry(1, 256, 96, 0, Math.PI * 2, 0, Math.PI / 2 + 0.03), []);
  const boyGeo = useMemo(() => new THREE.PlaneGeometry(BOY_HEIGHT * BOY_ASPECT, BOY_HEIGHT).translate(0, BOY_HEIGHT / 2, 0), []);
  // The card turns about its upright to face the camera.
  const boyRef = useRef<THREE.Group | null>(null);
  const atmoGeo = useMemo(() => new THREE.SphereGeometry(1, 160, 64, 0, Math.PI * 2, 0, Math.PI / 2), []);
  // The front view C was made in, kept in a ref (moved every frame).
  const frontRef = useRef<THREE.PerspectiveCamera | null>(null);
  const res = useMemo(() => new THREE.Vector2(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const probe = useMemo(() => new THREE.Vector3(), []);
  const mainVP = useMemo(() => new THREE.Matrix4(), []);
  const frontVP = useMemo(() => new THREE.Matrix4(), []);
  const fit = useMemo(() => new THREE.Vector4(), []);
  const pointer = useRef({ x: 0, y: 0 });
  const eased = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);
  const t = useRef(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      pointer.current.x = ((e.clientX - b.left) / b.width) * 2 - 1;
      pointer.current.y = ((e.clientY - b.top) / b.height) * 2 - 1;
      invalidate();
    };
    const onLeave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
      invalidate();
    };
    const onScroll = () => {
      const b = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      scroll.current = Math.max(-1, Math.min(1, ((b.top + b.height / 2) / vh - 0.5) * -2));
      if (inViewRef.current) invalidate();
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
  }, [wrap, invalidate]);

  useFrame((_, dt) => {
    if (running && !reducedMotion) t.current += Math.min(dt, 0.05);
    const time = t.current;
    const r = rig(reducedMotion ? TURN_S : time);
    const k = reducedMotion ? 0 : 1;
    eased.current.x += (pointer.current.x - eased.current.x) * 0.06;
    eased.current.y += (pointer.current.y - eased.current.y) * 0.06;
    if (
      Math.abs(pointer.current.x - eased.current.x) > 1e-4 ||
      Math.abs(pointer.current.y - eased.current.y) > 1e-4
    ) {
      invalidate();
    }
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = cam.aspect || FIT_ASPECT;
    const dist = DIST * Math.max(1, FIT_ASPECT / aspect);
    const lift = aspect >= FIT_ASPECT ? DESKTOP_LIFT : 0;
    target.set(AIM[0], r.aim - lift - scroll.current * 0.22 * k, AIM[2]);
    place(cam, r.az + eased.current.x * 2.5 * DEG * k, Math.max(1.5 * DEG, r.elev - eased.current.y * 1.6 * DEG * k), dist, target);
    mainVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    if (boyRef.current) boyRef.current.rotation.y = Math.atan2(cam.position.x - BOY[0], cam.position.z - BOY[2]);

    // The front view C was made in: the turn's end, no pointer, no scroll.
    frontRef.current ??= new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    const front = frontRef.current;
    front.aspect = aspect;
    front.updateProjectionMatrix();
    target.set(AIM[0], AIM_TO - lift, AIM[2]);
    place(front, AZ_TO * DEG, ELEV_TO * DEG, dist, target);
    frontVP.multiplyMatrices(front.projectionMatrix, front.matrixWorldInverse);
    // Fit that view to C's framing: the dome's feet and crown where C has them.
    // Read off the outline of a unit globe as the front view sees it (the
    // circle where its surface turns away); C's horizon at the globe's foot.
    const zt = 1 / dist, rt = Math.sqrt(1 - zt * zt);
    const ndc = (x: number, y: number, z: number) => probe.set(x, y, z).applyMatrix4(frontVP);
    const lx = ndc(-rt, 0, zt).x, rx = ndc(rt, 0, zt).x;
    const hy = ndc(0, 0, GLOBE_BACK).y, cy = ndc(0, rt, zt).y;
    const a = (C_FOOT_R - C_FOOT_L) / (rx - lx);
    const c = (C_CROWN - C_HORIZON) / (cy - hy);
    fit.set(a, C_FOOT_L - a * lx, c, C_HORIZON - c * hy);
    gl.getDrawingBufferSize(res);

    for (const m of Object.values(mats)) {
      const u = m.uniforms as U;
      u.uMainVP.value.copy(mainVP);
      u.uFrontVP.value.copy(frontVP);
      u.uFit.value.copy(fit);
      u.uTime.value = time;
      u.uRes.value.copy(res);
    }
  });

  return (
    <>
      {/* The air behind the dome, the ground, the bowl, then the boy. */}
      <mesh position={[0, 4.4, 0]} material={mats.air}>
        <cylinderGeometry args={[4.5, 4.5, 9, 160, 1, true]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0004, 0]} material={mats.ground}>
        <circleGeometry args={[9, 128]} />
      </mesh>
      <mesh geometry={shellGeo} material={mats.shell} position={[0, 0, GLOBE_BACK]} scale={GLOBE_R} />
      <mesh geometry={atmoGeo} material={mats.atmo} position={[0, 0, GLOBE_BACK]} scale={GLOBE_R * 1.12} />
      <group ref={boyRef} position={BOY}>
        {/* His reflection: drawn over the floor (it lies below it). */}
        <mesh geometry={boyGeo} material={mats.boyMirror} scale={[1, -1, 1]} renderOrder={5} />
        <mesh geometry={boyGeo} material={mats.boy} renderOrder={6} />
      </group>
    </>
  );
}

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export default function HorizonDomeModel({ className = "" }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const near = useSceneLease(wrap, { label: "Footer" });
  const [built, setBuilt] = useState(false);
  useEffect(() => {
    if (isPhoneDevice()) return;
    if (!hasGPU()) return;
    const cb = () => setBuilt(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(cb, { timeout: 700 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(cb, 300);
    return () => window.clearTimeout(id);
  }, []);
  const [inView, setInView] = useState(false);
  const [running, setRunning] = useState(false);
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
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 5%, #000 92%, transparent 100%)",
        maskImage: "linear-gradient(to bottom, transparent 0%, #000 5%, #000 92%, transparent 100%)",
      }}
    >
      {(near || built) && (
        <Canvas
          key={ctxKey}
          className="absolute inset-0"
          frameloop={inView && running && !reducedMotion ? "always" : "demand"}
          flat
          camera={{ position: [-3.3, 0.17, 0], fov: 30, near: 0.05, far: 50 }}
          dpr={[1, sceneDprCap()]}
          gl={{ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            tuneRendererForProduction(gl);
            gl.setClearColor(0x000000, 1);
            const canvas = gl.domElement;
            canvas.addEventListener("webglcontextlost", (e) => e.preventDefault(), { once: true });
            canvas.addEventListener("webglcontextrestored", () => setCtxKey((k) => k + 1), { once: true });
          }}
        >
          <Scene running={running} inView={inView} reducedMotion={reducedMotion} wrap={wrap} />
        </Canvas>
      )}
    </div>
  );
}

