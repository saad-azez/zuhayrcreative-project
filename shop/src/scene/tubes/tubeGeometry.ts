// The geometry of one paint tube at 10x, built in the tube's local frame: origin = the centre of the key axis (where the
// crimp is rolled), local -y runs down the tube toward the nozzle, +x is across the flat width, +z faces the street.
// `s` below is the distance from the origin along -y (s = 0 at the key, s = 1.0 at the nozzle tip).
import { BufferGeometry, CircleGeometry, CylinderGeometry, Float32BufferAttribute, LatheGeometry, TorusGeometry, Vector2 } from 'three'
import { TUBE } from '../../layout'

const R = TUBE.R

/** Clamped smoothstep. */
const ss = (x: number) => {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

/**
 * The printed, crimped, dented body (s 0.05 .. 0.82): a flattened ellipse at the crimp that swells to a round tube, with
 * soft hand-dents near the crimp that fade out down the tube. u = 0.5 is the front; v = 0 is the crimp end.
 */
export function buildBody(seed: number): BufferGeometry {
  const RINGS = 160
  const AROUND = 128
  const cols = AROUND + 1
  const pos: number[] = []
  const uv: number[] = []
  for (let i = 0; i <= RINGS; i++) {
    const s = 0.05 + (0.77 * i) / RINGS
    const b = 0.006 + (R - 0.006) * ss((s - 0.05) / 0.25)
    const a = R + ((Math.PI * R) / 2 - R) * (1 - b / R)
    const fade = 1 - ss((s - 0.2) / 0.15)
    for (let j = 0; j <= AROUND; j++) {
      const th = -Math.PI + (2 * Math.PI * j) / AROUND
      const n =
        fade * 0.004 * (Math.sin(3 * th + 31 * s + 6.2832 * seed) * Math.sin(47 * s + 3.1 * seed) + 0.5 * Math.sin(7 * th - 63 * s + 9 * seed)) +
        0.0012 * Math.sin(5 * th + 13 * s + 4 * seed) * Math.sin(11 * s + 7 * seed)
      pos.push((a + n) * Math.sin(th), -s, (b + n) * Math.cos(th))
      uv.push(j / AROUND, (s - 0.05) / 0.77)
    }
  }
  // At the front (th ~ 0) j+1 moves toward +x and i+1 moves toward -y; (p, q, p+1) has normal (-y) x (+x) = +z, which is
  // outward there, so that is the winding that faces out.
  const idx: number[] = []
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < AROUND; j++) {
      const p = i * cols + j
      const q = p + cols
      idx.push(p, q, p + 1, p + 1, q, q + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  // Weld the UV seam: the first and last column are the same place, so they share one averaged normal.
  const nrm = g.getAttribute('normal')
  for (let i = 0; i <= RINGS; i++) {
    const a0 = i * cols
    const a1 = a0 + AROUND
    const x = nrm.getX(a0) + nrm.getX(a1)
    const y = nrm.getY(a0) + nrm.getY(a1)
    const z = nrm.getZ(a0) + nrm.getZ(a1)
    const l = Math.hypot(x, y, z) || 1
    nrm.setXYZ(a0, x / l, y / l, z / l)
    nrm.setXYZ(a1, x / l, y / l, z / l)
  }
  nrm.needsUpdate = true
  return g
}

/** The plain aluminium shoulder, threaded neck and open nozzle (s 0.82 .. 1.0), lathed about the tube axis. */
export function buildNeck(): BufferGeometry {
  const list: [number, number][] = []
  for (let k = 0; k <= 16; k++) {
    list.push([0.045 + (R - 0.045) * Math.cos((Math.PI / 2) * k / 16), 0.82 + (0.07 * k) / 16])
  }
  for (let k = 1; k <= 48; k++) {
    const s = 0.89 + (0.095 * k) / 48
    list.push([0.042 + 0.003 * Math.max(0, Math.sin((2 * Math.PI * (s - 0.89)) / 0.012)), s])
  }
  list.push([0.0415, 0.993], [0.039, 0.999], [0.035, 1.0], [0.032, 0.997])
  list.push([0.032, 0.95], [0.0005, 0.95])
  const pts = list.map(([r, s]) => new Vector2(r, -s)).reverse()
  return new LatheGeometry(pts, 96)
}

/** The crimp end rolled up on the key: four nested open shells, outermost first (axis along x). */
export function buildRollShells(): BufferGeometry[] {
  return [0.055, 0.047, 0.039, 0.031].map((r, n) => {
    const g = new CylinderGeometry(r, r, 0.44, 96, 1, true)
    g.rotateZ(Math.PI / 2)
    if (n === 0) {
      // The print carries on over the roll at its own scale; negative v wraps.
      const p = g.getAttribute('position')
      const uv = g.getAttribute('uv')
      for (let k = 0; k < p.count; k++) {
        uv.setXY(k, 0.5 + p.getX(k) / 0.88, (-(Math.atan2(p.getZ(k), p.getY(k)) + Math.PI) * 0.055) / 0.77)
      }
      uv.needsUpdate = true
    }
    return g
  })
}

/** The thin rims seen at the two ends of the roll: one per shell radius at each end (8). */
export function buildRollEnds(): BufferGeometry[] {
  const out: BufferGeometry[] = []
  for (const x of [-0.22, 0.22]) {
    for (const r of [0.055, 0.047, 0.039, 0.031]) {
      const g = new TorusGeometry(r, 0.0025, 8, 96)
      g.rotateY(Math.PI / 2)
      g.translate(x, 0, 0)
      out.push(g)
    }
  }
  return out
}

/** A dark backing disc closing each end of the roll, facing outward. */
export function buildRollBackings(): BufferGeometry[] {
  return ([-1, 1] as const).map((side) => {
    const g = new CircleGeometry(0.055, 64)
    g.rotateY((side * Math.PI) / 2)
    g.translate(side * 0.2185, 0, 0)
    return g
  })
}

/** A knurled screw cap: every second vertex of the torso's two rows is pulled in a little to read as ribbing. */
export function buildCap(): BufferGeometry {
  const g = new CylinderGeometry(0.046, 0.046, 0.07, 64, 1, false)
  const p = g.getAttribute('position')
  for (let v = 0; v < 2 * 65; v++) {
    if ((v % 65) % 2 === 1) p.setXYZ(v, p.getX(v) * 0.94, p.getY(v), p.getZ(v) * 0.94)
  }
  p.needsUpdate = true
  g.computeVertexNormals()
  return g
}
