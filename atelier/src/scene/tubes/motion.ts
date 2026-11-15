import { Euler, Quaternion, Vector3, type Material, type WebGLProgramParametersWithUniforms } from 'three'
import { BOX, LOOP, TUBE, TUBES, nozzleTip, pourOf, type TubeDef } from '../../layout'

// The tubes' own life (11 Oct, the user: "a slow gentle hover/float, and now and then being squeezed"). Each tube swings
// gently on its ceiling rod and is squeezed while it pours (two or three pumps) plus once more on its own, off-beat, when a
// little knot of pixels pushes out of the nozzle and is sucked back in. Everything is a pure function of the loop time with
// whole-loop periods, so the loop, the poster and reduced motion stay exact; every tube has its own seeded timing, so no two
// ever move together.

const TAU = Math.PI * 2

/** The top of each tube's hanging rod (where it meets the ceiling): the pivot of its swing. */
export const ANCHOR: Vector3[] = TUBES.map((T) => {
  const c = Math.cos(T.tilt)
  const h = 0.12 * TUBE.k + (BOX.h - (T.key[1] + 0.12 * TUBE.k * c)) / c
  return new Vector3(T.key[0] - Math.sin(T.tilt) * h, T.key[1] + c * h, T.key[2])
})

// Per tube: whole-loop harmonics (k cycles per 16.4 s loop) and phases for the sway in z (side to side), x (to and fro) and
// the slow twist about the rod; amplitudes in radians (the nozzle moves about 5-8 cm, the twist shows the print turning).
const SWAY = [
  { kz: 1, kx: 2, ky: 3, pz: 0.3, px: 2.1, py: 4.0, az: 0.034, ax: 0.022, ay: 0.06 },
  { kz: 2, kx: 1, ky: 2, pz: 1.7, px: 0.6, py: 1.2, az: 0.027, ax: 0.028, ay: 0.05 },
  { kz: 1, kx: 3, ky: 1, pz: 4.4, px: 3.3, py: 2.6, az: 0.038, ax: 0.019, ay: 0.07 },
  { kz: 3, kx: 2, ky: 2, pz: 2.9, px: 5.1, py: 0.4, az: 0.024, ax: 0.025, ay: 0.055 },
] as const

// Squeezes: pumps per pour, where along the body the hand presses (metres from the key), and the solo squeeze (start, s).
const SQUEEZE = [
  { pumps: 3, at: 0.52, solo: 11.05 },
  { pumps: 2, at: 0.47, solo: 12.35 },
  { pumps: 3, at: 0.56, solo: 15.45 },
  { pumps: 2, at: 0.5, solo: 0.25 },
] as const
/** Length of the solo squeeze (s). */
export const SOLO_DUR = 0.9

const ss = (x: number) => { const c = x < 0 ? 0 : x > 1 ? 1 : x; return c * c * (3 - 2 * c) }
const e = new Euler()
const q0 = new Quaternion()
const v0 = new Vector3()

/** Tube T's swing at loop time t, as a rotation about its anchor. A squeeze nudges it a little too. */
export function swingQuat(T: TubeDef, t: number, out: Quaternion): Quaternion {
  const s = SWAY[T.index]
  const w = TAU * (t / LOOP)
  const kick = 0.014 * squeeze(T, t)
  e.set(s.ax * Math.sin(s.kx * w + s.px), s.ay * Math.sin(s.ky * w + s.py), s.az * Math.sin(s.kz * w + s.pz) + kick, 'XYZ')
  return out.setFromEuler(e)
}

/** A world point p carried by tube T's swing at time t (p fixed to the tube), written to out. */
export function swingPoint(T: TubeDef, p: Vector3, t: number, out: Vector3): Vector3 {
  swingQuat(T, t, q0)
  const A = ANCHOR[T.index]
  return out.copy(p).sub(A).applyQuaternion(q0).add(A)
}

const TIPS = TUBES.map((T) => new Vector3(...nozzleTip(T)))
/** How far tube T's nozzle tip has moved from its rest position at time t (metres, world), written to out. */
export function tipOffset(T: TubeDef, t: number, out: Vector3): Vector3 {
  swingPoint(T, TIPS[T.index], t, v0)
  return out.copy(v0).sub(TIPS[T.index])
}

/** The solo squeeze's progress (0..1) at time t, or -1 outside it. */
export function soloPhase(T: TubeDef, t: number): number {
  const t0 = SQUEEZE[T.index].solo
  let d = t - t0
  if (d < 0) d += LOOP
  return d < SOLO_DUR ? d / SOLO_DUR : -1
}

/** How hard tube T is being squeezed at time t (0 = at rest, 1 = a full squeeze). */
export function squeeze(T: TubeDef, t: number): number {
  const [p0, p1] = pourOf(T)
  let v = 0
  if (t > p0 - 0.3 && t < p1 + 0.6) {
    // Held through the pour, pumped two or three times, released with the last of the paint.
    const hold = ss((t - (p0 - 0.3)) / 0.45) * (1 - ss((t - (p1 - 0.1)) / 0.6))
    const u = (t - p0) / (p1 - p0)
    const pump = 0.5 - 0.5 * Math.cos(TAU * SQUEEZE[T.index].pumps * Math.min(Math.max(u, 0), 1))
    v = hold * (0.5 + 0.5 * pump)
  }
  const u = soloPhase(T, t)
  if (u >= 0) v = Math.max(v, 0.85 * Math.pow(Math.sin(Math.PI * u), 2))
  return v
}

/**
 * Adds the squeeze to a tube material: the hand presses the body flat front to back (z) a little above its middle and it
 * bulges sideways (x). Tube-local frame: origin at the key, -y down the tube (s = -y metres from the key).
 */
export function addSqueeze(mat: Material, T: TubeDef) {
  const uSq = { value: 0 }
  const uAt = { value: SQUEEZE[T.index].at }
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    prev.call(mat, shader, renderer)
    shader.uniforms.uSq = uSq
    shader.uniforms.uAt = uAt
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSq;\nuniform float uAt;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float s = -transformed.y;
          float w = exp(-pow((s - uAt) / 0.17, 2.0)) * uSq;
          transformed.z *= 1.0 - 0.17 * w;
          transformed.x *= 1.0 + 0.07 * w;
        }`,
      )
  }
  const key = mat.customProgramCacheKey.bind(mat)
  mat.customProgramCacheKey = () => key() + '|squeeze'
  return uSq
}
