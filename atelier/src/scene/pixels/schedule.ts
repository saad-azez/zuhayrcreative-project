import { Quaternion, Vector3 } from 'three'
import { TL, TUBES, nozzleTip, pourOf, tubeDir } from '../../layout'
import { bezier, clamp01, easeInOutCubic, easeInOutSine, easeOutCubic, rand } from './math'
import { RASTER_S1, streamPoint, streamTangent } from './streams'
import { SLOTS, SLOTS_BY_TUBE, ZMARK_BOTTOM, ZMARK_TOP, type Slot } from './voxelZ'
import { tipOffset } from '../tubes/motion'
const OFF = new Vector3()

// Every slot's journey as a pure function of the loop time: it leaves its nozzle on a Bezier, lands in the Z, waits (or is
// swallowed by the scan line), then lifts off top-first and flies back up into the nozzle.

export const FLY_MIN = 0.85
export const FLY_VAR = 0.35
export const BACK_MIN = 0.6
export const BACK_VAR = 0.4
export const SCAN_M = 0.04

export function emitTime(slot: Slot): number {
  const [p0, p1] = pourOf(TUBES[slot.tube])
  const K = SLOTS_BY_TUBE[slot.tube].length
  return p0 + 0.4 + (K > 1 ? slot.rank / (K - 1) : 0) * (p1 - p0 - 0.35)
}
export const flyDur = (slot: Slot) => FLY_MIN + FLY_VAR * rand(slot.index, 1)
export const arriveTime = (slot: Slot) => emitTime(slot) + flyDur(slot)
export const departTime = (slot: Slot) => TL.undo[0] + 0.05 + (slot.undoRank / (SLOTS.length - 1)) * 0.65
export const backDur = (slot: Slot) => BACK_MIN + BACK_VAR * rand(slot.index, 2)

/** Height of the scan line (world y); +-10 parks it out of the way. */
export function scanY(t: number): number {
  const yb = ZMARK_BOTTOM - SCAN_M
  const yt = ZMARK_TOP + SCAN_M
  if (t < TL.render[0]) return -10
  if (t < TL.render[1]) return yb + (yt - yb) * easeInOutSine((t - TL.render[0]) / (TL.render[1] - TL.render[0]))
  if (t < TL.unscan[0]) return 10
  if (t < TL.unscan[1]) return yt - (yt - yb) * easeInOutSine((t - TL.unscan[0]) / (TL.unscan[1] - TL.unscan[0]))
  return -10
}

// Reusable temps (nothing is allocated per slot per frame).
const W = new Vector3()
const P0 = new Vector3()
const P1 = new Vector3()
const P2 = new Vector3()
const P3 = new Vector3()
const TG = new Vector3()
const AX = new Vector3()

/** A random tumble axis for the slot (fallback +y when the draw is degenerate). */
function tumbleAxis(i: number): Vector3 {
  AX.set(rand(i, 9) - 0.5, rand(i, 10) - 0.5, rand(i, 11) - 0.5)
  if (AX.length() < 1e-3) return AX.set(0, 1, 0)
  return AX.normalize()
}

/** Writes the slot's position and rotation at loop time t and returns its scale (0 = hidden). */
export function slotPose(slot: Slot, t: number, pos: Vector3, quat: Quaternion): number {
  const i = slot.index
  const e = emitTime(slot)
  if (t < e) return 0
  const a = e + flyDur(slot)
  const dt = departTime(slot)
  const bd = backDur(slot)
  const T = TUBES[slot.tube]
  W.set(slot.world[0], slot.world[1], slot.world[2])

  if (t < a) {
    // OUTBOUND: out of the stream's far end, tumbling, easing into its place in the Z.
    streamPoint(T, RASTER_S1, e, P0)
    P0.x += (rand(i, 3) - 0.5) * 0.024
    P0.y += (rand(i, 4) - 0.5) * 0.024
    P0.z += (rand(i, 5) - 0.5) * 0.024
    streamTangent(T, RASTER_S1, TG)
    P1.copy(P0).addScaledVector(TG, 0.22)
    P3.copy(W)
    P2.set(W.x + (rand(i, 6) - 0.5) * 0.1, W.y + 0.16 + 0.1 * rand(i, 7), W.z + 0.2 + 0.1 * rand(i, 8))
    const u = easeOutCubic((t - e) / (a - e))
    bezier(pos, P0, P1, P2, P3, u)
    quat.setFromAxisAngle(tumbleAxis(i), (0.6 + 1.2 * rand(i, 12)) * 2 * Math.PI * (1 - u) * (1 - u))
    return 1
  }

  if (t < dt) {
    // SETTLED: sits in the Z (until the scan line has passed over it and the true mark takes over).
    pos.copy(W)
    quat.identity()
    if (t >= TL.render[0] && t < TL.unscan[1] && W.y < scanY(t)) return 0
    return 1 + 0.28 * Math.sin(Math.PI * clamp01((t - a) / 0.16))
  }

  if (t < dt + bd) {
    // RETURN: lifts off and flies back up into the nozzle, shrinking as it goes in.
    const tip = nozzleTip(T)
    const D = tubeDir(T)
    P0.copy(W)
    P1.set(W.x, W.y + 0.2, W.z + 0.15)
    P2.set(tip[0] + D[0] * 0.25, tip[1] + D[1] * 0.25, tip[2] + D[2] * 0.25)
    P3.set(tip[0] - D[0] * 0.02, tip[1] - D[1] * 0.02, tip[2] - D[2] * 0.02)
    // Home into the nozzle where it is now (the tube swings: tubes/motion.ts).
    tipOffset(T, t, OFF)
    P2.add(OFF)
    P3.add(OFF)
    const u = easeInOutCubic((t - dt) / bd)
    bezier(pos, P0, P1, P2, P3, u)
    quat.setFromAxisAngle(tumbleAxis(i), (0.6 + 1.2 * rand(i, 12)) * 2 * Math.PI * u * u)
    return u < 0.7 ? 1 : 1 - 0.75 * ((u - 0.7) / 0.3)
  }

  return 0
}
