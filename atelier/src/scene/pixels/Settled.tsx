import { useLayoutEffect, useMemo, useRef } from 'react'
import { Euler, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three'
import { TURNTABLE, ZMARK, type PaintId } from '../../layout'
import { PAINT_MATERIALS } from './paintMaterials'
import { rand } from './math'
import { VOXEL_GEO } from './voxelGeometry'

const PAINT_ORDER: PaintId[] = ['pearl', 'crimson', 'oxblood', 'chrome']
const CAPS: [number, number][] = [[-0.97, -0.36], [-0.78, -0.14], [0.98, -0.28], [1.28, -0.52]]

// Pixels that landed on the paper and stayed: 32 static voxels scattered around the turntable, clear of the caps.
export function Settled() {
  const refs = useRef<(InstancedMesh | null)[]>([])

  const byPaint = useMemo(() => {
    const groups: Matrix4[][] = PAINT_ORDER.map(() => [])
    let accepted = 0
    for (let n = 0; accepted < 32; n++) {
      const x = -1.0 + 2.3 * rand(n, 20) // clear of the cutting mat on the left (props/Desk.tsx)
      const z = -1.45 + 1.25 * rand(n, 21)
      if (Math.hypot(x - TURNTABLE.x, z - TURNTABLE.z) < TURNTABLE.r + 0.08) continue
      if (x > 0.92 && z > -0.26) continue // the pencil lying at the front right (props/BrushJar.tsx)
      if (CAPS.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 0.12)) continue
      const p = Math.floor(rand(n, 22) * 4)
      const yaw = 2 * Math.PI * rand(n, 23)
      const y = ZMARK.cell * 0.47 + 0.003
      groups[p].push(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(0, yaw, 0)), new Vector3(1, 1, 1)))
      accepted++
    }
    return groups
  }, [])

  useLayoutEffect(() => {
    byPaint.forEach((list, p) => {
      const mesh = refs.current[p]
      if (!mesh) return
      list.forEach((mat, n) => mesh.setMatrixAt(n, mat))
      mesh.count = list.length
      mesh.instanceMatrix.needsUpdate = true
    })
  }, [byPaint])

  return (
    <group>
      {PAINT_ORDER.map((id, p) => (
        <instancedMesh
          key={id}
          ref={(el) => { refs.current[p] = el }}
          args={[VOXEL_GEO, PAINT_MATERIALS[id], Math.max(1, byPaint[p].length)]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
}
