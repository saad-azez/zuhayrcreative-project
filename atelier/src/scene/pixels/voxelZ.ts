import { TUBES, ZMARK, type PaintId } from '../../layout'
import mark from '../../../data/z-mark.json'

// The voxel slots of the Z, computed once at module load: the mark's front facets are sampled on a grid of 3.5 cm columns,
// each column filled with cells down to the slab depth, and dithered between the half's two paints (Bayer 4x4) so the
// gradient across each half reads as a pixel-art ramp.

export type Slot = {
  index: number
  tube: number
  half: 'top' | 'bottom'
  paint: PaintId
  i: number
  j: number
  k: number
  local: [number, number, number]
  world: [number, number, number]
  rank: number
  undoRank: number
}

export const ZMARK_BOTTOM = 0.12 // TURNTABLE.h
export const ZMARK_TOP = ZMARK_BOTTOM + 0.9

type P3 = [number, number, number]
const S = ZMARK.scale
const c = ZMARK.cell
const slab = ZMARK.slab
const verts = mark.vertices as unknown as Record<string, P3>

const B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
const m4 = (n: number) => ((n % 4) + 4) % 4
const TUBE_OF: Record<PaintId, number> = { pearl: 0, crimson: 1, oxblood: 2, chrome: 3 }

function build(): { all: Slot[]; byTube: Slot[][] } {
  const all: Slot[] = []
  const byTube: Slot[][] = TUBES.map(() => [])
  const seen = new Set<string>()

  for (const half of ['top', 'bottom'] as const) {
    const tris = (mark.halves[half].frontTriangles as string[][]).map(
      (t) => t.map((n) => verts[n].map((v) => v * S) as P3),
    )
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const tri of tris) for (const v of tri) {
      minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0])
      minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1])
    }

    const cols: { i: number; j: number; zf: number }[] = []
    for (let i = Math.floor(minX / c) - 1; i <= Math.ceil(maxX / c) + 1; i++) {
      for (let j = Math.floor(minY / c) - 1; j <= Math.ceil(maxY / c) + 1; j++) {
        const px = (i + 0.5) * c
        const py = (j + 0.5) * c
        for (const [a, b, cc] of tris) {
          const den = (b[1] - cc[1]) * (a[0] - cc[0]) + (cc[0] - b[0]) * (a[1] - cc[1])
          const l1 = ((b[1] - cc[1]) * (px - cc[0]) + (cc[0] - b[0]) * (py - cc[1])) / den
          const l2 = ((cc[1] - a[1]) * (px - cc[0]) + (a[0] - cc[0]) * (py - cc[1])) / den
          const l3 = 1 - l1 - l2
          if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) {
            cols.push({ i, j, zf: l1 * a[2] + l2 * b[2] + l3 * cc[2] })
            break
          }
        }
      }
    }

    let zmin = Infinity, zmax = -Infinity
    for (const col of cols) { zmin = Math.min(zmin, col.zf); zmax = Math.max(zmax, col.zf) }

    for (const { i, j, zf } of cols) {
      const d = (zf - zmin) / (zmax - zmin)
      const thr = (B[m4(j)][m4(i)] + 0.5) / 16
      const paint: PaintId = half === 'top' ? (d > thr ? 'pearl' : 'chrome') : (d > thr ? 'crimson' : 'oxblood')
      const tube = TUBE_OF[paint]
      const px = (i + 0.5) * c
      const py = (j + 0.5) * c
      const k0 = Math.ceil((zf - slab) / c - 0.5)
      const k1 = Math.floor(zf / c - 0.5)
      for (let k = k0; k <= k1; k++) {
        const key = `${i},${j},${k}`
        if (seen.has(key)) continue
        seen.add(key)
        const local: P3 = [px, py, (k + 0.5) * c]
        const world: P3 = [ZMARK.pos[0] + local[0], ZMARK.pos[1] + local[1], ZMARK.pos[2] + local[2]]
        const slot: Slot = { index: all.length, tube, half, paint, i, j, k, local, world, rank: 0, undoRank: 0 }
        all.push(slot)
        byTube[tube].push(slot)
      }
    }
  }

  // rank: each tube prints bottom-up; undoRank: the whole mark lifts off top-first.
  for (const list of byTube) {
    const sorted = [...list].sort((p, q) => p.world[1] - q.world[1] || p.world[0] - q.world[0] || p.world[2] - q.world[2])
    sorted.forEach((s, n) => { s.rank = n })
  }
  const undo = [...all].sort((p, q) => q.world[1] - p.world[1] || p.world[0] - q.world[0])
  undo.forEach((s, n) => { s.undoRank = n })

  return { all, byTube }
}

const built = build()
export const SLOTS: Slot[] = built.all
export const SLOTS_BY_TUBE: Slot[][] = built.byTube
