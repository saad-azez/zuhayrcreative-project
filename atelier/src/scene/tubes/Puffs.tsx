import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three'
import { TUBES, ZMARK, nozzleTip, tubeDir } from '../../layout'
import { loopT } from '../../lib/time'
import { PAINT_MATERIALS } from '../pixels/paintMaterials'
import { VOXEL_GEO } from '../pixels/voxelGeometry'
import { soloPhase, tipOffset } from './motion'

// The solo squeeze's punchline: a little knot of pixels pushes out of the nozzle, hangs for a beat and is sucked back in.
// Cells in (across, along) units of one pixel below the nozzle, in the order they appear.
const KNOT: [number, number][] = [[0, 0], [0, 1], [-1, 1], [1, 1], [0, 2], [1, 2], [0, 3]]

const m = new Matrix4()
const q = new Quaternion()
const p = new Vector3()
const off = new Vector3()
const sc = new Vector3()

export function Puffs() {
  const refs = useRef<(InstancedMesh | null)[]>([])
  useFrame(({ clock }) => {
    const t = loopT(clock.elapsedTime)
    for (const T of TUBES) {
      const mesh = refs.current[T.index]
      if (!mesh) continue
      const u = soloPhase(T, t)
      if (u < 0) { mesh.visible = false; continue }
      mesh.visible = true
      // Out fast, a beat held, back in: 0 -> 1 -> 0 over the squeeze.
      const e = u < 0.35 ? u / 0.35 : u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4
      const tip = nozzleTip(T)
      const d = tubeDir(T)
      tipOffset(T, t, off)
      const c = ZMARK.cell
      let n = 0
      KNOT.forEach(([a, s], i) => {
        const k = Math.min(Math.max(e * KNOT.length - i, 0), 1)
        if (k <= 0) return
        const along = 0.022 + s * c * e
        // Across = the tube's own sideways direction (perpendicular to its axis in the window plane).
        p.set(tip[0] + d[0] * along - d[1] * a * c, tip[1] + d[1] * along + d[0] * a * c, tip[2] + d[2] * along).add(off)
        q.setFromAxisAngle(sc.set(0, 0, 1), T.tilt * (1 - k))
        m.compose(p, q, sc.setScalar(k))
        mesh.setMatrixAt(n++, m)
      })
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <group>
      {TUBES.map((T) => (
        <instancedMesh
          key={T.id}
          ref={(el) => { refs.current[T.index] = el }}
          args={[VOXEL_GEO, PAINT_MATERIALS[T.paint], KNOT.length]}
          castShadow
          frustumCulled={false}
          visible={false}
        />
      ))}
    </group>
  )
}
