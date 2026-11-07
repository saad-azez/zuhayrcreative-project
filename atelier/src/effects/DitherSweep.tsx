import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector3, Vector4 } from 'three'
import { BOX } from '../layout'
import { FROZEN } from '../lib/time'

// Now and then (every 7-18 s, at random) a band of ordered dither sweeps across the window plane: as it passes, the scene
// behind it snaps to a grid of fat pixels and is re-drawn in the brand's four-ink palette (ink, oxblood, crimson, pearl) with a
// 4x4 Bayer dither and faint grid lines, led by a crimson scan line; its trailing edge dissolves back cell by cell in Bayer
// order. Screen-space, masked to the window opening (its four corners projected each frame, so it follows the orbit).
// It runs on the scene before tone mapping (it sits right after SMAA, so it gets its own pass and reads its input freely).

const frag = /* glsl */ `
uniform float uProgress;
uniform float uWidth;
uniform float uDir;
uniform float uCell;
uniform vec4 uQA; // bottom-left (xy), bottom-right (zw) in screen uv
uniform vec4 uQB; // top-right (xy), top-left (zw)

float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

// Inverse bilinear (Inigo Quilez): the point's (u, v) inside the quad a-b-c-d, or -1 when outside.
vec2 invBilinear(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) {
  vec2 e = b - a, f = d - a, g = a - b + c - d, h = p - a;
  float k2 = cross2(g, f);
  float k1 = cross2(e, f) + cross2(h, g);
  float k0 = cross2(h, e);
  if (abs(k2) < 1e-6) {
    float v = -k0 / k1;
    float u = (h.x - f.x * v) / (e.x + g.x * v);
    return vec2(u, v);
  }
  float w = k1 * k1 - 4.0 * k0 * k2;
  if (w < 0.0) return vec2(-1.0);
  w = sqrt(w);
  float ik2 = 0.5 / k2;
  float v = (-k1 - w) * ik2;
  float u = (h.x - f.x * v) / (e.x + g.x * v);
  if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) {
    v = (-k1 + w) * ik2;
    u = (h.x - f.x * v) / (e.x + g.x * v);
  }
  return vec2(u, v);
}

float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int i = int(q.x) + int(q.y) * 4;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[i] + 0.5) / 16.0;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = inputColor;
  if (uProgress < -0.5) return;
  vec2 q = invBilinear(uv, uQA.xy, uQA.zw, uQB.xy, uQB.zw);
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return;
  float s = uDir < 0.5 ? q.x : (uDir < 1.5 ? 1.0 - q.x : 1.0 - q.y);
  float k = (uProgress - s) / uWidth; // 0 at the leading edge, 1 at the trailing edge
  if (k < -0.004 || k > 1.0) return;

  vec2 px = uv * resolution;
  vec2 cellId = floor(px / uCell);
  float b = bayer4(cellId);
  // Trailing edge: each cell returns to the live scene in Bayer order.
  if (k > 0.35 && b < (k - 0.35) / 0.65) return;

  vec2 suv = (cellId + 0.5) * uCell / resolution;
  vec3 c = texture2D(inputBuffer, suv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  l = 1.0 - exp(-1.8 * l);     // an exposure curve: the lit paper reaches pearl, the shadows sink to ink
  // Four inks, ordered-dithered between neighbours (sub-cells of 1/2 cell give the classic Bayer texture).
  float b2 = bayer4(floor(px / (uCell * 0.5)));
  float t = clamp(l * 3.2 + (b2 - 0.5) * 0.9, 0.0, 2.999);
  int idx = int(floor(t + 0.5));
  vec3 ink = vec3(0.004, 0.004, 0.005);
  vec3 ox = vec3(0.10, 0.002, 0.007);
  vec3 cr = vec3(0.55, 0.0, 0.004);
  vec3 pe = vec3(0.90, 0.86, 0.77);
  vec3 col = idx == 0 ? ink : (idx == 1 ? ox : (idx == 2 ? cr : pe));
  // Faint grid between the fat pixels.
  vec2 f = fract(px / uCell);
  float grid = step(f.x, 1.0 / uCell) + step(f.y, 1.0 / uCell);
  col *= 1.0 - 0.35 * clamp(grid, 0.0, 1.0);
  // The leading scan line.
  float line = 1.0 - smoothstep(0.0, 0.012, abs(k));
  col = mix(col, vec3(3.2, 0.06, 0.12), line);
  // Ease in at the very front so the band doesn't pop.
  float front = smoothstep(-0.004, 0.03, k);
  outputColor = vec4(mix(inputColor.rgb, col, max(front, line)), inputColor.a);
}
`

class DitherSweepEffect extends Effect {
  constructor() {
    super('DitherSweep', frag, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uProgress', new Uniform(-1)],
        ['uWidth', new Uniform(0.28)],
        ['uDir', new Uniform(0)],
        ['uCell', new Uniform(12)],
        ['uQA', new Uniform(new Vector4())],
        ['uQB', new Uniform(new Vector4())],
      ]),
    })
  }
}

const SWEEP_S = 1.5
/** Review only: `?dither=<0..1>` pins a sweep at that point of its pass (left to right). */
const PIN: number | null = (() => {
  const r = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('dither')
  const n = r == null ? NaN : Number(r)
  return Number.isFinite(n) ? n : null
})()
const corners = [
  new Vector3(-BOX.halfW, 0, BOX.glassZ),
  new Vector3(BOX.halfW, 0, BOX.glassZ),
  new Vector3(BOX.halfW, BOX.h, BOX.glassZ),
  new Vector3(-BOX.halfW, BOX.h, BOX.glassZ),
]
const tmp = new Vector3()

export function DitherSweep() {
  const effect = useMemo(() => new DitherSweepEffect(), [])
  useEffect(() => () => effect.dispose(), [effect])
  const state = useMemo(() => ({ next: 5 + Math.random() * 6, start: -1, dir: 0 }), [])

  useFrame(({ camera, clock, size, viewport }) => {
    const u = effect.uniforms
    if (PIN !== null) {
      state.start = clock.elapsedTime - PIN * SWEEP_S
      state.dir = 0
    } else if (FROZEN) {
      u.get('uProgress')!.value = -1
      return
    }
    const now = clock.elapsedTime
    if (state.start < 0 && now >= state.next) {
      state.start = now
      state.dir = Math.random() < 0.5 ? 0 : Math.random() < 0.6 ? 1 : 2
    }
    if (state.start < 0) {
      u.get('uProgress')!.value = -1
      return
    }
    const p = (now - state.start) / SWEEP_S
    if (p > 1) {
      state.start = -1
      state.next = now + 7 + Math.random() * 11
      u.get('uProgress')!.value = -1
      return
    }
    const w = u.get('uWidth')!.value as number
    u.get('uProgress')!.value = -0.02 + p * (1 + w + 0.04)
    u.get('uDir')!.value = state.dir
    u.get('uCell')!.value = Math.round(9 * viewport.dpr * Math.max(1, size.width / 1400))
    const s: number[] = []
    for (const c of corners) {
      tmp.copy(c).project(camera)
      s.push(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5)
    }
    ;(u.get('uQA')!.value as Vector4).set(s[0], s[1], s[2], s[3])
    ;(u.get('uQB')!.value as Vector4).set(s[4], s[5], s[6], s[7])
  })

  return <primitive object={effect} dispose={null} />
}
