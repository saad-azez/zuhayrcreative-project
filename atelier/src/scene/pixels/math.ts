import type { Vector3 } from 'three'

// Small pure helpers shared by every pixels module: easing, a seeded hash and a cubic Bezier.

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const ss = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c) }
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3)
export const easeInOutCubic = (x: number) => { const c = clamp01(x); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2 }
export const easeInOutSine = (x: number) => -(Math.cos(Math.PI * clamp01(x)) - 1) / 2

/** Deterministic hash -> [0, 1). Every "random" number in the loop comes from here, never Math.random. */
export function rand(a: number, b = 0): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca77)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Cubic Bezier through p0..p3 at u, written into out. */
export function bezier(out: Vector3, p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, u: number): Vector3 {
  const v = 1 - u
  const a = v * v * v
  const b = 3 * v * v * u
  const c = 3 * v * u * u
  const d = u * u * u
  return out.set(
    a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    a * p0.z + b * p1.z + c * p2.z + d * p3.z,
  )
}
