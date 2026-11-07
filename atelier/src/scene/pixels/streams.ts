import { Vector3 } from 'three'
import { TUBE, TUBES, ZMARK, nozzleTip, pourOf, tubeDir, type TubeDef } from '../../layout'
import { ss } from './math'
import { tipOffset } from '../tubes/motion'

// The paint leaving each nozzle: a gently bending centreline (with a faint sway), the rope that grows along it and the
// raster of cells that its far end "prints". All pure functions of the loop time.

export const ROPE_MAX = 0.2
export const ROPE_R = 0.032 * TUBE.k
export const RASTER_S0 = 0.16
export const RASTER_S1 = 0.33
export const RASTER_R = 0.032

// Per-tube constants, resolved once so the per-frame code allocates nothing.
const TIP = TUBES.map((T) => nozzleTip(T))
const DIR = TUBES.map((T) => tubeDir(T))
const BEND = TUBES.map((T) => {
  const sx = Math.sign(nozzleTip(T)[0])
  const inner = T.index === 1 || T.index === 2
  return [-sx * (inner ? 0.4 : 0.6), 0, 1.2] as const
})
const PHASE = TUBES.map((T) => 1.7 * T.index)
const OFF = new Vector3()

export function streamPoint(T: TubeDef, s: number, t: number, out: Vector3): Vector3 {
  const tip = TIP[T.index], dir = DIR[T.index], bend = BEND[T.index], ph = PHASE[T.index]
  const w = 0.006 * (s / 0.28)
  // The root follows the swinging nozzle (tubes/motion.ts) and eases back onto the fixed path by the raster's far end.
  tipOffset(T, t, OFF)
  const k = 1 - ss(s / RASTER_S1)
  return out.set(
    tip[0] + dir[0] * s + bend[0] * s * s + w * Math.sin(7.3 * t + 11 * s + ph) + OFF.x * k,
    tip[1] + dir[1] * s + bend[1] * s * s + OFF.y * k,
    tip[2] + dir[2] * s + bend[2] * s * s + w * Math.cos(5.9 * t + 13 * s + ph) + OFF.z * k,
  )
}

export function streamTangent(T: TubeDef, s: number, out: Vector3): Vector3 {
  const dir = DIR[T.index], bend = BEND[T.index]
  return out.set(dir[0] + 2 * bend[0] * s, dir[1] + 2 * bend[1] * s, dir[2] + 2 * bend[2] * s).normalize()
}

export function ropeLength(T: TubeDef, t: number): number {
  const [p0, p1] = pourOf(T)
  if (t < p0) return 0
  if (t < p1) return ROPE_MAX * ss((t - p0) / 0.25)
  return ROPE_MAX * (1 - ss((t - p1) / 0.3))
}

export function rasterRange(T: TubeDef, t: number): [number, number] | null {
  const [p0, p1] = pourOf(T)
  if (t < p0 + 0.15 || t > p1 + 0.45) return null
  const sB = RASTER_S0 + (RASTER_S1 - RASTER_S0) * ss((t - p0 - 0.15) / 0.3)
  const sA = t < p1 ? RASTER_S0 : RASTER_S0 + (RASTER_S1 - RASTER_S0) * ss((t - p1) / 0.45)
  if (sB - sA < 0.01) return null
  return [sA, sB]
}

const NS = 20
const samples = new Float32Array(NS * 3)
const tmp = new Vector3()

/** Fills out with x, y, z of the world grid cells the stream's segment currently occupies; returns the cell count (max 64). */
export function rasterCells(T: TubeDef, t: number, out: number[]): number {
  const range = rasterRange(T, t)
  if (!range) return 0
  const [sA, sB] = range
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let q = 0; q < NS; q++) {
    streamPoint(T, sA + ((sB - sA) * q) / (NS - 1), t, tmp)
    samples[q * 3] = tmp.x; samples[q * 3 + 1] = tmp.y; samples[q * 3 + 2] = tmp.z
    minX = Math.min(minX, tmp.x); maxX = Math.max(maxX, tmp.x)
    minY = Math.min(minY, tmp.y); maxY = Math.max(maxY, tmp.y)
    minZ = Math.min(minZ, tmp.z); maxZ = Math.max(maxZ, tmp.z)
  }
  const c = ZMARK.cell
  minX -= c; minY -= c; minZ -= c; maxX += c; maxY += c; maxZ += c
  const r2 = RASTER_R * RASTER_R
  let count = 0
  for (let ix = Math.ceil(minX / c - 0.5); ix <= Math.floor(maxX / c - 0.5); ix++) {
    const x = (ix + 0.5) * c
    for (let iy = Math.ceil(minY / c - 0.5); iy <= Math.floor(maxY / c - 0.5); iy++) {
      const y = (iy + 0.5) * c
      for (let iz = Math.ceil(minZ / c - 0.5); iz <= Math.floor(maxZ / c - 0.5); iz++) {
        const z = (iz + 0.5) * c
        let near = false
        for (let q = 0; q < NS - 1 && !near; q++) {
          const ax = samples[q * 3], ay = samples[q * 3 + 1], az = samples[q * 3 + 2]
          const bx = samples[q * 3 + 3] - ax, by = samples[q * 3 + 4] - ay, bz = samples[q * 3 + 5] - az
          const len2 = bx * bx + by * by + bz * bz
          let u = len2 > 0 ? ((x - ax) * bx + (y - ay) * by + (z - az) * bz) / len2 : 0
          u = u < 0 ? 0 : u > 1 ? 1 : u
          const dx = x - (ax + bx * u), dy = y - (ay + by * u), dz = z - (az + bz * u)
          if (dx * dx + dy * dy + dz * dz <= r2) near = true
        }
        if (near) {
          out[count * 3] = x; out[count * 3 + 1] = y; out[count * 3 + 2] = z
          if (++count >= 64) return count
        }
      }
    }
  }
  return count
}
